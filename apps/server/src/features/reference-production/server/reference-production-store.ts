import type {
	ReferenceBoardHistoryRecord,
	ReferenceBoardImage,
	ReferenceBoardUpdateInput,
	ReferenceBoardUploadInput,
	ReferenceProductionStore,
} from "@sprite-anvil/api/reference-production";
import {
	referenceBoardImageSchema,
	referenceBoardUploadInputSchema,
} from "@sprite-anvil/api/reference-production";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { project } from "@sprite-anvil/db/schema/project";
import {
	referenceBoardImageHistory,
	referenceBoardImages,
} from "@sprite-anvil/db/schema/reference-production";
import { and, asc, eq, inArray, max } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
	const sortedLeft = [...left].sort();
	const sortedRight = [...right].sort();
	return (
		sortedLeft.length === sortedRight.length &&
		sortedLeft.every((value, index) => value === sortedRight[index])
	);
}

function mapImage(
	row: typeof referenceBoardImages.$inferSelect,
	history: ReferenceBoardHistoryRecord[]
): ReferenceBoardImage {
	return referenceBoardImageSchema.parse({
		assetRecordId: row.assetRecordId,
		conflictFeatures: [],
		contentLength: row.contentLength,
		contentType: row.contentType,
		contextOverrideRationale: row.contextOverrideRationale,
		createdAt: toISOString(row.createdAt),
		customPurpose: row.customPurpose,
		fileName: row.fileName,
		forbiddenFeatures: row.forbiddenFeatures,
		history: history.map((entry) => ({
			...entry,
			recordedAt: toISOString(entry.recordedAt),
		})),
		id: row.id,
		notes: row.notes,
		revision: row.revision,
		role: row.role,
		sha256: row.sha256,
		sortOrder: row.sortOrder,
		transferredFeatures: row.transferredFeatures,
		updatedAt: toISOString(row.updatedAt),
	});
}

async function getOwnedTarget(
	db: Database,
	userId: string,
	projectId: string,
	assetRecordId: string,
	requireActive = false
) {
	const ownedProject = await getProjectForUser(db, userId, projectId);
	if (!ownedProject) {
		return null;
	}
	const [target] = await db
		.select({
			assetRecord: assetRecords,
			canonicalVersionId: assetFamilies.canonicalVersionId,
		})
		.from(assetRecords)
		.innerJoin(project, eq(project.id, assetRecords.projectId))
		.leftJoin(
			assetFamilies,
			and(
				eq(assetFamilies.projectId, assetRecords.projectId),
				eq(assetFamilies.id, assetRecords.assetFamilyId)
			)
		)
		.where(
			and(
				eq(assetRecords.id, assetRecordId),
				eq(assetRecords.projectId, projectId),
				eq(project.ownerUserId, userId),
				...(requireActive ? [eq(assetRecords.availability, "active")] : [])
			)
		)
		.limit(1);
	return target ?? null;
}

function needsIdentityOverride(
	input: Pick<
		ReferenceBoardUploadInput | ReferenceBoardUpdateInput,
		"contextOverrideRationale" | "forbiddenFeatures" | "transferredFeatures"
	>,
	canonicalVersionId: string | null
) {
	return Boolean(
		canonicalVersionId &&
			input.transferredFeatures.includes("identity") &&
			!input.forbiddenFeatures.includes("identity") &&
			!input.contextOverrideRationale
	);
}

async function listHistory(
	db: Database,
	projectId: string,
	assetRecordId: string,
	ids: string[]
) {
	if (ids.length === 0) {
		return new Map<string, ReferenceBoardHistoryRecord[]>();
	}
	const rows = await db
		.select()
		.from(referenceBoardImageHistory)
		.where(
			and(
				eq(referenceBoardImageHistory.projectId, projectId),
				eq(referenceBoardImageHistory.assetRecordId, assetRecordId),
				inArray(referenceBoardImageHistory.referenceId, ids)
			)
		)
		.orderBy(asc(referenceBoardImageHistory.revision));
	const grouped = new Map<string, ReferenceBoardHistoryRecord[]>();
	for (const row of rows) {
		const records = grouped.get(row.referenceId) ?? [];
		records.push({
			contextOverrideRationale: row.contextOverrideRationale,
			customPurpose: row.customPurpose,
			forbiddenFeatures: row.forbiddenFeatures,
			notes: row.notes,
			recordedAt: row.recordedAt,
			revision: row.revision,
			role: row.role,
			transferredFeatures: row.transferredFeatures,
		});
		grouped.set(row.referenceId, records);
	}
	return grouped;
}

function sameUpload(
	existing: typeof referenceBoardImages.$inferSelect,
	userId: string,
	input: ReferenceBoardUploadInput
) {
	return (
		existing.projectId === input.projectId &&
		existing.assetRecordId === input.assetRecordId &&
		existing.fileName === input.fileName &&
		existing.contentType === input.contentType &&
		existing.contentLength === input.contentLength &&
		existing.sha256 === input.contentDigest &&
		existing.role === input.role &&
		existing.customPurpose === input.customPurpose &&
		existing.contextOverrideRationale === input.contextOverrideRationale &&
		existing.notes === input.notes &&
		existing.createdByUserId === userId &&
		sameStringSet(existing.transferredFeatures, input.transferredFeatures) &&
		sameStringSet(existing.forbiddenFeatures, input.forbiddenFeatures)
	);
}

