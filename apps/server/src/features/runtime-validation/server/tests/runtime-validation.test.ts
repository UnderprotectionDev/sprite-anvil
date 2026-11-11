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
const secondBundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b03";
const unknownBundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b99";
const unknownRecordId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2c99";
const manifestDigest = "d".repeat(64);

const bundles: Record<string, { manifestDigest: string; projectId: string }> = {
	[bundleId]: { manifestDigest, projectId },
	[secondBundleId]: { manifestDigest: "f".repeat(64), projectId },
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
	const finalizeOutcome = (
		recordId: string,
		input: Record<string, unknown> = {},
		ctx = context()
	) =>
		call(
			appRouter.runtimeValidation.finalizeOutcome,
			{
				idempotencyKey: "outcome-1",
				outcome: "pass",
				projectId,
				recordId,
				...input,
			} as never,
			{ context: ctx }
		);
	const confirmFailureSource = (
		recordId: string,
		input: Record<string, unknown> = {},
		ctx = context()
	) =>
		call(
			appRouter.runtimeValidation.confirmFailureSource,
			{
				failureSource: "asset_content",
				idempotencyKey: "source-1",
				projectId,
				recordId,
				...input,
			} as never,
			{ context: ctx }
		);
	return {
		addText,
		confirmFailureSource,
		context,
		create,
		finalizeOutcome,
		get,
		list,
		storage,
	};
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

test("only the user finalizes the outcome; adapter drafted evidence never sets it", async () => {
	const { addText, create, finalizeOutcome, get } = setup();
	const { record } = await create({ adapterVersion: "godot-adapter-1.2.0" });
	await addText(record.id, {
		kind: "test_result",
		source: "adapter_draft",
		text: "12 of 12 checks passed",
	});
	const drafted = await get(record.id);
	expect(drafted.outcome).toBeNull();
	expect(drafted.failureSource).toBeNull();
	expect(drafted.decisions).toEqual([]);

	await Promise.all(
		[
			{ source: "adapter_draft" },
			{ decidedBy: "adapter" },
			{ outcome: "ok" },
		].map((bad) =>
			expect(
				finalizeOutcome(record.id, { idempotencyKey: "bad", ...bad })
			).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
	expect((await get(record.id)).outcome).toBeNull();

	const decided = await finalizeOutcome(record.id);
	expect(decided.status).toBe("created");
	const reread = await get(record.id);
	expect(reread.outcome).toBe("pass");
	expect(reread.failureSource).toBeNull();
	expect(reread.decisions.map((item) => item.kind)).toEqual(["outcome"]);
	// the record's own content is unchanged by the decision
	expect({ ...reread, decisions: [], outcome: null }).toEqual({
		...drafted,
		decisions: [],
		outcome: null,
	});
});

test("a Fail starts as Source Unknown and the user confirms or reclassifies it with appended decisions", async () => {
	const { confirmFailureSource, create, finalizeOutcome, get, storage } =
		setup();
	const { record } = await create();
	await finalizeOutcome(record.id, { outcome: "fail" });
	expect((await get(record.id)).failureSource).toBe("source_unknown");

	const afterFail = JSON.parse(storage.snapshot()) as unknown[][];
	await confirmFailureSource(record.id, { failureSource: "asset_content" });
	expect((await get(record.id)).failureSource).toBe("asset_content");
	await confirmFailureSource(record.id, {
		failureSource: "multiple_sources",
		idempotencyKey: "source-2",
	});
	const reread = await get(record.id);
	expect(reread.failureSource).toBe("multiple_sources");
	expect(
		reread.decisions.map((item) => [
			item.kind,
			item.outcome,
			item.failureSource,
		])
	).toEqual([
		["outcome", "fail", null],
		["failure_source", null, "asset_content"],
		["failure_source", null, "multiple_sources"],
	]);
	// earlier rows are unchanged: reclassification only appended
	const afterAll = JSON.parse(storage.snapshot()) as unknown[][];
	expect(afterAll[0]).toEqual(afterFail[0]);
	expect(afterAll[2]?.[0]).toEqual(afterFail[2]?.[0]);
	expect(afterAll[2]).toHaveLength(3);
	// a repeated key replays instead of appending
	const replay = await confirmFailureSource(record.id, {
		failureSource: "multiple_sources",
		idempotencyKey: "source-2",
	});
	expect(replay.status).toBe("replayed");
	expect((await get(record.id)).decisions).toHaveLength(3);
});

test("finalizing is refused for a non-owner, an unknown record, a second outcome and a source on a non-Fail", async () => {
	const { confirmFailureSource, context, create, finalizeOutcome, get } =
		setup();
	const { record } = await create();
	const denied = setup({ hasAccess: false });
	await expect(denied.finalizeOutcome(record.id)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(denied.confirmFailureSource(record.id)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(
		finalizeOutcome(record.id, {}, context(null))
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(finalizeOutcome(unknownRecordId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(confirmFailureSource(unknownRecordId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});

	// a source before any outcome, or on an Inconclusive, is refused
	await expect(confirmFailureSource(record.id)).rejects.toMatchObject({
		code: "CONFLICT",
	});
	await finalizeOutcome(record.id, { outcome: "inconclusive" });
	await expect(
		confirmFailureSource(record.id, { idempotencyKey: "s-2" })
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		confirmFailureSource(record.id, { failureSource: "source_unknown" })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	// the first outcome is final; a changed mind needs a new record
	await expect(
		finalizeOutcome(record.id, { idempotencyKey: "outcome-2", outcome: "pass" })
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		finalizeOutcome(record.id, { idempotencyKey: "outcome-2", outcome: "fail" })
	).rejects.toMatchObject({ code: "CONFLICT" });
	const same = await finalizeOutcome(record.id, { outcome: "inconclusive" });
	expect(same.status).toBe("replayed");
	const reread = await get(record.id);
	expect(reread.outcome).toBe("inconclusive");
	expect(reread.decisions).toHaveLength(1);
});

test("a failure leaves the exported bundle unchanged and the game project is never a sync or authoritative source", async () => {
	const { confirmFailureSource, create, finalizeOutcome } = setup();
	const bundlesBefore = structuredClone(bundles);
	const { record } = await create();
	await finalizeOutcome(record.id, { outcome: "fail" });
	await confirmFailureSource(record.id, { failureSource: "engine_adapter" });
	expect(bundles).toEqual(bundlesBefore);
	// evidence flows one way into records; there is no import, pull or sync operation
	expect(Object.keys(appRouter.runtimeValidation).sort()).toEqual([
		"addTextEvidence",
		"confirmFailureSource",
		"create",
		"deliveryTargetReadiness",
		"finalizeOutcome",
		"get",
		"list",
	]);
});

test("a fix is a new record linked to the one it supersedes, and the old record stays unchanged", async () => {
	const { create, finalizeOutcome, get } = setup();
	const { record: failed } = await create();
	await finalizeOutcome(failed.id, { outcome: "fail" });
	const before = await get(failed.id);

	const { record: retest } = await create({
		idempotencyKey: "key-2",
		supersedesRecordId: failed.id,
	});
	expect(retest.supersedesRecordId).toBe(failed.id);
	expect(retest.outcome).toBeNull();
	expect(await get(failed.id)).toEqual(before);

	await expect(
		create({ idempotencyKey: "key-3", supersedesRecordId: unknownRecordId })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("a retest can supersede only a record of the same bundle and environment", async () => {
	const { create, finalizeOutcome } = setup();
	const { record: failed } = await create();
	await finalizeOutcome(failed.id, { outcome: "fail" });

	const changes = [
		{ bundleId: secondBundleId },
		{ gameBuild: "build-2026.11.12" },
		{ engineVersion: "Godot 4.5.0" },
		{ adapterVersion: "godot-adapter-1.2.0" },
	];
	await Promise.all(
		changes.map((change, index) =>
			expect(
				create({
					idempotencyKey: `mismatch-${index}`,
					supersedesRecordId: failed.id,
					...change,
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
});

test("a record in another project cannot be superseded", async () => {
	const { create } = setup();
	const { record: foreign } = await create(
		{ bundleId: otherProjectBundleId, projectId: otherProjectId },
		undefined
	);
	await expect(
		create({ idempotencyKey: "cross-project", supersedesRecordId: foreign.id })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("evidence cannot be added to a record that already has an outcome decision", async () => {
	const { addText, create, finalizeOutcome, get } = setup();
	const { record } = await create();
	await addText(record.id);
	await finalizeOutcome(record.id, { outcome: "fail" });
	await expect(
		addText(record.id, { idempotencyKey: "ev-late", text: "Late note." })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect((await get(record.id)).evidence).toHaveLength(1);
	// a retry of evidence added before the decision still replays
	expect(await addText(record.id)).toMatchObject({ status: "replayed" });
});
