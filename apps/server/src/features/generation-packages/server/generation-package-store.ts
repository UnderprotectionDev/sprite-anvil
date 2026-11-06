import type {
	GenerationPackage,
	GenerationPackageStore,
} from "@sprite-anvil/api/generation-packages";
import { generationPackageSchema } from "@sprite-anvil/api/generation-packages";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
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

function withdrawAndFail(db: Database, id: string, message: string) {
	return db
		.delete(generationPackages)
		.where(eq(generationPackages.id, id))
		.then(() => {
			throw new Error(message);
		});
}

/**
 * Re-reads the published package and checks its content digest and relations
 * against what was submitted. A mismatch withdraws the package and fails, so
 * an unexplained difference is never shown as a successful publish.
 */
async function verifyPublishedPackage(
	db: Database,
	input: { assetRecordId: string; projectId: string; snapshot: unknown },
	id: string
) {
	const [persisted] = await db
		.select()
		.from(generationPackages)
		.where(
			and(
				eq(generationPackages.projectId, input.projectId),
				eq(generationPackages.id, id)
			)
		)
		.limit(1);
	if (!persisted) {
		throw new Error(
			"The published Generation Package could not be re-read from the persisted record."
		);
	}
	if (
		persisted.projectId !== input.projectId ||
		persisted.assetRecordId !== input.assetRecordId
	) {
		return withdrawAndFail(
			db,
			id,
			"Generation Package relation check failed: the persisted record points at another project or Asset Record."
		);
	}
	const [submitted, stored] = await Promise.all([
		recordContentDigest(input.snapshot),
		recordContentDigest(persisted.snapshot),
	]);
	if (submitted !== stored) {
		return withdrawAndFail(
			db,
			id,
			"Generation Package content digest check failed: the persisted snapshot differs from the submitted one."
		);
	}
	return mapGenerationPackage(persisted);
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

			// The snapshot must describe the Asset Record it is published against.
			if (
				input.snapshot.assetRecord.id !== input.assetRecordId ||
				input.snapshot.assetRecord.projectId !== input.projectId
			) {
				throw new Error(
					"Generation Package relation check failed: the snapshot describes another Asset Record."
				);
			}

			const [written] = await db
				.insert(generationPackages)
				.values({
					projectId: input.projectId,
					assetRecordId: input.assetRecordId,
					createdByUserId: userId,
					snapshot: { ...input.snapshot },
				})
				.returning();
			if (!written) {
				return null;
			}
			return verifyPublishedPackage(db, input, written.id);
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
