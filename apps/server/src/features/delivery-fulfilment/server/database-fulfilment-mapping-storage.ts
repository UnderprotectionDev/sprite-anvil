import { fulfilmentBundleCheckSchema } from "@sprite-anvil/api/delivery-fulfilment";
import { requiredSetItemKindSchema } from "@sprite-anvil/api/family-readiness";
import type { Database } from "@sprite-anvil/db";
import {
	deliveryFulfilmentDraftRequirements,
	deliveryFulfilmentDrafts,
} from "@sprite-anvil/db/schema/delivery-fulfilment";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type {
	FulfilmentMappingStorage,
	StoredFulfilmentMappingDraft,
} from "./fulfilment-mapping-storage";
import { isUniqueViolation } from "./fulfilment-storage-errors";

export function createDatabaseFulfilmentMappingStorage(
	db: Database
): FulfilmentMappingStorage {
	async function hydrate(
		headers: (typeof deliveryFulfilmentDrafts.$inferSelect)[]
	): Promise<StoredFulfilmentMappingDraft[]> {
		if (headers.length === 0) {
			return [];
		}
		const rows = await db
			.select()
			.from(deliveryFulfilmentDraftRequirements)
			.where(
				inArray(
					deliveryFulfilmentDraftRequirements.draftId,
					headers.map((header) => header.id)
				)
			)
			.orderBy(asc(deliveryFulfilmentDraftRequirements.position));
		return headers.map((header) => ({
			bundleChecks: fulfilmentBundleCheckSchema
				.array()
				.parse(header.bundleChecks),
			createdAt: header.createdAt,
			createdByUserId: header.createdByUserId,
			deliveryTargetId: header.deliveryTargetId,
			id: header.id,
			projectId: header.projectId,
			requestDigest: header.requestDigest,
			requirements: rows
				.filter((row) => row.draftId === header.id)
				.map((row) => ({
					assetFamilyId: row.assetFamilyId,
					assetFamilyName: row.assetFamilyName,
					candidates: row.candidates,
					itemId: row.itemId,
					itemKind: requiredSetItemKindSchema.parse(row.itemKind),
					itemName: row.itemName,
					proposedBundleId: row.proposedBundleId,
					requiredSetRevisionId: row.requiredSetRevisionId,
					status: row.status,
				})),
			revisionId: header.revisionId,
			revisionNumber: header.revisionNumber,
		}));
	}

	return {
		async findDraft(projectId, draftId) {
			const headers = await db
				.select()
				.from(deliveryFulfilmentDrafts)
				.where(
					and(
						eq(deliveryFulfilmentDrafts.projectId, projectId),
						eq(deliveryFulfilmentDrafts.id, draftId)
					)
				);
			return (await hydrate(headers))[0] ?? null;
		},
		async insertDraft(draft) {
			try {
				// One batch (the neon-http driver has no interactive transaction): header and rows land together.
				const header = db.insert(deliveryFulfilmentDrafts).values({
					bundleChecks: draft.bundleChecks,
					createdAt: draft.createdAt,
					createdByUserId: draft.createdByUserId,
					deliveryTargetId: draft.deliveryTargetId,
					id: draft.id,
					projectId: draft.projectId,
					requestDigest: draft.requestDigest,
					revisionId: draft.revisionId,
					revisionNumber: draft.revisionNumber,
				});
				if (draft.requirements.length === 0) {
					await header;
				} else {
					await db.batch([
						header,
						db.insert(deliveryFulfilmentDraftRequirements).values(
							draft.requirements.map((requirement, position) => ({
								assetFamilyId: requirement.assetFamilyId,
								assetFamilyName: requirement.assetFamilyName,
								candidates: requirement.candidates,
								draftId: draft.id,
								id: `${draft.id}:${position}`,
								itemId: requirement.itemId,
								itemKind: requirement.itemKind,
								itemName: requirement.itemName,
								position,
								projectId: draft.projectId,
								proposedBundleId: requirement.proposedBundleId,
								requiredSetRevisionId: requirement.requiredSetRevisionId,
								status: requirement.status,
							}))
						),
					]);
				}
				return { status: "inserted" };
			} catch (error) {
				if (isUniqueViolation(error)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async listDrafts(projectId, deliveryTargetId) {
			const headers = await db
				.select()
				.from(deliveryFulfilmentDrafts)
				.where(
					and(
						eq(deliveryFulfilmentDrafts.projectId, projectId),
						eq(deliveryFulfilmentDrafts.deliveryTargetId, deliveryTargetId)
					)
				)
				.orderBy(
					desc(deliveryFulfilmentDrafts.createdAt),
					desc(deliveryFulfilmentDrafts.id)
				);
			return hydrate(headers);
		},
	};
}
