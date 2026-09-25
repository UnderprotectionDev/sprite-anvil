import type {
	AssetRecordCreateInput,
	AssetRecordMeasurementsUpdateInput,
	AssetRecordMetadataUpdateInput,
	AssetRecordMetadataUpdateResult,
	AssetRecordSearchInput,
	AssetRecordSearchResponse,
	AssetRecordStore,
} from "@sprite-anvil/api/asset-records";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetRecordMeasurements } from "@sprite-anvil/db/schema/asset-record-measurements";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { themes, visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import type { SQL } from "drizzle-orm";
import {
	and,
	arrayContains,
	asc,
	desc,
	eq,
	ilike,
	inArray,
	ne,
	sql,
} from "drizzle-orm";
import { toAssetRecord } from "./asset-record-mapper";

function normalizeTags(tags: readonly string[]) {
	return [
		...new Set(
			tags.map((tag) => tag.trim().toLocaleLowerCase("tr-TR")).filter(Boolean)
		),
	].sort((left, right) => left.localeCompare(right, "tr-TR"));
}

function getSearchConditions(userId: string, input: AssetRecordSearchInput) {
	const conditions: (SQL | undefined)[] = [
		eq(assetRecords.projectId, input.projectId),
		eq(project.ownerUserId, userId),
		input.name
			? ilike(assetRecords.name, `%${input.name.replace(/[\\%_]/g, "\\$&")}%`)
			: undefined,
		input.assetCategory
			? eq(assetRecords.assetCategory, input.assetCategory)
			: undefined,
		input.themeId ? eq(assetRecords.themeId, input.themeId) : undefined,
		input.visualWorldId
			? sql`coalesce(${assetRecords.visualWorldId}, ${assetFamilies.visualWorldId}) = ${input.visualWorldId}`
			: undefined,
		input.tag
			? arrayContains(assetRecords.tags, [input.tag.toLocaleLowerCase("tr-TR")])
			: undefined,
		input.availability
			? eq(assetRecords.availability, input.availability)
			: undefined,
	];
	return and(
		...conditions.filter(
			(condition): condition is SQL => condition !== undefined
		)
	);
}

export function createAssetRecordStore(db: Database): AssetRecordStore {
	return {
		async create(userId, input: AssetRecordCreateInput) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const [record] = await db
				.insert(assetRecords)
				.values({
					id: input.id,
					createdByUserId: userId,
					identityCriteria: input.identityCriteria,
					name: input.name,
					projectId: input.projectId,
					supportLevel: "general",
					availability: "active",
				})
				.onConflictDoNothing()
				.returning();

			if (record) {
				return toAssetRecord(record);
			}
			return this.get(userId, input.projectId, input.id);
		},
		async get(userId, projectId, assetRecordId) {
			const [row] = await db
				.select({
					measurements: assetRecordMeasurements.measurements,
					record: assetRecords,
					familyVisualWorldId: assetFamilies.visualWorldId,
				})
				.from(assetRecords)
				.leftJoin(
					assetRecordMeasurements,
					and(
						eq(assetRecordMeasurements.projectId, assetRecords.projectId),
						eq(assetRecordMeasurements.assetRecordId, assetRecords.id)
					)
				)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.leftJoin(
					assetFamilies,
					and(
						eq(assetFamilies.id, assetRecords.assetFamilyId),
						eq(assetFamilies.projectId, assetRecords.projectId)
					)
				)
				.where(
					and(
						eq(assetRecords.id, assetRecordId),
						eq(assetRecords.projectId, projectId),
						eq(project.ownerUserId, userId)
					)
				)
				.limit(1);
			return row
				? toAssetRecord(row.record, row.familyVisualWorldId, row.measurements)
				: null;
		},
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const rows = await db
				.select({
					measurements: assetRecordMeasurements.measurements,
					record: assetRecords,
					familyVisualWorldId: assetFamilies.visualWorldId,
				})
				.from(assetRecords)
				.leftJoin(
					assetRecordMeasurements,
					and(
						eq(assetRecordMeasurements.projectId, assetRecords.projectId),
						eq(assetRecordMeasurements.assetRecordId, assetRecords.id)
					)
				)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.leftJoin(
					assetFamilies,
					and(
						eq(assetFamilies.id, assetRecords.assetFamilyId),
						eq(assetFamilies.projectId, assetRecords.projectId)
					)
				)
				.where(
					and(
						eq(assetRecords.projectId, projectId),
						eq(project.ownerUserId, userId)
					)
				)
				.orderBy(desc(assetRecords.createdAt), asc(assetRecords.name));
			return rows.map((row) =>
				toAssetRecord(row.record, row.familyVisualWorldId, row.measurements)
			);
		},
		async search(
			userId: string,
			input: AssetRecordSearchInput
		): Promise<AssetRecordSearchResponse | null> {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}

			const rows = await db
				.select({
					record: assetRecords,
					familyVisualWorldId: assetFamilies.visualWorldId,
				})
				.from(assetRecords)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.leftJoin(
					assetFamilies,
					and(
						eq(assetFamilies.id, assetRecords.assetFamilyId),
						eq(assetFamilies.projectId, assetRecords.projectId)
					)
				)
				.where(getSearchConditions(userId, input))
				.orderBy(desc(assetRecords.createdAt), asc(assetRecords.name));

			let matchingVersionsByRecord = new Map<
				string,
				AssetRecordSearchResponse["records"][number]["matchingVersions"]
			>();
			let matchingRecordIds: Set<string> | null = null;
			if (
				input.sourceImageWidth !== undefined &&
				input.sourceImageHeight !== undefined &&
				rows.length > 0
			) {
				const versionRows = await db
					.select({
						assetRecordId: assetVersions.assetRecordId,
						fileName: assetVersions.fileName,
						id: assetVersions.id,
						sourceImageHeight: assetVersions.sourceImageHeight,
						sourceImageWidth: assetVersions.sourceImageWidth,
						versionNumber: assetVersions.versionNumber,
					})
					.from(assetVersions)
					.where(
						and(
							eq(assetVersions.projectId, input.projectId),
							eq(assetVersions.sourceImageWidth, input.sourceImageWidth),
							eq(assetVersions.sourceImageHeight, input.sourceImageHeight),
							inArray(
								assetVersions.assetRecordId,
								rows.map((row) => row.record.id)
							)
						)
					)
					.orderBy(
						asc(assetVersions.assetRecordId),
						desc(assetVersions.versionNumber)
					);
				matchingVersionsByRecord = new Map();
				for (const version of versionRows) {
					if (
						version.sourceImageWidth === null ||
						version.sourceImageHeight === null
					) {
						continue;
					}
					const matchingVersions =
						matchingVersionsByRecord.get(version.assetRecordId) ?? [];
					matchingVersions.push({
						fileName: version.fileName,
						id: version.id,
						sourceImageHeight: version.sourceImageHeight,
						sourceImageWidth: version.sourceImageWidth,
						versionNumber: version.versionNumber,
					});
					matchingVersionsByRecord.set(version.assetRecordId, matchingVersions);
				}
				matchingRecordIds = new Set(matchingVersionsByRecord.keys());
			}

			const records = rows
				.filter(
					({ record }) =>
						matchingRecordIds === null || matchingRecordIds.has(record.id)
				)
				.map(({ record, familyVisualWorldId }) => ({
					matchingVersions: matchingVersionsByRecord.get(record.id) ?? [],
					record: toAssetRecord(record, familyVisualWorldId),
				}));
			return { records, totalCount: records.length };
		},
		async updateMetadata(
			userId: string,
			input: AssetRecordMetadataUpdateInput
		): Promise<AssetRecordMetadataUpdateResult> {
			const [row] = await db
				.select({
					record: assetRecords,
					familyVisualWorldId: assetFamilies.visualWorldId,
				})
				.from(assetRecords)
				.innerJoin(project, eq(project.id, assetRecords.projectId))
				.leftJoin(
					assetFamilies,
					and(
						eq(assetFamilies.id, assetRecords.assetFamilyId),
						eq(assetFamilies.projectId, assetRecords.projectId)
					)
				)
				.where(
					and(
						eq(assetRecords.id, input.assetRecordId),
						eq(assetRecords.projectId, input.projectId),
						eq(project.ownerUserId, userId)
					)
				)
				.limit(1);
			if (!row) {
				return { ok: false, reason: "not_found" };
			}
			if (row.record.availability === "erased") {
				return { ok: false, reason: "erased" };
			}
			if (
				row.familyVisualWorldId &&
				input.visualWorldId !== row.familyVisualWorldId
			) {
				return { ok: false, reason: "family_world_conflict" };
			}
			if (input.visualWorldId) {
				const [visualWorld] = await db
					.select({ id: visualWorlds.id })
					.from(visualWorlds)
					.where(
						and(
							eq(visualWorlds.id, input.visualWorldId),
							eq(visualWorlds.projectId, input.projectId)
						)
					)
					.limit(1);
				if (!visualWorld) {
					return { ok: false, reason: "invalid_scope" };
				}
			}
			if (input.themeId) {
				const [theme] = await db
					.select({ id: themes.id })
					.from(themes)
					.where(
						and(
							eq(themes.id, input.themeId),
							eq(themes.projectId, input.projectId),
							eq(themes.visualWorldId, input.visualWorldId ?? "")
						)
					)
					.limit(1);
				if (!theme) {
					return { ok: false, reason: "invalid_scope" };
				}
			}

			const [updated] = await db
				.update(assetRecords)
				.set({
					assetCategory: input.assetCategory,
					tags: normalizeTags(input.tags),
					themeId: input.themeId,
					visualWorldId: input.visualWorldId,
				})
				.where(
					and(
						eq(assetRecords.id, input.assetRecordId),
						eq(assetRecords.projectId, input.projectId),
						ne(assetRecords.availability, "erased")
					)
				)
				.returning();
			return updated
				? {
						ok: true,
						record: toAssetRecord(updated, row.familyVisualWorldId),
					}
				: { ok: false, reason: "not_found" };
		},
		async setAvailability(userId, projectId, assetRecordId, availability) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const [record] = await db
				.update(assetRecords)
				.set({ availability })
				.where(
					and(
						eq(assetRecords.id, assetRecordId),
						eq(assetRecords.projectId, projectId),
						inArray(assetRecords.availability, ["active", "archived"])
					)
				)
				.returning();
			return record ? this.get(userId, projectId, assetRecordId) : null;
		},
		async updateMeasurements(
			userId,
			input: AssetRecordMeasurementsUpdateInput
		) {
			const record = await this.get(
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (!record || record.availability === "erased") {
				return null;
			}

			await db
				.insert(assetRecordMeasurements)
				.values({
					assetRecordId: input.assetRecordId,
					measurements: input.measurements,
					projectId: input.projectId,
				})
				.onConflictDoUpdate({
					target: [
						assetRecordMeasurements.projectId,
						assetRecordMeasurements.assetRecordId,
					],
					set: { measurements: input.measurements },
				});

			return this.get(userId, input.projectId, input.assetRecordId);
		},
	};
}
