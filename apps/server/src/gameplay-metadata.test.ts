import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type {
	GameplayMetadataFrame,
	GameplayMetadataRecord,
} from "@sprite-anvil/api/gameplay-metadata";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { readGameplayMetadataPackageTarget } from "./features/gameplay-metadata/server/gameplay-metadata-package-target";
import { reviewGameplayMetadata } from "./features/gameplay-metadata/server/gameplay-metadata-review";

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
		reviewGameplayMetadata,
		readGameplayMetadataPackageTarget,
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

test("reviews exact Gameplay Metadata without overwriting the authored record and replays the decision", async () => {
	const { context, records } = setup();
	await invoke("write", input, context);
	const decision = {
		projectId,
		assetRecordId,
		recordId: input.id,
		id: "76b372d0-c267-4a89-9b5c-1089b3b13530",
	};
	const reviewed = await invoke("review", decision, context);
	expect(reviewed).toMatchObject({
		id: decision.id,
		assetVersionId,
		frameKey: "walk-0",
		review: { sourceRecordId: input.id, reviewedByUserId: ownerId },
		fields: expect.arrayContaining([
			expect.objectContaining({ fieldId: "pivot", value: { x: 12, y: 24 } }),
		]),
	});
	expect(await invoke("review", decision, context)).toEqual(reviewed);
	expect(records).toHaveLength(2);
	expect(records[0]).not.toHaveProperty("review");
	expect(
		await invoke("list", { projectId, assetRecordId }, context)
	).toMatchObject({
		records: expect.arrayContaining([reviewed]),
	});
});

test("rejects replaying a review after its exact frame disappears", async () => {
	const { context, frames } = setup();
	await invoke("write", input, context);
	const decision = {
		projectId,
		assetRecordId,
		recordId: input.id,
		id: "76b372d0-c267-4a89-9b5c-1089b3b13530",
	};
	await invoke("review", decision, context);
	frames.splice(0);
	await expect(invoke("review", decision, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

test("packages reviewed optional fields and rejects their loss, wrong frame and unreviewed export", async () => {
	const { context } = setup();
	await invoke(
		"write",
		{
			...input,
			fields: [
				...input.fields,
				{
					fieldId: "event_links",
					source: {
						kind: "authored",
						value: [
							{
								id: "strike",
								frameKey: "walk-0",
								time: 90,
								extension: { damage: 7 },
							},
						],
					},
				},
			],
		},
		context
	);
	const target = { projectId, assetRecordId, recordId: input.id };
	await expect(invoke("createPackage", target, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	const reviewId = "76b372d0-c267-4a89-9b5c-1089b3b13530";
	await invoke("review", { ...target, id: reviewId }, context);
	const reviewedTarget = { ...target, recordId: reviewId };
	const bundle = await invoke("createPackage", reviewedTarget, context);
	const packagedRecord = (bundle as { record: GameplayMetadataRecord }).record;
	expect(
		packagedRecord.fields.find((field) => field.fieldId === "event_links")
			?.value
	).toEqual([
		{ id: "strike", frameKey: "walk-0", time: 90, extension: { damage: 7 } },
	]);
	expect(
		packagedRecord.fields.find((field) => field.fieldId === "ground_point")
	).toMatchObject({ value: null, source: { kind: "unknown" } });
	expect(await invoke("createPackage", reviewedTarget, context)).toEqual(
		bundle
	);
	expect(
		await invoke("readPackage", { ...reviewedTarget, package: bundle }, context)
	).toEqual(bundle);
	const damaged = structuredClone(bundle) as {
		record: { frameKey: string; fields: { fieldId: string }[] };
	};
	damaged.record.fields = damaged.record.fields.filter(
		(field) => field.fieldId !== "event_links"
	);
	await expect(
		invoke("readPackage", { ...reviewedTarget, package: damaged }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	damaged.record.frameKey = "attack-0";
	await expect(
		invoke("readPackage", { ...reviewedTarget, package: damaged }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

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

test("blocks review and package reads after an exact frame or finalized source link disappears", async () => {
	const { context, frames } = setup();
	const source = {
		kind: "finalized_source",
		proposalId: "373ae13d-de81-4aee-91f5-05d4bb5e3b19",
		sourceEntryId: "917ad7ee-86d4-49cd-8a3d-bcf2418c4680",
		sourcePath: "$.frames[0].pivot",
	};
	frames[0]?.sourcePivots.push({
		...source,
		kind: "finalized_source",
		value: { x: 12, y: 24 },
	});
	await invoke(
		"write",
		{ ...input, fields: [{ fieldId: "pivot", source }] },
		context
	);
	const decision = {
		projectId,
		assetRecordId,
		recordId: input.id,
		id: crypto.randomUUID(),
	};
	await invoke("review", decision, context);
	const target = { projectId, assetRecordId, recordId: decision.id };
	const bundle = await invoke("createPackage", target, context);
	frames[0]?.sourcePivots.splice(0);
	await expect(
		invoke("review", { ...decision, id: crypto.randomUUID() }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		invoke("readPackage", { ...target, package: bundle }, context)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	frames.splice(0);
	await expect(invoke("createPackage", target, context)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

test("does not report a successful write when readback loses an optional value", async () => {
	const { context, records } = setup();
	const originalAppend = context.gameplayMetadataStore.append;
	await expect(
		invoke("write", input, {
			...context,
			gameplayMetadataStore: {
				...context.gameplayMetadataStore,
				append: (_userId: string, record: unknown) => {
					const result = originalAppend(ownerId, record);
					const corrupt = structuredClone(record) as {
						fields: { fieldId: string; value: unknown }[];
					};
					const pivot = corrupt.fields.find(
						(field) => field.fieldId === "pivot"
					);
					if (pivot) {
						pivot.value = null;
					}
					records.splice(0, 1, corrupt);
					return result;
				},
			},
		})
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});

test("requires authentication and owner access for review and package operations", async () => {
	const { context } = setup();
	const target = { projectId, assetRecordId, recordId: input.id };
	const requests = [
		["review", { ...target, id: crypto.randomUUID() }],
		["createPackage", target],
		["readPackage", { ...target, package: {} }],
	] as const;
	await Promise.all(
		requests.map(async ([operation, request]) => {
			await expect(
				invoke(operation, request, { ...context, session: null })
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await expect(
				invoke(operation, request, {
					...context,
					session: { user: { id: "other-owner" } },
				})
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		})
	);
});

test("retains the pinned contract after activation changes and rejects a lost review source", async () => {
	const { context, records } = setup();
	await invoke("write", input, context);
	const changedContext = {
		...context,
		specializedProfileContractStore: { getActive: () => null },
	};
	const decision = {
		projectId,
		assetRecordId,
		recordId: input.id,
		id: crypto.randomUUID(),
	};
	const reviewed = await invoke("review", decision, changedContext);
	expect(reviewed).toMatchObject({
		contractRevisionId: "character@1",
		contractSnapshot: contract,
	});
	const target = { projectId, assetRecordId, recordId: decision.id };
	const bundle = await invoke("createPackage", target, changedContext);
	records.splice(0, 1);
	await expect(
		invoke("readPackage", { ...target, package: bundle }, changedContext)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("does not confirm a review when durable readback fails", async () => {
	const { context } = setup();
	await invoke("write", input, context);
	await expect(
		invoke(
			"review",
			{ projectId, assetRecordId, recordId: input.id, id: crypto.randomUUID() },
			{
				...context,
				gameplayMetadataStore: {
					...context.gameplayMetadataStore,
					append: (_userId: string, record: unknown) => record,
				},
			}
		)
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
