import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";

test("Scene QA Playground rejects unauthenticated and expired sessions", async () => {
	await expect(
		call(
			appRouter.sceneQa.list,
			{ projectId: "private" },
			{ context: { session: null } as Context }
		)
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

import type { SceneQaInput, SceneQaRecord } from "@sprite-anvil/api/scene-qa";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const contract = specializedProfileContractCatalog.find(
	(c) => c.profileId === "object_weapon_equipment_states"
);
if (!contract) {
	throw new Error("Missing object contract fixture");
}
const input: SceneQaInput = {
	id: "00000000-0000-4000-8000-000000000135",
	projectId: "project",
	name: "Forest comparison",
	setup: {
		width: 640,
		height: 360,
		durationMs: 4000,
		camera: "fixed",
		contrast: "dark",
		ySort: true,
		showOverlays: true,
		movement: { x: 64, y: 32 },
		hitAtMs: 2700,
		placements: [
			{
				id: "object",
				role: "object",
				assetVersionId: "version",
				contractRevisionId: "contract",
				usageTestId: contract.usageTests[0]?.id ?? "missing",
				x: 120,
				y: 180,
				layer: 1,
				scale: 2,
				pivot: { x: 16, y: 32 },
				sortPoint: { x: 16, y: 32 },
				origin: { x: 16, y: 16 },
				groundPoint: { x: 16, y: 32 },
				areas: [],
				clips: {
					idle: [{ x: 0, y: 0, width: 32, height: 32, durationMs: 100 }],
					walk: [],
					attack: [],
				},
			},
		],
	},
	playbackMs: 4000,
	observations: {
		scale: "Scale aligns with the ground.",
		layering: "Object overlaps the actor correctly.",
		transitions: "Static object inspected.",
		events: "No effect in this comparison.",
		camera: "Fixed framing is readable.",
		readability: "Outline remains distinct.",
	},
};
function fixture() {
	const records: SceneQaRecord[] = [];
	const context = {
		session: { user: { id: "owner" } },
		projectAccess: {
			getProject: async (userId: string, projectId: string) =>
				userId === "owner" && projectId === "project"
					? { id: "project" }
					: null,
		},
		assetRecordStore: {
			list: async () => [
				{
					id: "asset",
					projectId: "project",
					assetFamilyId: "family",
					name: "Oak",
					availability: "available",
					assetCategory: "object_weapon_equipment_states",
				},
			],
		},
		assetVersionStore: {
			list: async () => ({
				assetVersions: [
					{
						id: "version",
						projectId: "project",
						assetRecordId: "asset",
						assetFamilyId: "family",
						versionNumber: 1,
						integrityVerified: true,
						contentDigest: "a".repeat(64),
						sourceImageDimensions: { width: 32, height: 32 },
						previewUrl: "/protected/version",
					},
				],
			}),
		},
		specializedProfileContractStore: {
			getActive: async () => ({
				projectId: "project",
				contractRevisionId: "contract",
				contract,
				activatedAt: new Date().toISOString(),
				activatedByUserId: "owner",
			}),
		},
		verifyAssetVersionContent: async () => true,
		sceneQaStore: {
			list: async () => structuredClone(records),
			append: (_user: string, record: SceneQaRecord) => {
				records.push(structuredClone(record));
				return Promise.resolve(record);
			},
		},
	} as unknown as Context;
	return { context, records };
}
test("Scene QA Playground saves exact versions, profiles and observations then rereads immutable evidence", async () => {
	const { context } = fixture();
	const saved = await call(appRouter.sceneQa.save, input, { context });
	expect(saved.versionPins[0]).toMatchObject({
		assetVersionId: "version",
		contentDigest: "a".repeat(64),
		versionNumber: 1,
	});
	expect(saved.profilePins[0]).toMatchObject({
		contractRevisionId: "contract",
		contractSnapshot: contract,
	});
	expect(
		await call(appRouter.sceneQa.list, { projectId: "project" }, { context })
	).toEqual([saved]);
	expect(await call(appRouter.sceneQa.save, input, { context })).toEqual(saved);
	await expect(
		call(
			appRouter.sceneQa.save,
			{ ...input, name: "Different scene" },
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("Scene QA Playground rejects another owner's project without exposing evidence", async () => {
	const { context } = fixture();
	if (!context.session) {
		throw new Error("Missing session fixture");
	}
	context.session.user.id = "stranger";
	await expect(
		call(appRouter.sceneQa.list, { projectId: "project" }, { context })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(appRouter.sceneQa.save, input, { context })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
test("Scene QA Playground refuses unreadable content, changed profiles, invalid frames and incomplete playback", async () => {
	const { context, records } = fixture();
	context.verifyAssetVersionContent = async () => false;
	await expect(
		call(appRouter.sceneQa.save, input, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	context.verifyAssetVersionContent = async () => true;
	await expect(
		call(
			appRouter.sceneQa.save,
			{
				...input,
				setup: {
					...input.setup,
					placements: input.setup.placements.map((p) => ({
						...p,
						contractRevisionId: "stale",
					})),
				},
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		call(
			appRouter.sceneQa.save,
			{
				...input,
				setup: {
					...input.setup,
					placements: input.setup.placements.map((p) => ({
						...p,
						clips: {
							...p.clips,
							idle: [{ x: 20, y: 0, width: 32, height: 32, durationMs: 100 }],
						},
					})),
				},
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		call(appRouter.sceneQa.save, { ...input, playbackMs: 100 }, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toEqual([]);
});
test("Scene QA Playground does not report success after a persistence or readback failure", async () => {
	const { context } = fixture();
	if (!context.sceneQaStore) {
		throw new Error("Missing store fixture");
	}
	context.sceneQaStore.append = async () => null;
	await expect(
		call(appRouter.sceneQa.save, input, { context })
	).rejects.toMatchObject({ code: "CONFLICT" });
	context.sceneQaStore.append = async (_user, record) => record;
	await expect(
		call(appRouter.sceneQa.save, input, { context })
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});

test("Scene QA Playground pins six roles across profiles and rejects missing character states and unsupported usage tests", async () => {
	const { context } = fixture();
	const roles = [
		"tile",
		"background",
		"character",
		"object",
		"shadow",
		"effect",
	] as const;
	const profileByRole = {
		tile: "tileset_terrain_texture",
		background: "background_parallax",
		character: "character_creature_animation",
		object: "object_weapon_equipment_states",
		shadow: "visual_effect_projectile_shadow_mark",
		effect: "visual_effect_projectile_shadow_mark",
	} as const;
	const [basePlacement] = input.setup.placements;
	if (!basePlacement) {
		throw new Error("Missing placement fixture");
	}
	const placements = roles.map((role) => {
		const profile = specializedProfileContractCatalog.find(
			(c) => c.profileId === profileByRole[role]
		);
		if (!profile) {
			throw new Error("Missing profile fixture");
		}
		return {
			...basePlacement,
			id: role,
			role,
			assetVersionId: `${role}-version`,
			contractRevisionId: profile.profileId,
			usageTestId: profile.usageTests[0]?.id ?? "missing",
			clips: {
				idle: basePlacement.clips.idle,
				walk: role === "character" ? basePlacement.clips.idle : [],
				attack: role === "character" ? basePlacement.clips.idle : [],
			},
		};
	});
	context.assetRecordStore.list = async () =>
		roles.map((role) => ({
			id: `${role}-asset`,
			assetFamilyId: `${role}-family`,
			projectId: "project",
			name: role,
			assetCategory: profileByRole[role],
			availability: "active",
		})) as unknown as Awaited<ReturnType<Context["assetRecordStore"]["list"]>>;
	context.assetVersionStore.list = async () =>
		({
			assetVersions: roles.map((role) => ({
				id: `${role}-version`,
				assetRecordId: `${role}-asset`,
				assetFamilyId: `${role}-family`,
				projectId: "project",
				versionNumber: 1,
				integrityVerified: true,
				contentDigest: "b".repeat(64),
				sourceImageDimensions: { width: 32, height: 32 },
			})),
		}) as unknown as Awaited<ReturnType<Context["assetVersionStore"]["list"]>>;
	if (!context.specializedProfileContractStore) {
		throw new Error("Missing contract store fixture");
	}
	context.specializedProfileContractStore.getActive = async (
		_user,
		_project,
		profileId
	) => ({
		projectId: "project",
		contractRevisionId: profileId,
		contract:
			specializedProfileContractCatalog.find(
				(c) => c.profileId === profileId
			) ?? contract,
		activatedByUserId: "owner",
		activatedAt: new Date().toISOString(),
	});
	const saved = await call(
		appRouter.sceneQa.save,
		{ ...input, setup: { ...input.setup, placements } },
		{ context }
	);
	expect(saved.setup.placements.map((p) => p.role)).toEqual([
		"tile",
		"background",
		"character",
		"object",
		"shadow",
		"effect",
	]);
	expect(saved.versionPins).toHaveLength(6);
	expect(saved.profilePins).toHaveLength(5);
	await expect(
		call(
			appRouter.sceneQa.save,
			{
				...input,
				id: crypto.randomUUID(),
				setup: {
					...input.setup,
					placements: placements.map((p) =>
						p.role === "character"
							? { ...p, clips: { ...p.clips, attack: [] } }
							: p
					),
				},
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		call(
			appRouter.sceneQa.save,
			{
				...input,
				id: crypto.randomUUID(),
				setup: {
					...input.setup,
					placements: placements.map((p) => ({
						...p,
						usageTestId: "invented-usage-test",
					})),
				},
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
