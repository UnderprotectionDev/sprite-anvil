import { isDeepStrictEqual } from "node:util";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	type VfxSynchronizationInput,
	type VfxSynchronizationRecord,
	vfxSynchronizationInputSchema,
	vfxSynchronizationListInputSchema,
	vfxSynchronizationRecordSchema,
} from "../vfx-synchronization";
import {
	makeVfxProfileManifest,
	vfxProfileManifestSchema,
} from "../vfx-synchronization-export";

function getUserId(context: Context) {
	if (!context.session) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return context.session.user.id;
}

function getStore(context: Context) {
	if (!context.vfxSynchronizationStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR");
	}
	return context.vfxSynchronizationStore;
}
async function recordsFor(
	context: Context,
	input: { projectId: string; assetFamilyId: string }
) {
	const records = await getStore(context).list(
		getUserId(context),
		input.projectId,
		input.assetFamilyId
	);
	if (!records) {
		throw new ORPCError("NOT_FOUND", { message: "Asset Family not found." });
	}
	return records;
}
function validateFrames(
	input: VfxSynchronizationInput,
	catalog: Awaited<ReturnType<Context["assetVersionStore"]["list"]>>,
	version: NonNullable<
		Awaited<ReturnType<Context["assetVersionStore"]["list"]>>
	>["assetVersions"][number],
	category: string | null | undefined,
	dimensions: { width: number; height: number }
) {
	for (const frame of [...input.effect.frames, ...input.owner.frames].filter(
		(f) => f.assetVersionId === version.id
	)) {
		const effect = input.effect.frames.includes(frame);
		const categoryAllowed = effect
			? category === "visual_effect_projectile_shadow_mark" &&
				version.assetFamilyId === input.assetFamilyId
			: [
					"character_creature_animation",
					"object_weapon_equipment_states",
				].includes(category ?? "");
		const unit = catalog?.unitVersions.find(
			(u) =>
				u.id === frame.unitVersionId &&
				u.projectId === input.projectId &&
				u.assetVersionId === version.id &&
				u.assetRecordId === version.assetRecordId &&
				u.unitType === "frame" &&
				u.unitKey === frame.frameKey
		);
		if (
			!(categoryAllowed && unit) ||
			frame.region.x + frame.region.width > dimensions.width ||
			frame.region.y + frame.region.height > dimensions.height
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Broken frame reference, category or image region. Overflow permission cannot waive integrity.",
			});
		}
	}
}