async function readImage(
	db: Database,
	projectId: string,
	assetRecordId: string,
	referenceId: string
) {
	const [row] = await db
		.select()
		.from(referenceBoardImages)
		.where(
			and(
				eq(referenceBoardImages.projectId, projectId),
				eq(referenceBoardImages.assetRecordId, assetRecordId),
				eq(referenceBoardImages.id, referenceId)
			)
		)
		.limit(1);
	if (!row) {
		return null;
	}
	const history = await listHistory(db, projectId, assetRecordId, [row.id]);
	return mapImage(row, history.get(row.id) ?? []);
}

type CreateImageResult = Awaited<
	ReturnType<ReferenceProductionStore["createImage"]>
>;

async function insertReferenceImage(
	db: Database,
	userId: string,
	input: ReferenceBoardUploadInput
): Promise<CreateImageResult> {
	const [position] = await db
		.select({ last: max(referenceBoardImages.sortOrder) })
		.from(referenceBoardImages)
		.where(
			and(
				eq(referenceBoardImages.projectId, input.projectId),
				eq(referenceBoardImages.assetRecordId, input.assetRecordId)
			)
		);
	const now = new Date();
	const revision = {
		contextOverrideRationale: input.contextOverrideRationale,
		customPurpose: input.customPurpose,
		forbiddenFeatures: input.forbiddenFeatures,
		notes: input.notes,
		revision: 1,
		role: input.role,
		transferredFeatures: input.transferredFeatures,
	};
	const insertImage = db
		.insert(referenceBoardImages)
		.values({
			id: input.id,
			projectId: input.projectId,
			assetRecordId: input.assetRecordId,
			objectKey: input.objectKey,
			fileName: input.fileName,
			contentType: input.contentType,
			contentLength: input.contentLength,
			sha256: input.contentDigest,
			...revision,
			sortOrder: (position?.last ?? -1) + 1,
			createdByUserId: userId,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	const insertHistory = db.insert(referenceBoardImageHistory).values({
		id: crypto.randomUUID(),
		projectId: input.projectId,
		assetRecordId: input.assetRecordId,
		referenceId: input.id,
		...revision,
		recordedByUserId: userId,
		recordedAt: now,
	});
	try {
		await db.batch([insertImage, insertHistory]);
	} catch {
		const [concurrent] = await db
			.select()
			.from(referenceBoardImages)
			.where(eq(referenceBoardImages.id, input.id))
			.limit(1);
		const created = concurrent
			? await readImage(db, input.projectId, input.assetRecordId, input.id)
			: null;
		if (created && concurrent && sameUpload(concurrent, userId, input)) {
			return { kind: "existing", ok: true, value: created };
		}
		return { ok: false, reason: "conflict" };
	}
	const value = await readImage(
		db,
		input.projectId,
		input.assetRecordId,
		input.id
	);
	return value
		? { kind: "created", ok: true, value }
		: { ok: false, reason: "conflict" };
}

async function createOrGetImage(
	db: Database,
	userId: string,
	input: ReferenceBoardUploadInput
): Promise<CreateImageResult> {
	const [existing] = await db
		.select()
		.from(referenceBoardImages)
		.where(eq(referenceBoardImages.id, input.id))
		.limit(1);
	if (!existing) {
		return insertReferenceImage(db, userId, input);
	}
	if (!sameUpload(existing, userId, input)) {
		return { ok: false, reason: "conflict" };
	}
	const value = await readImage(
		db,
		input.projectId,
		input.assetRecordId,
		input.id
	);
	return value
		? { kind: "existing", ok: true, value }
		: { ok: false, reason: "conflict" };
}

type UpdateImageResult = Awaited<
	ReturnType<ReferenceProductionStore["updateImage"]>
>;

function imageRulesMatch(
	image: typeof referenceBoardImages.$inferSelect,
	input: ReferenceBoardUpdateInput
) {
	return (
		image.role === input.role &&
		image.customPurpose === input.customPurpose &&
		image.contextOverrideRationale === input.contextOverrideRationale &&
		image.notes === input.notes &&
		sameStringSet(image.transferredFeatures, input.transferredFeatures) &&
		sameStringSet(image.forbiddenFeatures, input.forbiddenFeatures)
	);
}

async function updateExistingImage(
	db: Database,
	userId: string,
	input: ReferenceBoardUpdateInput,
	existing: typeof referenceBoardImages.$inferSelect
): Promise<UpdateImageResult> {
	const matchesInput = imageRulesMatch(existing, input);
	if (
		existing.revision !== input.expectedRevision &&
		!(existing.revision === input.expectedRevision + 1 && matchesInput)
	) {
		return { ok: false, reason: "conflict" };
	}
	if (matchesInput) {
		const value = await readImage(
			db,
			input.projectId,
			input.assetRecordId,
			input.id
		);
		return value ? { ok: true, value } : { ok: false, reason: "conflict" };
	}

	const revision = input.expectedRevision + 1;
	const recordedAt = new Date();
	const update = db
		.update(referenceBoardImages)
		.set({
			contextOverrideRationale: input.contextOverrideRationale,
			customPurpose: input.customPurpose,
			forbiddenFeatures: input.forbiddenFeatures,
			notes: input.notes,
			revision,
			role: input.role,
			transferredFeatures: input.transferredFeatures,
			updatedAt: recordedAt,
		})
		.where(
			and(
				eq(referenceBoardImages.projectId, input.projectId),
				eq(referenceBoardImages.assetRecordId, input.assetRecordId),
				eq(referenceBoardImages.id, input.id),
				eq(referenceBoardImages.revision, input.expectedRevision)
			)
		)
		.returning({ id: referenceBoardImages.id });
	const insertHistory = db
		.insert(referenceBoardImageHistory)
		.values({
			id: crypto.randomUUID(),
			projectId: input.projectId,
			assetRecordId: input.assetRecordId,
			referenceId: input.id,
			revision,
			role: input.role,
			customPurpose: input.customPurpose,
			transferredFeatures: input.transferredFeatures,
			forbiddenFeatures: input.forbiddenFeatures,
			contextOverrideRationale: input.contextOverrideRationale,
			notes: input.notes,
			recordedByUserId: userId,
			recordedAt,
		})
		.onConflictDoNothing();
	const [updated] = await db.batch([update, insertHistory]);
	if (updated.length === 0) {
		const [latest] = await db
			.select()
			.from(referenceBoardImages)
			.where(
				and(
					eq(referenceBoardImages.projectId, input.projectId),
					eq(referenceBoardImages.assetRecordId, input.assetRecordId),
					eq(referenceBoardImages.id, input.id)
				)
			)
			.limit(1);
		if (
			!latest ||
			latest.revision !== revision ||
			!imageRulesMatch(latest, input)
		) {
			return { ok: false, reason: "conflict" };
		}
	}
	const value = await readImage(
		db,
		input.projectId,
		input.assetRecordId,
		input.id
	);
	return value ? { ok: true, value } : { ok: false, reason: "conflict" };
}

export function createReferenceProductionStore(
	db: Database
): ReferenceProductionStore {
	return {
		async createImage(userId, rawInput) {
			const input = referenceBoardUploadInputSchema.parse(rawInput);
			const target = await getOwnedTarget(
				db,
				userId,
				input.projectId,
				input.assetRecordId,
				true
			);
			if (!target) {
				return { ok: false, reason: "not_found" };
			}
			if (needsIdentityOverride(input, target.canonicalVersionId)) {
				return { ok: false, reason: "context_override_required" };
			}

			return createOrGetImage(db, userId, input);
		},
		async getImageFile(userId, projectId, assetRecordId, referenceId) {
			const target = await getOwnedTarget(db, userId, projectId, assetRecordId);
			if (!target) {
				return null;
			}
			const [row] = await db
				.select({
					contentLength: referenceBoardImages.contentLength,
					contentType: referenceBoardImages.contentType,
					fileName: referenceBoardImages.fileName,
					objectKey: referenceBoardImages.objectKey,
				})
				.from(referenceBoardImages)
				.where(
					and(
						eq(referenceBoardImages.projectId, projectId),
						eq(referenceBoardImages.assetRecordId, assetRecordId),
						eq(referenceBoardImages.id, referenceId)
					)
				)
				.limit(1);
			return row ?? null;
		},
		async listImages(userId, projectId, assetRecordId) {
			const target = await getOwnedTarget(db, userId, projectId, assetRecordId);
			if (!target) {
				return null;
			}
			const rows = await db
				.select()
				.from(referenceBoardImages)
				.where(
					and(
						eq(referenceBoardImages.projectId, projectId),
						eq(referenceBoardImages.assetRecordId, assetRecordId)
					)
				)
				.orderBy(
					asc(referenceBoardImages.sortOrder),
					asc(referenceBoardImages.createdAt)
				);
			const history = await listHistory(
				db,
				projectId,
				assetRecordId,
				rows.map((row) => row.id)
			);
			return rows.map((row) => mapImage(row, history.get(row.id) ?? []));
		},
		async updateImage(userId, input) {
			const target = await getOwnedTarget(
				db,
				userId,
				input.projectId,
				input.assetRecordId,
				true
			);
			if (!target) {
				return { ok: false, reason: "not_found" };
			}
			if (needsIdentityOverride(input, target.canonicalVersionId)) {
				return { ok: false, reason: "context_override_required" };
			}
			const [existing] = await db
				.select()
				.from(referenceBoardImages)
				.where(
					and(
						eq(referenceBoardImages.projectId, input.projectId),
						eq(referenceBoardImages.assetRecordId, input.assetRecordId),
						eq(referenceBoardImages.id, input.id)
					)
				)
				.limit(1);
			if (!existing) {
				return { ok: false, reason: "not_found" };
			}
			return updateExistingImage(db, userId, input, existing);
		},
	};
}
