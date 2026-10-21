import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	getVfxEffectTime,
	getVfxFrameAt,
} from "@sprite-anvil/api/vfx-synchronization";

const frame = (
	assetVersionId: string,
	unitVersionId: string,
	durationMs: number
) => ({
	assetVersionId,
	unitVersionId,
	frameKey: unitVersionId,
	durationMs,
	region: { x: 0, y: 0, width: 16, height: 16 },
	origin: { x: 8, y: 12 },
});
const input = {
	id: "8a3bf45a-0039-4761-b996-b0d45f732877",
	projectId: "project",
	assetFamilyId: "effects",
	contractRevisionId: "effect@1",
	name: "Knight cast",
	effect: {
		looping: false,
		frames: [frame("effect", "spark", 80), frame("effect-glow", "glow", 220)],
	},
	owner: {
		looping: false,
		frames: [
			frame("owner", "cast", 100),
			frame("owner-release", "release", 400),
		],
	},
	event: { id: "spell-release", timeMs: 150 },
	layer: 1,
	sceneAssetVersionId: "scene",
	overflowAllowed: true,
	waiverEvidenceIds: [],
	backgrounds: ["transparent", "light", "dark", "scene"].map((background) => ({
		background,
		alone: "passed",
		synchronized: "passed",
		notes: "Origin and timing checked.",
	})),
	rationale: "Spell starts at release.",
};
function setup() {
	const records: unknown[] = [];
	const versions = [
		"effect",
		"effect-glow",
		"owner",
		"owner-release",
		"scene",
	].map((id, index) => ({
		id,
		projectId: "project",
		assetRecordId: id.split("-")[0],
		assetFamilyId: id.startsWith("effect") ? "effects" : id.split("-")[0],
		integrityVerified: true,
		contentDigest: String(index + 1).repeat(64),
		contentType: "image/png",
		contentLength: 91,
		versionNumber: 1,
	}));
	const units = [...input.effect.frames, ...input.owner.frames].map((f) => ({
		id: f.unitVersionId,
		assetVersionId: f.assetVersionId,
		unitKey: f.frameKey,
		unitType: "frame",
		projectId: "project",
		assetRecordId: f.assetVersionId.split("-")[0],
	}));
	const context = {
		session: { user: { id: "owner" } },
		vfxSynchronizationStore: {
			list: (userId: string, projectId: string) =>
				userId === "owner" && projectId === "project" ? records : null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
		},
		assetVersionStore: {
			list: () => ({ assetVersions: versions, unitVersions: units }),
		},
		assetRecordStore: {
			get: (_u: string, _p: string, id: string) => ({
				id,
				availability: "active",
				assetCategory: {
					effect: "visual_effect_projectile_shadow_mark",
					owner: "character_creature_animation",
					scene: "background_parallax",
				}[id],
			}),
		},
		verifyAssetVersionContent: () => true,
		readVfxImageDimensions: () => ({ width: 16, height: 16, hasAlpha: true }),
		specializedProfileContractStore: {
			getActive: () => ({
				contractRevisionId: "effect@1",
				contract: specializedProfileContractCatalog.find(
					(c) => c.profileId === "visual_effect_projectile_shadow_mark"
				),
			}),
		},
	};
	return { context, records, versions, units };
}
async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	if (!routers.vfxSynchronization) {
		throw new Error("VFX synchronization API unavailable");
	}
	return await call(
		routers.vfxSynchronization[operation] as never,
		request as never,
		{ context: context as never }
	);
}
test("pins owner, effect and scene and rereads variable timing without shifting the clip-relative event", async () => {
	const { context, records } = setup();
	const saved = await invoke("save", input, context);
	expect(saved).toMatchObject({
		event: { id: "spell-release", timeMs: 150 },
		layer: 1,
		effect: { frames: [{ durationMs: 80 }, { durationMs: 220 }] },
		reviewedByUserId: "owner",
	});
	expect(
		await invoke(
			"list",
			{ projectId: "project", assetFamilyId: "effects" },
			context
		)
	).toEqual([saved]);
	expect(await invoke("save", input, context)).toEqual(saved);
	expect(records).toHaveLength(1);
});

