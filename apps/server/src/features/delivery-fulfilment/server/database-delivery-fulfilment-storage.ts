import { requiredSetItemKindSchema } from "@sprite-anvil/api/family-readiness";
import type { Database } from "@sprite-anvil/db";
import {
	deliveryFulfilmentRequirements,
	deliveryFulfilments,
} from "@sprite-anvil/db/schema/delivery-fulfilment";
import { erasureTombstones } from "@sprite-anvil/db/schema/permanent-erasure";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
	DeliveryFulfilmentStorage,
	StoredDeliveryFulfilment,
} from "./delivery-fulfilment-storage";
import { isUniqueViolation } from "./fulfilment-storage-errors";

/** Insert-only: this storage has no update or delete, so a written Fulfilment never changes. */
export function createDatabaseDeliveryFulfilmentStorage(
	db: Database
): DeliveryFulfilmentStorage {
	async function hydrate(
		headers: (typeof deliveryFulfilments.$inferSelect)[]
	): Promise<StoredDeliveryFulfilment[]> {
		if (headers.length === 0) {
			return [];
		}
		const rows = await db
			.select()
			.from(deliveryFulfilmentRequirements)
			.where(
				inArray(
					deliveryFulfilmentRequirements.fulfilmentId,
					headers.map((header) => header.id)
				)
			)
			.orderBy(asc(deliveryFulfilmentRequirements.position));
		return headers.map((header) => ({
			createdAt: header.createdAt,
			createdByUserId: header.createdByUserId,
			deliveryTargetId: header.deliveryTargetId,
			draftId: header.draftId,
			id: header.id,
			projectId: header.projectId,
			requestDigest: header.requestDigest,
			requirements: rows
				.filter((row) => row.fulfilmentId === header.id)
				.map((row) => ({
					assetFamilyId: row.assetFamilyId,
					assetFamilyName: row.assetFamilyName,
					assetVersionIds: row.assetVersionIds,
					bundleId: row.bundleId,
					itemId: row.itemId,
					itemKind: requiredSetItemKindSchema.parse(row.itemKind),
					itemName: row.itemName,
					manifestDigest: row.manifestDigest,
					requiredSetRevisionId: row.requiredSetRevisionId,
					resolution: row.resolution,
				})),
			revisionId: header.revisionId,
			revisionNumber: header.revisionNumber,
		}));
	}

	return {
		async erasedAssetVersionIds(projectId, assetVersionIds) {
			if (assetVersionIds.length === 0) {
				return new Set();
			}
			const rows = await db
				.select({ id: erasureTombstones.id })
				.from(erasureTombstones)
				.where(
					and(
						eq(erasureTombstones.projectId, projectId),
						inArray(erasureTombstones.id, assetVersionIds)
					)
				);
			return new Set(rows.map((row) => row.id));
		},
		async findFulfilment(projectId, fulfilmentId) {
			const headers = await db
				.select()
				.from(deliveryFulfilments)
				.where(
					and(
						eq(deliveryFulfilments.projectId, projectId),
						eq(deliveryFulfilments.id, fulfilmentId)
					)
				);
			return (await hydrate(headers))[0] ?? null;
		},
		async hasFulfilment(projectId, revisionId) {
			const found = await db
				.select({ id: deliveryFulfilments.id })
				.from(deliveryFulfilments)
				.where(
					and(
						eq(deliveryFulfilments.projectId, projectId),
						eq(deliveryFulfilments.revisionId, revisionId)
					)
				)
				.limit(1);
			return found.length > 0;
		},
		async insertFulfilment(fulfilment) {
			try {
				// One batch (the neon-http driver has no interactive transaction): header and rows land together.
				const header = db.insert(deliveryFulfilments).values({
					createdAt: fulfilment.createdAt,
					createdByUserId: fulfilment.createdByUserId,
					deliveryTargetId: fulfilment.deliveryTargetId,
					draftId: fulfilment.draftId,
					id: fulfilment.id,
					projectId: fulfilment.projectId,
					requestDigest: fulfilment.requestDigest,
					revisionId: fulfilment.revisionId,
					revisionNumber: fulfilment.revisionNumber,
				});
				// The store never writes an empty Fulfilment, so the rows insert is never empty.
				await db.batch([
					header,
					db.insert(deliveryFulfilmentRequirements).values(
						fulfilment.requirements.map((requirement, position) => ({
							assetFamilyId: requirement.assetFamilyId,
							assetFamilyName: requirement.assetFamilyName,
							assetVersionIds: requirement.assetVersionIds,
							bundleId: requirement.bundleId,
							fulfilmentId: fulfilment.id,
							id: `${fulfilment.id}:${position}`,
							itemId: requirement.itemId,
							itemKind: requirement.itemKind,
							itemName: requirement.itemName,
							manifestDigest: requirement.manifestDigest,
							position,
							projectId: fulfilment.projectId,
							requiredSetRevisionId: requirement.requiredSetRevisionId,
							resolution: requirement.resolution,
						}))
					),
				]);
				return { status: "inserted" };
			} catch (error) {
				if (isUniqueViolation(error)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async listFulfilments(projectId, deliveryTargetId) {
			const headers = await db
				.select()
				.from(deliveryFulfilments)
				.where(
					and(
						eq(deliveryFulfilments.projectId, projectId),
						eq(deliveryFulfilments.deliveryTargetId, deliveryTargetId)
					)
				)
				.orderBy(
					desc(deliveryFulfilments.createdAt),
					desc(deliveryFulfilments.id)
				);
			return hydrate(headers);
		},
	};
}
