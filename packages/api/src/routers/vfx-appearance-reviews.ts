import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { AssetVersionCatalog } from "../asset-versions";
import type { Context } from "../context";
import type { ReadinessEvidence } from "../family-readiness";
import { protectedProcedure } from "../index";
import type { SpecializedProfileContract } from "../specialized-profile-contracts";
import type { VfxAppearanceInput } from "../vfx-appearance-reviews";
import {
	measureVfxOverflow,
	vfxAppearanceInputSchema,
	vfxAppearanceListInputSchema,
	vfxAppearanceRecordSchema,
} from "../vfx-appearance-reviews";

function getStore(context: Context) {
	if (!context.vfxAppearanceReviewStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.vfxAppearanceReviewStore;
}

async function validateFrames(
	context: Context,
	userId: string,
	input: VfxAppearanceInput,
	catalog: AssetVersionCatalog | null
) {
	const assetRecords = await context.assetRecordStore.list(
		userId,
		input.projectId
	);
	for (const frame of input.frames) {
		const version = catalog?.assetVersions.find(
			(candidate) => candidate.id === frame.assetVersionId
		);
		const assetRecord = assetRecords?.find(
			(candidate) => candidate.id === version?.assetRecordId
		);
		const dimensions = version?.sourceImageDimensions;
		if (
			!version ||
			version.assetFamilyId !== input.assetFamilyId ||
			assetRecord?.assetCategory !== "visual_effect_projectile_shadow_mark" ||
			assetRecord.availability === "erased" ||
			!dimensions ||
			frame.region.x + frame.region.width > dimensions.width ||
			frame.region.y + frame.region.height > dimensions.height ||
			// biome-ignore lint/performance/noAwaitInLoops: Decode one source frame at a time to bound image memory.
			!(await context.verifyVfxFrameContent?.(userId, input.projectId, frame))
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Effect frames require readable image and alpha data, valid source regions, and intact VFX versions.",
			});
		}
	}
	const scene = catalog?.assetVersions.find(
		(version) => version.id === input.sceneAssetVersionId
	);
	const dimensions = scene?.sourceImageDimensions;
	if (
		!(
			dimensions &&
			(await context.verifyVfxFrameContent?.(userId, input.projectId, {
				assetVersionId: input.sceneAssetVersionId,
				frameKey: "scene",
				durationMs: 1,
				region: { x: 0, y: 0, ...dimensions },
				offset: { x: 0, y: 0 },
			}))
		)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "The actual scene requires readable image and alpha data.",
		});
	}
}

async function reviewOverflow(
	context: Context,
	userId: string,
	input: VfxAppearanceInput,
	catalog: AssetVersionCatalog | null,
	contract: SpecializedProfileContract
) {
	const measuredOverflowPx = measureVfxOverflow(input);
	const overflowRule = contract.rules.find(
		(rule) => rule.id === "effect.cell_overflow"
	);
	if (overflowRule?.class !== "waivable_requirement") {
		throw new ORPCError("BAD_REQUEST", {
			message: "The active contract does not define the effect overflow rule.",
		});
	}
	let qualityWaiverSnapshot: ReadinessEvidence | null = null;
	if (input.qualityWaiverEvidenceId) {
		const readiness = await context.familyReadinessStore?.list(
			userId,
			input.projectId,
			input.assetFamilyId
		);
		const evidence = readiness?.items
			.flatMap((item) => item.latestEvidence)
			.find((item) => item.id === input.qualityWaiverEvidenceId);
		const target = evidence?.versionTarget;
		const targetUnits =
			target?.kind === "unit"
				? catalog?.unitVersions.filter((unit) => unit.id === target.id)
				: catalog?.unitVersions.filter((unit) =>
						catalog.compositeVersions
							.find((composite) => composite.id === target?.id)
							?.compositionMemberships.some(
								(member) => member.unitVersionId === unit.id
							)
					);

		if (
			!(overflowRule.waiverEligibility && evidence) ||
			evidence.kind !== "quality" ||
			evidence.result !== "waived" ||
			!evidence.isCurrent ||
			evidence.ruleId !== "effect.cell_overflow" ||
			!evidence.profileContractRevisionIds.includes(input.contractRevisionId) ||
			evidence.observedValue !== `${measuredOverflowPx} px` ||
			!targetUnits ||
			input.frames.some(
				(frame) =>
					!targetUnits.some(
						(unit) =>
							unit.assetVersionId === frame.assetVersionId &&
							unit.unitKey === frame.frameKey
					)
			)
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Choose a current, exact-version cell overflow Quality Waiver matching the measured overflow.",
			});
		}
		qualityWaiverSnapshot = evidence;
	}
	if (
		measuredOverflowPx > 0 &&
		!input.overflowAllowed &&
		!qualityWaiverSnapshot &&
		input.outcome === "passed"
	) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Unpermitted cell overflow cannot pass without an explicit version-specific Quality Waiver.",
		});
	}
	if (input.overflowAllowed && !overflowRule.waiverEligibility) {
		throw new ORPCError("BAD_REQUEST", {
			message: "This profile does not permit an overflow exception.",
		});
	}

	return { measuredOverflowPx, qualityWaiverSnapshot };
}

export const vfxAppearanceReviewsRouter = {
	list: protectedProcedure
		.input(vfxAppearanceListInputSchema)
		.output(z.array(vfxAppearanceRecordSchema))
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
		.input(vfxAppearanceInputSchema)
		.output(vfxAppearanceRecordSchema)
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
						vfxAppearanceInputSchema.strip().parse(existing),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Review operation id was reused with different input.",
					});
				}
				return existing;
			}

			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					"visual_effect_projectile_shadow_mark"
				);
			if (!activation) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Activate the effect Specialized Profile Contract first.",
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
					...input.frames.map((frame) => frame.assetVersionId),
					input.sceneAssetVersionId,
				]),
			];
			const accessibleVersionIds =
				(await store.listAccessibleVersionIds(
					userId,
					input.projectId,
					input.assetFamilyId
				)) ?? new Set<string>();
			const catalog = await context.assetVersionStore.list(
				userId,
				input.projectId
			);
			const versionPins = await Promise.all(
				versionIds.map(async (assetVersionId) => {
					const version = catalog?.assetVersions.find(
						(candidate) =>
							candidate.id === assetVersionId &&
							(candidate.id === input.sceneAssetVersionId ||
								candidate.assetFamilyId === input.assetFamilyId)
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
								"Effect and scene previews require intact, accessible Asset Versions.",
						});
					}
					return { assetVersionId, contentDigest: version.contentDigest };
				})
			);

			await validateFrames(context, userId, input, catalog);
			const { measuredOverflowPx, qualityWaiverSnapshot } =
				await reviewOverflow(
					context,
					userId,
					input,
					catalog,
					activation.contract
				);

			const record = vfxAppearanceRecordSchema.parse({
				...input,
				measuredOverflowPx,
				qualityWaiverSnapshot,
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