test("rejects missing sessions, inaccessible targets, inactive or stale contracts and corrupt images even with overflow permission", async () => {
	const { context, records } = setup();
	await expect(
		invoke("save", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke("save", input, { ...context, session: { user: { id: "outsider" } } })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		invoke("save", input, {
			...context,
			specializedProfileContractStore: { getActive: () => null },
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", { ...input, contractRevisionId: "old" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		invoke("save", input, {
			...context,
			verifyAssetVersionContent: () => false,
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", input, { ...context, readVfxImageDimensions: () => null })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", input, {
			...context,
			readVfxImageDimensions: () => ({
				width: 16,
				height: 16,
				hasAlpha: false,
			}),
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
});
test("rejects broken frame links, out-of-image rectangles, unavailable backgrounds and invalid event times", async () => {
	const { context, records } = setup();
	const badFrame = { ...input.effect.frames[0], unitVersionId: "missing" };
	for (const request of [
		{ ...input, effect: { ...input.effect, frames: [badFrame] } },
		{
			...input,
			effect: {
				...input.effect,
				frames: [
					{
						...input.effect.frames[0],
						region: { x: 8, y: 0, width: 16, height: 16 },
					},
				],
			},
		},
		{ ...input, sceneAssetVersionId: "other-project" },
		{ ...input, event: { ...input.event, timeMs: 500 } },
		{
			...input,
			effect: {
				...input.effect,
				frames: [{ ...input.effect.frames[0], durationMs: 0 }],
			},
		},
		{ ...input, backgrounds: input.backgrounds.slice(0, 3) },
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Validate each independent API rejection sequentially.
		await expect(invoke("save", request, context)).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	}
	expect(records).toHaveLength(0);
});
test("exports exact origins, timing, layers and test outcomes and rejects tampered readback", async () => {
	const { context } = setup();
	await invoke("save", input, context);
	const target = {
		projectId: "project",
		assetFamilyId: "effects",
		recordId: input.id,
	};
	const exported = await invoke("exportEvidence", target, context);
	expect(exported).toMatchObject({
		format: "sprite-anvil.vfx-synchronization",
		profileManifest: {
			effect: {
				event_id: "spell-release",
				event_time_ms: 150,
				layer: 1,
				frames: [
					{ id: "spark", order: 0, duration_ms: 80 },
					{ id: "glow", order: 1, duration_ms: 220 },
				],
			},
		},
		record: {
			event: { timeMs: 150 },
			effect: {
				frames: [
					{ origin: { x: 8, y: 12 }, durationMs: 80 },
					{ durationMs: 220 },
				],
			},
			layer: 1,
			overflowAllowed: true,
			waiverEvidence: [],
		},
	});
	expect(
		await invoke("readEvidence", { ...target, package: exported }, context)
	).toEqual(exported);
	await expect(
		invoke(
			"readEvidence",
			{
				...target,
				package: {
					...(exported as Record<string, unknown>),
					contentDigest: "f".repeat(64),
				},
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
test("selective repair keeps event time and requires new waiver evidence for new exact units", async () => {
	const { context, records, units, versions } = setup();
	await invoke("save", input, context);
	const [sourceUnit] = units;
	if (!sourceUnit) {
		throw new Error("Source unit missing");
	}
	const [sourceVersion] = versions;
	if (!sourceVersion) {
		throw new Error("Source version missing");
	}
	versions.push({ ...sourceVersion, id: "effect-repair" });
	units.push({
		...sourceUnit,
		id: "repaired",
		unitKey: "repaired",
		assetVersionId: "effect-repair",
	});
	const repaired = {
		...input,
		id: crypto.randomUUID(),
		sourceReviewId: input.id,
		effect: {
			...input.effect,
			frames: [frame("effect-repair", "repaired", 250), input.effect.frames[1]],
		},
	};
	expect(await invoke("save", repaired, context)).toMatchObject({
		event: { timeMs: 150 },
		sourceReviewId: input.id,
	});
	await expect(
		invoke(
			"save",
			{
				...repaired,
				id: crypto.randomUUID(),
				event: { ...input.event, timeMs: 200 },
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke(
			"save",
			{
				...repaired,
				id: crypto.randomUUID(),
				waiverEvidenceIds: ["forged-integrity-waiver"],
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("save", { ...input, rationale: "Altered replay" }, context)
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(records).toHaveLength(2);
});

test("plays variable durations and carries an event-triggered effect across an owner loop boundary", () => {
	const clip = {
		looping: false,
		frames: [frame("a", "first", 80), frame("b", "second", 220)],
	};
	expect(getVfxFrameAt(clip, 79)?.frameKey).toBe("first");
	expect(getVfxFrameAt(clip, 80)?.frameKey).toBe("second");
	expect(getVfxFrameAt(clip, 300)).toBeNull();
	expect(getVfxFrameAt({ ...clip, looping: true }, 300)?.frameKey).toBe(
		"first"
	);
	const owner = { ...clip, looping: true };
	expect(getVfxEffectTime(owner, 250, 249)).toBe(-1);
	expect(getVfxEffectTime(owner, 250, 300)).toBe(50);
	expect(getVfxEffectTime(owner, 250, 550)).toBe(0);
});

test("pins only an exact current overflow waiver and preserves failed or inconclusive user evidence", async () => {
	const { context } = setup();
	const waiver = {
		id: "overflow-waiver",
		projectId: "project",
		assetFamilyId: "effects",
		revisionId: "revision",
		itemId: "spark",
		kind: "quality",
		result: "waived",
		assetVersionIds: ["effect"],
		profileContractRevisionIds: ["effect@1"],
		contextRevisionId: null,
		visualWorldId: "world",
		useContext: "spell",
		canonicalDesignVersionId: null,
		ruleId: "effect.cell_overflow",
		ruleClass: "waivable_requirement",
		testId: null,
		usageTestContext: null,
		usageVariant: null,
		targetDimensions: null,
		grayscaleReviewed: null,
		observedValue: "2px",
		versionTarget: { kind: "unit", id: "spark" },
		method: "human",
		rationale: "Intentional trail",
		createdAt: "2026-10-11T09:00:00.000Z",
		createdByUserId: "owner",
		isCurrent: true,
	};
	const withWaiver = {
		...context,
		familyReadinessStore: {
			list: () => ({ items: [{ latestEvidence: [waiver] }] }),
		},
	};
	const request = {
		...input,
		waiverEvidenceIds: [waiver.id],
		backgrounds: input.backgrounds.map((b) => ({
			...b,
			alone: "failed",
			synchronized: "inconclusive",
		})),
	};
	expect(await invoke("save", request, withWaiver)).toMatchObject({
		waiverEvidence: [waiver],
		backgrounds: request.backgrounds,
	});
	const target = {
		projectId: "project",
		assetFamilyId: "effects",
		recordId: input.id,
	};
	expect(await invoke("exportEvidence", target, withWaiver)).toMatchObject({
		profileManifest: { waiver_evidence_ids: [waiver.id] },
	});
	await expect(
		invoke(
			"save",
			{ ...request, id: crypto.randomUUID() },
			{
				...context,
				familyReadinessStore: {
					list: () => ({
						items: [{ latestEvidence: [{ ...waiver, isCurrent: false }] }],
					}),
				},
			}
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
