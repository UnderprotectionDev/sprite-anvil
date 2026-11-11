import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { createRuntimeValidationStore } from "../runtime-validation-store";
import { createMemoryRuntimeValidationStorage } from "./memory-runtime-validation-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const bundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b01";
const otherProjectBundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b02";
const unknownBundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b99";
const unknownRecordId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2c99";
const manifestDigest = "d".repeat(64);

const bundles: Record<string, { manifestDigest: string; projectId: string }> = {
	[bundleId]: { manifestDigest, projectId },
	[otherProjectBundleId]: {
		manifestDigest: "e".repeat(64),
		projectId: otherProjectId,
	},
};

function setup(options: { hasAccess?: boolean } = {}) {
	let tick = 0;
	const storage = createMemoryRuntimeValidationStorage();
	const store = () =>
		createRuntimeValidationStore({} as Database, {
			getBundle: (_userId, requestedProjectId, requestedBundleId) => {
				const bundle = bundles[requestedBundleId];
				return Promise.resolve(
					bundle?.projectId === requestedProjectId
						? { manifestDigest: bundle.manifestDigest }
						: null
				);
			},
			getProjectForUser: (_userId, requestedProjectId) =>
				Promise.resolve(
					(options.hasAccess ?? true) &&
						[projectId, otherProjectId].includes(requestedProjectId)
						? { id: requestedProjectId }
						: null
				),
			now: () => {
				tick += 1;
				return new Date(Date.UTC(2026, 10, 11, 10, 0, tick));
			},
			storage,
		});
	const context = (
		session: Context["session"] = { user: { id: userId } } as never
	) => ({ runtimeValidationStore: store(), session }) as unknown as Context;
	const create = (input: Record<string, unknown> = {}, ctx = context()) =>
		call(
			appRouter.runtimeValidation.create,
			{
				bundleId,
				engineVersion: "Godot 4.4.1",
				gameBuild: "build-2026.11.11",
				idempotencyKey: "key-1",
				projectId,
				...input,
			} as never,
			{ context: ctx }
		);
	const get = (recordId: string, ctx = context()) =>
		call(
			appRouter.runtimeValidation.get,
			{ projectId, recordId },
			{ context: ctx }
		);
	const list = (input: Record<string, unknown> = {}, ctx = context()) =>
		call(appRouter.runtimeValidation.list, { projectId, ...input } as never, {
			context: ctx,
		});
	const addText = (
		recordId: string,
		input: Record<string, unknown> = {},
		ctx = context()
	) =>
		call(
			appRouter.runtimeValidation.addTextEvidence,
			{
				idempotencyKey: "ev-1",
				kind: "observation",
				projectId,
				recordId,
				source: "manual",
				text: "The hero idles at 12 fps.",
				...input,
			} as never,
			{ context: ctx }
		);
	return { addText, context, create, get, list, storage };
}

test("a created Runtime Validation Record is re-read from the persisted record with its exact bundle, build, engine and adapter", async () => {
	const { create, get, list } = setup();
	const created = await create({ adapterVersion: "godot-adapter-1.2.0" });

	expect(created.status).toBe("created");
	expect(created.record).toMatchObject({
		adapterVersion: "godot-adapter-1.2.0",
		bundleId,
		engineVersion: "Godot 4.4.1",
		evidence: [],
		gameBuild: "build-2026.11.11",
		manifestDigest,
		projectId,
	});
	expect(await get(created.record.id)).toEqual(created.record);
	expect((await list({ bundleId })).records).toEqual([created.record]);
});

test("the adapter version is optional", async () => {
	const { create } = setup();
	const created = await create();
	expect(created.record.adapterVersion).toBeNull();
});

test("the same idempotency key replays the record and never makes a second one", async () => {
	const { create, list } = setup();
	const first = await create();
	const replay = await create();
	expect(replay.status).toBe("replayed");
	expect(replay.record).toEqual(first.record);
	expect((await list()).records).toHaveLength(1);
	await expect(create({ gameBuild: "other" })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	expect((await list()).records).toHaveLength(1);
});

test("an unknown bundle, another project's bundle or a blank field creates nothing", async () => {
	const { create, list } = setup();
	await expect(create({ bundleId: unknownBundleId })).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(
		create({ bundleId: otherProjectBundleId })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await Promise.all(
		[{ gameBuild: "   " }, { engineVersion: "" }, { adapterVersion: " " }].map(
			(blank) =>
				expect(create(blank)).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
	expect((await list()).records).toEqual([]);
});

test("an unauthenticated caller or a project the user cannot open reaches nothing", async () => {
	const { context, create, get, list } = setup();
	const created = await create();
	await expect(create({}, context(null))).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
	const denied = setup({ hasAccess: false });
	await expect(denied.create()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(denied.get(created.record.id)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(denied.list()).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect((await list()).records).toHaveLength(1);
	await expect(get(unknownRecordId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

test("text evidence is appended to the record, tied to its source, and re-read in order", async () => {
	const { addText, create, get } = setup();
	const { record } = await create();
	const first = await addText(record.id, { kind: "observation" });
	const second = await addText(record.id, {
		idempotencyKey: "ev-2",
		kind: "test_result",
		source: "adapter_draft",
		text: "12 of 12 checks passed",
	});

	expect(first.status).toBe("created");
	const reread = await get(record.id);
	expect(reread.evidence.map((item) => [item.kind, item.source])).toEqual([
		["observation", "manual"],
		["test_result", "adapter_draft"],
	]);
	expect(reread.evidence[0]).toMatchObject({
		file: null,
		id: first.evidence.id,
		text: "The hero idles at 12 fps.",
	});
	expect(reread.evidence[1]?.id).toBe(second.evidence.id);
	// the record itself is unchanged by the evidence
	expect({ ...reread, evidence: record.evidence }).toEqual(record);
});

test("text evidence replays by key, and invalid or misplaced evidence is refused", async () => {
	const { addText, create, get } = setup();
	const { record } = await create();
	const first = await addText(record.id);
	const replay = await addText(record.id);
	expect(replay.status).toBe("replayed");
	expect(replay.evidence).toEqual(first.evidence);
	await expect(addText(record.id, { text: "different" })).rejects.toMatchObject(
		{ code: "CONFLICT" }
	);
	await Promise.all(
		[{ text: "  " }, { kind: "screenshot" }, { kind: "video" }].map((bad) =>
			expect(
				addText(record.id, { idempotencyKey: "bad", ...bad })
			).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
	await expect(addText(unknownRecordId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	expect((await get(record.id)).evidence).toHaveLength(1);
});
