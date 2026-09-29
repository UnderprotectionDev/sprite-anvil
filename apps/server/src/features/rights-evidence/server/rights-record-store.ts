import type {
	RightsRecord,
	RightsRecordCreateInput,
	RightsRecordCreateResult,
	RightsRecordStore,
	RightsRecordStoredEvidenceFile,
} from "@sprite-anvil/api/rights-records";
import {
	rightsRecordCreateInputSchema,
	rightsRecordEvidenceFileCreateInputSchema,
	rightsRecordSchema,
	rightsRecordStoredEvidenceFileSchema,
} from "@sprite-anvil/api/rights-records";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { project } from "@sprite-anvil/db/schema/project";
import { rightsRecords } from "@sprite-anvil/db/schema/rights-records";
import { and, desc, eq, ne } from "drizzle-orm";

type RightsRecordRevisionInput = RightsRecordCreateInput & {
	evidenceFile: RightsRecordStoredEvidenceFile | null;
};

function publicEvidenceFile(file: RightsRecordStoredEvidenceFile | null) {
	if (!file) {
		return null;
	}
	return {
		contentLength: file.contentLength,
		fileName: file.fileName,
		sha256: file.sha256,
		sourceContentType: file.sourceContentType,
	};
}

function toRightsRecord(
	record: typeof rightsRecords.$inferSelect
): RightsRecord {
	const evidenceFile = record.evidenceFile
		? rightsRecordStoredEvidenceFileSchema.parse(record.evidenceFile)
		: null;
	return rightsRecordSchema.parse({
		assetRecordId: record.assetRecordId,
		assertedScope: record.assertedScope,
		createdAt: record.createdAt.toISOString(),
		evidence: record.evidence,
		evidenceFile: publicEvidenceFile(evidenceFile),
		id: record.id,
		projectId: record.projectId,
		restrictions: record.restrictions,
		rightsHolderOrProvider: record.rightsHolderOrProvider,
		source: record.source,
		state: record.state,
		uncertainty: record.uncertainty,
		versionNumber: record.versionNumber,
	});
}

function sameEvidenceFile(
	left: RightsRecordStoredEvidenceFile | null,
	right: RightsRecordStoredEvidenceFile | null
) {
	if (!(left && right)) {
		return left === right;
	}
	return (
		left.contentLength === right.contentLength &&
		left.fileName === right.fileName &&
		left.objectKey === right.objectKey &&
		left.sha256 === right.sha256 &&
		left.sourceContentType === right.sourceContentType
	);
}

function matchesInput(
	record: typeof rightsRecords.$inferSelect,
	input: RightsRecordRevisionInput
) {
	const evidenceFile = record.evidenceFile
		? rightsRecordStoredEvidenceFileSchema.parse(record.evidenceFile)
		: null;
	return (
		record.projectId === input.projectId &&
		record.assetRecordId === input.assetRecordId &&
		record.source === input.source &&
		record.rightsHolderOrProvider === input.rightsHolderOrProvider &&
		record.assertedScope === input.assertedScope &&
		record.evidence === input.evidence &&
		record.restrictions === input.restrictions &&
		record.uncertainty === input.uncertainty &&
		record.state === input.state &&
		sameEvidenceFile(evidenceFile, input.evidenceFile)
	);
}

async function canAccessAssetRecord(
	db: Database,
	userId: string,
	projectId: string,
	assetRecordId: string
) {
	const [assetRecord] = await db
		.select({
			availability: assetRecords.availability,
			id: assetRecords.id,
		})
		.from(assetRecords)
		.innerJoin(project, eq(project.id, assetRecords.projectId))
		.where(
			and(
				eq(assetRecords.projectId, projectId),
				eq(assetRecords.id, assetRecordId),
				eq(project.ownerUserId, userId)
			)
		)
		.limit(1);
	return Boolean(assetRecord && assetRecord.availability !== "erased");
}

