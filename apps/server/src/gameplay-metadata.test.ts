import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { GameplayMetadataFrame } from "@sprite-anvil/api/gameplay-metadata";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const projectId = "gameplay-project";
const assetRecordId = "gameplay-record";
const assetVersionId = "gameplay-version";
const ownerId = "gameplay-owner";
const [contract] = specializedProfileContractCatalog;

function setup() {
	const records: unknown[] = [];
	const frames: GameplayMetadataFrame[] = [
		{ assetVersionId, frameKey: "walk-0", sourcePivots: [] },
	];
	const context = {
		session: { user: { id: ownerId } },
		specializedProfileContractStore: {
			getActive: () => ({
				contract,
				contractRevisionId: "character@1",
				projectId,
			}),
		},
		gameplayMetadataStore: {
			list: (userId: string, requestedProject: string) =>
				userId === ownerId && requestedProject === projectId
					? { frames, records }
					: null,
			append: (_userId: string, record: unknown) => {
				records.push(structuredClone(record));
				return record;
			},
		},
	};
	return { context, records, frames };
}

async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	if (!routers.gameplayMetadata) {
		throw new Error("Gameplay Metadata API is unavailable");
	}
	return await call(
		routers.gameplayMetadata[operation] as never,
		request as never,
		{
			context: context as never,
		}
	);
}

const input = {
	id: "64869356-a595-4a3a-995f-87dad6c77d04",
	projectId,
	assetRecordId,
	assetVersionId,
	frameKey: "walk-0",
	profileId: "character_creature_animation",
	contractRevisionId: "character@1",
	useContext: "walk east",
	fields: [
		{ fieldId: "pivot", source: { kind: "authored", value: { x: 12, y: 24 } } },
	],
};

test("authors Gameplay Metadata for an exact frame and use context and rereads it", async () => {
	const { context } = setup();
	await invoke("write", input, context);
	const result = await invoke("list", { projectId, assetRecordId }, context);
	expect(result).toMatchObject({
		records: [
			{
				assetVersionId,
				frameKey: "walk-0",
				useContext: "walk east",
				fields: expect.arrayContaining([
					expect.objectContaining({
						fieldId: "pivot",
						value: { x: 12, y: 24 },
						unit: "px",
						coordinateSystem: "source_image_top_left",
					}),
					expect.objectContaining({
						fieldId: "collision_areas",
						value: null,
						source: { kind: "unknown" },
					}),
				]),
			},
		],
	});
});