async function pinVersions(context: Context, input: VfxSynchronizationInput) {
	const userId = getUserId(context);
	const catalog = await context.assetVersionStore.list(userId, input.projectId);
	const frames = [...input.effect.frames, ...input.owner.frames];
	const ids = [
		...new Set([
			...frames.map((f) => f.assetVersionId),
			input.sceneAssetVersionId,
		]),
	];
	return await Promise.all(
		ids.map(async (assetVersionId) => {
			const version = catalog?.assetVersions.find(
				(v) => v.id === assetVersionId && v.projectId === input.projectId
			);
			const record =
				version &&
				(await context.assetRecordStore.get(
					userId,
					input.projectId,
					version.assetRecordId
				));
			if (
				!(
					version?.integrityVerified &&
					version.contentDigest &&
					record &&
					record.availability !== "erased" &&
					(await context.verifyAssetVersionContent?.(
						userId,
						input.projectId,
						assetVersionId
					))
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Every pinned image must be intact and accessible.",
				});
			}
			const dimensions = await context.readVfxImageDimensions?.(
				userId,
				input.projectId,
				assetVersionId
			);
			if (
				!dimensions ||
				(input.effect.frames.some((f) => f.assetVersionId === assetVersionId) &&
					!dimensions.hasAlpha)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Image dimensions or alpha data could not be read.",
				});
			}
			validateFrames(input, catalog, version, record.assetCategory, dimensions);

			if (
				assetVersionId === input.sceneAssetVersionId &&
				record.assetCategory !== "background_parallax"
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Choose a background Asset Version for the scene.",
				});
			}
			return {
				assetVersionId,
				assetRecordId: version.assetRecordId,
				assetFamilyId: version.assetFamilyId,
				contentDigest: version.contentDigest,
				...dimensions,
			};
		})
	);
}
async function pinWaivers(context: Context, input: VfxSynchronizationInput) {
	if (!input.waiverEvidenceIds.length) {
		return [];
	}
	const readiness = await context.familyReadinessStore?.list(
		getUserId(context),
		input.projectId,
		input.assetFamilyId
	);
	const evidence =
		readiness?.items.flatMap((item) => item.latestEvidence) ?? [];
	return input.waiverEvidenceIds.map((id) => {
		const waiver = evidence.find(
			(e) =>
				e.id === id &&
				e.kind === "quality" &&
				e.result === "waived" &&
				e.ruleId === "effect.cell_overflow" &&
				e.ruleClass === "waivable_requirement" &&
				e.isCurrent &&
				e.profileContractRevisionIds.includes(input.contractRevisionId) &&
				e.versionTarget?.kind === "unit" &&
				input.effect.frames.some(
					(f) =>
						f.unitVersionId === e.versionTarget?.id &&
						e.assetVersionIds.includes(f.assetVersionId)
				)
		);
		if (!waiver) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Only a current, exact effect.cell_overflow Quality Waiver can be pinned.",
			});
		}
		return waiver;
	});
}
const vfxEvidencePackageSchema = z
	.object({
		format: z.literal("sprite-anvil.vfx-synchronization"),
		schemaVersion: z.literal("1.0.0"),
		record: vfxSynchronizationRecordSchema,
		profileManifest: vfxProfileManifestSchema,
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();
async function makeVfxEvidencePackage(record: VfxSynchronizationRecord) {
	const payload = {
		format: "sprite-anvil.vfx-synchronization" as const,
		schemaVersion: "1.0.0" as const,
		record,
		profileManifest: makeVfxProfileManifest(record),
	};
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(JSON.stringify(payload))
	);
	return {
		...payload,
		contentDigest: Array.from(new Uint8Array(digest), (v) =>
			v.toString(16).padStart(2, "0")
		).join(""),
	};
}
const targetSchema = vfxSynchronizationListInputSchema
	.extend({ recordId: z.uuid() })
	.strict();
export const vfxSynchronizationRouter = {
	list: protectedProcedure
		.input(vfxSynchronizationListInputSchema)
		.output(z.array(vfxSynchronizationRecordSchema))
		.handler(async ({ context, input }) => await recordsFor(context, input)),
	save: protectedProcedure
		.input(vfxSynchronizationInputSchema)
		.output(vfxSynchronizationRecordSchema)
		.handler(async ({ context, input }) => {
			const records = await recordsFor(context, input);
			const existing = records.find((r) => r.id === input.id);
			if (existing) {
				if (
					!isDeepStrictEqual(
						vfxSynchronizationInputSchema.strip().parse(existing),
						input
					)
				) {
					throw new ORPCError("CONFLICT", {
						message: "Review operation id reused with different input.",
					});
				}
				return existing;
			}
			if (input.sourceReviewId) {
				const source = records.find((r) => r.id === input.sourceReviewId);
				if (!(source && isDeepStrictEqual(source.event, input.event))) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Selective repair must preserve the source event and clip-relative time.",
					});
				}
			}
			const activation =
				await context.specializedProfileContractStore?.getActive(
					context.session.user.id,
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
					message: "Profile contract changed. Reload before reviewing.",
				});
			}
			const versionPins = await pinVersions(context, input);
			const waiverEvidence = await pinWaivers(context, input);
			const record = vfxSynchronizationRecordSchema.parse({
				...input,
				versionPins,
				waiverEvidence,
				contractSnapshot: activation.contract,
				reviewedByUserId: context.session.user.id,
				createdAt: new Date().toISOString(),
			});
			const saved = await getStore(context).append(
				context.session.user.id,
				record
			);
			if (!saved) {
				throw new ORPCError("CONFLICT", {
					message: "Review targets changed. Reload current records.",
				});
			}
			const persisted = (await recordsFor(context, input)).find(
				(r) => r.id === saved.id
			);
			if (!isDeepStrictEqual(persisted, saved)) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Review readback failed.",
				});
			}
			return saved;
		}),
	exportEvidence: protectedProcedure
		.input(targetSchema)
		.output(vfxEvidencePackageSchema)
		.handler(async ({ context, input }) => {
			const record = (await recordsFor(context, input)).find(
				(r) => r.id === input.recordId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			// Failed/inconclusive playback remains evidence; it never establishes profile completion.
			const pins = await pinVersions(context, record);
			if (!isDeepStrictEqual(pins, record.versionPins)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Pinned content changed; evidence export stopped.",
				});
			}
			return await makeVfxEvidencePackage(record);
		}),
	readEvidence: protectedProcedure
		.input(targetSchema.extend({ package: vfxEvidencePackageSchema }).strict())
		.output(vfxEvidencePackageSchema)
		.handler(async ({ context, input }) => {
			const record = (await recordsFor(context, input)).find(
				(r) => r.id === input.recordId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND");
			}
			const expected = await makeVfxEvidencePackage(record);
			if (!isDeepStrictEqual(input.package, expected)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Evidence package differs from the immutable review.",
				});
			}
			return expected;
		}),
};
