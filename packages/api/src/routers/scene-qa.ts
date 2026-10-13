import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	type SceneQaInput,
	type SceneQaRecord,
	sceneQaInputSchema,
	sceneQaListInputSchema,
	sceneQaRecordSchema,
	sceneQaRoleProfiles,
} from "../scene-qa";

async function access(context: Context, userId: string, projectId: string) {
	if (!(await context.projectAccess.getProject(userId, projectId))) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found." });
	}
	if (!context.sceneQaStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.sceneQaStore;
}
function sameInput(record: unknown, input: SceneQaInput) {
	return isDeepStrictEqual(
		sceneQaInputSchema.safeExtend({}).strip().parse(record),
		input
	);
}
async function resolvePins(
	context: Context,
	userId: string,
	input: SceneQaInput
) {
	const [catalog, assets] = await Promise.all([
		context.assetVersionStore.list(userId, input.projectId),
		context.assetRecordStore.list(userId, input.projectId),
	]);
	const versionPins: SceneQaRecord["versionPins"] = [];
	const profilePins: SceneQaRecord["profilePins"] = [];
	const placements = await Promise.all(
		input.setup.placements.map(async (placement) => {
			const version = catalog?.assetVersions.find(
				(v) => v.id === placement.assetVersionId
			);
			const asset = assets?.find((a) => a.id === version?.assetRecordId);
			if (
				!(
					version?.integrityVerified &&
					version.contentDigest &&
					version.sourceImageDimensions &&
					asset
				) ||
				asset.availability === "erased" ||
				asset.assetCategory !== sceneQaRoleProfiles[placement.role]
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Select an intact matching Asset Version from this project.",
				});
			}
			const activation =
				await context.specializedProfileContractStore?.getActive(
					userId,
					input.projectId,
					sceneQaRoleProfiles[placement.role]
				);
			if (activation?.contractRevisionId !== placement.contractRevisionId) {
				throw new ORPCError("CONFLICT", {
					message:
						"Specialized Profile Contract changed. Reload current profiles before testing.",
				});
			}
			if (
				!activation.contract.usageTests.some(
					(t) => t.id === placement.usageTestId
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Select a usage test declared by the pinned profile.",
				});
			}
			return {
				versionPin: {
					assetVersionId: version.id,
					assetRecordId: asset.id,
					assetFamilyId: version.assetFamilyId,
					assetRecordName: asset.name,
					versionNumber: version.versionNumber,
					contentDigest: version.contentDigest,
					...version.sourceImageDimensions,
				},
				profilePin: {
					contractRevisionId: activation.contractRevisionId,
					profileId: activation.contract.profileId,
					contractSnapshot: activation.contract,
				},
			};
		})
	);
	for (const { versionPin, profilePin } of placements) {
		if (
			!versionPins.some((p) => p.assetVersionId === versionPin.assetVersionId)
		) {
			versionPins.push(versionPin);
		}
		if (
			!profilePins.some(
				(p) => p.contractRevisionId === profilePin.contractRevisionId
			)
		) {
			profilePins.push(profilePin);
		}
	}
	return { versionPins, profilePins };
}
export const sceneQaRouter = {
	list: protectedProcedure
		.input(sceneQaListInputSchema)
		.output(z.array(sceneQaRecordSchema))
		.handler(async ({ context, input }) => {
			const store = await access(
				context,
				context.session.user.id,
				input.projectId
			);
			const records = await store.list(
				context.session.user.id,
				input.projectId
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND");
			}
			return records;
		}),
	save: protectedProcedure
		.input(sceneQaInputSchema)
		.output(sceneQaRecordSchema)
		.handler(async ({ context, input }) => {
			const store = await access(
				context,
				context.session.user.id,
				input.projectId
			);
			const userId = context.session.user.id;
			const records = await store.list(userId, input.projectId);
			if (!records) {
				throw new ORPCError("NOT_FOUND");
			}
			const existing = records.find((r) => r.id === input.id);
			if (existing) {
				if (!sameInput(existing, input)) {
					throw new ORPCError("CONFLICT", {
						message: "Scene operation id was reused with different input.",
					});
				}
				return existing;
			}
			const { versionPins, profilePins } = await resolvePins(
				context,
				userId,
				input
			);
			const readable = await Promise.all(
				versionPins.map((pin) =>
					context.verifyAssetVersionContent?.(
						userId,
						input.projectId,
						pin.assetVersionId
					)
				)
			);
			if (readable.some((r) => r !== true)) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Exact scene content is unreadable or failed integrity verification.",
				});
			}
			const parsed = sceneQaRecordSchema.safeParse({
				...input,
				versionPins,
				profilePins,
				createdAt: new Date().toISOString(),
				createdByUserId: userId,
			});
			if (!parsed.success) {
				throw new ORPCError("BAD_REQUEST", {
					message: parsed.error.issues.map((i) => i.message).join(" "),
				});
			}
			const saved = await store.append(userId, parsed.data);
			if (!(saved && sameInput(saved, input))) {
				throw new ORPCError("CONFLICT", {
					message:
						"Scene targets changed or the operation id was reused. Check saved evidence.",
				});
			}
			const readback = (await store.list(userId, input.projectId))?.find(
				(r) => r.id === saved.id
			);
			if (!(readback && isDeepStrictEqual(saved, readback))) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Scene evidence could not be read back after saving.",
				});
			}
			return readback;
		}),
};
