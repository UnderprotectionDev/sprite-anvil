import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import {
	directionalReviewInputSchema,
	directionalReviewListInputSchema,
	directionalReviewRecordSchema,
} from "../directional-reviews";
import { protectedProcedure } from "../index";

function getStore(context: Context) {
	if (!context.directionalReviewStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.directionalReviewStore;
}
export const directionalReviewsRouter = {
	list: protectedProcedure
		.input(directionalReviewListInputSchema)
		.output(z.array(directionalReviewRecordSchema))
		.handler(async ({ context, input }) => {
			const records = await getStore(context).list(
				context.session.user.id,
				input.projectId,
				input.assetFamilyId
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found.",
				});
			}
			return records;
		}),
	save: protectedProcedure
		.input(directionalReviewInputSchema)
		.output(directionalReviewRecordSchema)
		.handler(async ({ context, input }) => {
			const store = getStore(context);
			const userId = context.session.user.id;
			const records = await store.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Family not found.",
				});
			}
			const existing = records.find((candidate) => candidate.id === input.id);
			if (existing) {
				if (
					!isDeepStrictEqual(
						directionalReviewInputSchema.strip().parse(existing),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Review operation id was reused with different input.",
					});
				}
				return existing;
			}
			const catalog = await context.assetVersionStore.list(
				userId,
				input.projectId
			);
			const canonicalDesign = catalog?.canonicalDesigns
				.filter((design) => design.assetFamilyId === input.assetFamilyId)
				.at(-1);
			if (!canonicalDesign || canonicalDesign.id !== input.canonicalDesignId) {
				throw new ORPCError("CONFLICT", {
					message: "Canonical Design changed. Reload before reviewing.",
				});
			}
			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					"character_creature_animation"
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Activate the character Specialized Profile Contract first.",
				});
			}
			if (activation.contractRevisionId !== input.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Reload before reviewing.",
				});
			}
			const versionIds = [
				...new Set([
					canonicalDesign.assetVersionId,
					...input.directions.flatMap((direction) =>
						direction.frames.map((frame) => frame.assetVersionId)
					),
				]),
			];
			// The accessible set excludes versions of erased records, so a frame
			// referencing erased content fails here instead of at the write gate.
			const accessibleVersionIds =
				(await store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				)) ?? new Set<string>();
			const versionPins = await Promise.all(
				versionIds.map(async (assetVersionId) => {
					const version = catalog?.assetVersions.find(
						(candidate) =>
							candidate.id === assetVersionId &&
							candidate.assetFamilyId === input.assetFamilyId
					);
					if (
						!(
							version &&
							accessibleVersionIds.has(version.id) &&
							version.integrityVerified &&
							version.contentDigest &&
							(await context.verifyAssetVersionContent?.(
								userId,
								input.projectId,
								assetVersionId
							))
						)
					) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Every compared frame must reference an intact Asset Version in this family.",
						});
					}
					return { assetVersionId, contentDigest: version.contentDigest };
				})
			);
			const record = directionalReviewRecordSchema.parse({
				...input,
				canonicalAssetVersionId: canonicalDesign.assetVersionId,
				versionPins,
				contractSnapshot: activation.contract,
				reviewedByUserId: userId,
				createdAt: new Date().toISOString(),
			});
			const saved = await store.append(userId, record);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message:
						"Review target changed or operation id was reused. Check current records.",
				});
			}
			const readback = await store.list(
				userId,
				input.projectId,
				input.assetFamilyId
			);
			const persisted = readback?.find(
				(candidate) => candidate.id === saved.id
			);
			if (!(persisted && isDeepStrictEqual(persisted, saved))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
			return persisted;
		}),
};
