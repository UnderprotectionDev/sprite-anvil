import type {
	GenerationPackage,
	GenerationPackageStore,
} from "@sprite-anvil/api/generation-packages";
import { generationPackageSchema } from "@sprite-anvil/api/generation-packages";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { project } from "@sprite-anvil/db/schema/project";
import { and, desc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function mapGenerationPackage(
	row: typeof generationPackages.$inferSelect
): GenerationPackage {
	return generationPackageSchema.parse({
		...row.snapshot,
		assetRecordId: row.assetRecordId,
		createdAt: toISOString(row.createdAt),
		id: row.id,
		projectId: row.projectId,
	});
}

async function getOwnedAssetRecord(
	db: Database,
	userId: string,
	projectId: string,
	assetRecordId: string
) {
	const [record] = await db
		.select({ availability: assetRecords.availability, id: assetRecords.id })
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
	return record ?? null;
}

export function createGenerationPackageStore(
	db: Database
): GenerationPackageStore {
	return {
		async create(userId, input) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (record?.availability !== "active") {
				return null;
			}

			const [row] = await db
				.insert(generationPackages)
				.values({
					projectId: input.projectId,
					assetRecordId: input.assetRecordId,
					createdByUserId: userId,
					snapshot: { ...input.snapshot },
				})
				.returning();
			return row ? mapGenerationPackage(row) : null;
		},
		async list(userId, projectId, assetRecordId) {
			const record = await getOwnedAssetRecord(
				db,
				userId,
				projectId,
				assetRecordId
			);
			if (!record || record.availability === "erased") {
				return null;
			}

			const rows = await db
				.select()
				.from(generationPackages)
				.where(
					and(
						eq(generationPackages.projectId, projectId),
						eq(generationPackages.assetRecordId, assetRecordId)
					)
				)
				.orderBy(
					desc(generationPackages.createdAt),
					desc(generationPackages.id)
				);
			return rows.map(mapGenerationPackage);
		},
	};
}