async function createNextRevision(
	db: Database,
	userId: string,
	input: RightsRecordRevisionInput,
	attempt = 0
): Promise<RightsRecordCreateResult> {
	const [existing] = await db
		.select()
		.from(rightsRecords)
		.where(eq(rightsRecords.id, input.id))
		.limit(1);
	if (existing) {
		return matchesInput(existing, input)
			? { ok: true, record: toRightsRecord(existing) }
			: { ok: false, reason: "conflict" };
	}

	const [latest] = await db
		.select({ versionNumber: rightsRecords.versionNumber })
		.from(rightsRecords)
		.where(
			and(
				eq(rightsRecords.projectId, input.projectId),
				eq(rightsRecords.assetRecordId, input.assetRecordId)
			)
		)
		.orderBy(desc(rightsRecords.versionNumber))
		.limit(1);

	const [created] = await db
		.insert(rightsRecords)
		.values({
			...input,
			createdByUserId: userId,
			versionNumber: (latest?.versionNumber ?? 0) + 1,
		})
		.onConflictDoNothing()
		.returning();
	if (created) {
		return { ok: true, record: toRightsRecord(created) };
	}
	if (attempt < 4) {
		return createNextRevision(db, userId, input, attempt + 1);
	}
	return { ok: false, reason: "conflict" };
}

export function createRightsRecordStore(db: Database): RightsRecordStore {
	return {
		canAccessAssetRecord(userId, projectId, assetRecordId) {
			return canAccessAssetRecord(db, userId, projectId, assetRecordId);
		},
		async createRevision(userId, rawInput) {
			const input = rightsRecordCreateInputSchema.parse(rawInput);
			const { evidenceFileSourceRecordId, ...recordInput } = input;
			if (
				!(await canAccessAssetRecord(
					db,
					userId,
					input.projectId,
					input.assetRecordId
				))
			) {
				return { ok: false, reason: "not_found" };
			}
			let evidenceFile: RightsRecordStoredEvidenceFile | null = null;
			if (evidenceFileSourceRecordId) {
				const [sourceRecord] = await db
					.select({ evidenceFile: rightsRecords.evidenceFile })
					.from(rightsRecords)
					.where(
						and(
							eq(rightsRecords.id, evidenceFileSourceRecordId),
							eq(rightsRecords.projectId, input.projectId),
							eq(rightsRecords.assetRecordId, input.assetRecordId)
						)
					)
					.limit(1);
				if (!sourceRecord?.evidenceFile) {
					return { ok: false, reason: "not_found" };
				}
				evidenceFile = rightsRecordStoredEvidenceFileSchema.parse(
					sourceRecord.evidenceFile
				);
			}
			return createNextRevision(db, userId, {
				...recordInput,
				evidenceFile,
			});
		},
		async createRevisionWithEvidenceFile(userId, rawInput) {
			const input = rawInput;
			const evidenceFile = rightsRecordStoredEvidenceFileSchema.parse(
				input.evidenceFile
			);
			const { objectKey: _objectKey, ...publicFile } = evidenceFile;
			const normalized = rightsRecordEvidenceFileCreateInputSchema.parse({
				...input,
				evidenceFile: publicFile,
			});
			if (
				!(await canAccessAssetRecord(
					db,
					userId,
					normalized.projectId,
					normalized.assetRecordId
				))
			) {
				return { ok: false, reason: "not_found" };
			}
			return createNextRevision(db, userId, {
				...normalized,
				evidenceFile,
			});
		},
		async getEvidenceFile(userId, projectId, assetRecordId, rightsRecordId) {
			const [record] = await db
				.select({
					evidenceFile: rightsRecords.evidenceFile,
				})
				.from(rightsRecords)
				.innerJoin(
					assetRecords,
					and(
						eq(assetRecords.projectId, rightsRecords.projectId),
						eq(assetRecords.id, rightsRecords.assetRecordId)
					)
				)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.where(
					and(
						eq(rightsRecords.id, rightsRecordId),
						eq(rightsRecords.projectId, projectId),
						eq(rightsRecords.assetRecordId, assetRecordId),
						eq(project.ownerUserId, userId),
						ne(assetRecords.availability, "erased")
					)
				)
				.limit(1);
			if (!record?.evidenceFile) {
				return null;
			}
			return rightsRecordStoredEvidenceFileSchema.parse(record.evidenceFile);
		},
		async list(userId, projectId, assetRecordId) {
			if (!(await canAccessAssetRecord(db, userId, projectId, assetRecordId))) {
				return null;
			}

			const records = await db
				.select()
				.from(rightsRecords)
				.where(
					and(
						eq(rightsRecords.projectId, projectId),
						eq(rightsRecords.assetRecordId, assetRecordId)
					)
				)
				.orderBy(desc(rightsRecords.versionNumber));
			return records.map(toRightsRecord);
		},
	};
}