test("rejects a contract revision changed after the user selected it", async () => {
	const { context, records } = setup();
	await expect(
		invoke(
			"write",
			{ ...input, contractRevisionId: "character@stale" },
			context
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(records).toHaveLength(0);
});

test("replays the saved operation even after the active contract changes", async () => {
	const { context } = setup();
	const saved = await invoke("write", input, context);
	const changedContext = {
		...context,
		specializedProfileContractStore: { getActive: () => null },
	};
	expect(await invoke("write", input, changedContext)).toEqual(saved);
	await expect(
		invoke("write", { ...input, useContext: "attack" }, changedContext)
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("requires authentication and hides another owner's metadata", async () => {
	const { context, records } = setup();
	await expect(
		invoke("write", input, { ...context, session: null })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		invoke(
			"list",
			{ projectId, assetRecordId },
			{ ...context, session: { user: { id: "other-user" } } }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		invoke("write", { ...input, projectId: "other-project" }, context)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(records).toHaveLength(0);
});

test("rejects a missing frame, wrong exact version, inactive contract, duplicates and unsupported fields", async () => {
	const { context, records } = setup();
	const invalidInputs = [
		{ ...input, frameKey: "missing" },
		{ ...input, assetVersionId: "other-version" },
		{ ...input, fields: [...input.fields, ...input.fields] },
		{
			...input,
			fields: [
				{
					fieldId: "origin",
					source: { kind: "authored", value: { x: 1, y: 2 } },
				},
			],
		},
		{ ...input, alpha: "derive collisions" },
	];
	await Promise.all(
		invalidInputs.map((invalid) =>
			expect(invoke("write", invalid, context)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			})
		)
	);
	await expect(
		invoke("write", input, {
			...context,
			specializedProfileContractStore: { getActive: () => null },
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
});

test("preserves explicitly authored hitbox, hurtbox and collision data without visual inference", async () => {
	const { context } = setup();
	const collisionAreas = [
		{ id: "sword-hit", kind: "hitbox", x: 20, y: 8, width: 14, height: 6 },
		{ id: "body-hurt", kind: "hurtbox", x: 8, y: 4, width: 10, height: 20 },
		{ id: "feet", kind: "collision", x: 9, y: 22, width: 8, height: 2 },
	];
	const saved = await invoke(
		"write",
		{
			...input,
			fields: [
				{
					fieldId: "collision_areas",
					source: { kind: "authored", value: collisionAreas },
				},
			],
		},
		context
	);
	expect(saved).toMatchObject({
		fields: expect.arrayContaining([
			expect.objectContaining({
				fieldId: "collision_areas",
				value: collisionAreas,
				source: { kind: "authored" },
			}),
			expect.objectContaining({
				fieldId: "pivot",
				value: null,
				source: { kind: "unknown" },
			}),
		]),
	});
});

test("accepts only a finalized source pivot for the exact frame and preserves provenance", async () => {
	const { context, frames, records } = setup();
	const source = {
		kind: "finalized_source",
		proposalId: "373ae13d-de81-4aee-91f5-05d4bb5e3b19",
		sourceEntryId: "917ad7ee-86d4-49cd-8a3d-bcf2418c4680",
		sourcePath: "$.frames[0].pivot",
	};
	const importedInput = { ...input, fields: [{ fieldId: "pivot", source }] };
	await expect(invoke("write", importedInput, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(records).toHaveLength(0);
	frames[0]?.sourcePivots.push({
		...source,
		kind: "finalized_source",
		value: { x: 3, y: 17 },
	});
	const saved = await invoke("write", importedInput, context);
	expect(saved).toMatchObject({
		fields: expect.arrayContaining([
			expect.objectContaining({
				fieldId: "pivot",
				value: { x: 3, y: 17 },
				source,
			}),
		]),
	});
	await expect(
		invoke(
			"write",
			{
				...input,
				id: crypto.randomUUID(),
				fields: [{ fieldId: "collision_areas", source }],
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("requires effect origin and layer and validates contract field types", async () => {
	const { context, records } = setup();
	const effectContract = specializedProfileContractCatalog.find(
		(candidate) =>
			candidate.profileId === "visual_effect_projectile_shadow_mark"
	);
	const effectContext = {
		...context,
		specializedProfileContractStore: {
			getActive: () => ({
				contract: effectContract,
				contractRevisionId: "effect@1",
				projectId,
			}),
		},
	};
	const effectInput = {
		...input,
		profileId: "visual_effect_projectile_shadow_mark",
		contractRevisionId: "effect@1",
		fields: [],
	};
	await expect(
		invoke("write", effectInput, effectContext)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke(
			"write",
			{
				...effectInput,
				fields: [
					{
						fieldId: "origin",
						source: { kind: "authored", value: { x: 4, y: 8 } },
					},
					{
						fieldId: "layer",
						source: { kind: "authored", value: "foreground" },
					},
				],
			},
			effectContext
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(records).toHaveLength(0);
});

test("does not report success when storage fails or readback is missing", async () => {
	const { context } = setup();
	await expect(
		invoke("write", input, {
			...context,
			gameplayMetadataStore: {
				...context.gameplayMetadataStore,
				append: () => null,
			},
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		invoke("write", input, {
			...context,
			gameplayMetadataStore: {
				...context.gameplayMetadataStore,
				append: () => input,
			},
		})
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
