import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { RuntimeValidationRecord } from "@sprite-anvil/api/runtime-validation";
import { evaluateRuntimeValidationCriterion } from "@sprite-anvil/api/runtime-validation-readiness";
import type { Database } from "@sprite-anvil/db";
import { createRuntimeValidationStore } from "../runtime-validation-store";
import { createMemoryRuntimeValidationStorage } from "./memory-runtime-validation-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const bundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b01";
const otherBundleId = "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b02";
const plainRevisionId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3001";
const criterionRevisionId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3002";
const otherBuildRevisionId = "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3003";

const environmentA = {
	adapterVersion: "godot-adapter-1.2.0",
	engineVersion: "Godot 4.4.1",
	gameBuild: "build-A",
};
const environmentB = { ...environmentA, gameBuild: "build-B" };

function revision(
	id: string,
	runtimeValidationCriterion: {
		environments: unknown[];
		freshness: string;
	} | null
) {
	return { id, runtimeValidationCriterion };
}

const revisions = [
	revision(plainRevisionId, null),
	revision(criterionRevisionId, {
		environments: [environmentA],
		freshness: "not_superseded",
	}),
	revision(otherBuildRevisionId, {
		environments: [environmentB],
		freshness: "not_superseded",
	}),
];

function setup() {
	let tick = 0;
	const storage = createMemoryRuntimeValidationStorage();
	const runtimeValidationStore = createRuntimeValidationStore({} as Database, {
		getBundle: (_userId, requestedProjectId, requestedBundleId) =>
			Promise.resolve(
				requestedProjectId === projectId &&
					[bundleId, otherBundleId].includes(requestedBundleId)
					? { manifestDigest: "d".repeat(64) }
					: null
			),
		getProjectForUser: (_userId, requestedProjectId) =>
			Promise.resolve(
				requestedProjectId === projectId ? { id: projectId } : null
			),
		now: () => {
			tick += 1;
			return new Date(Date.UTC(2026, 10, 11, 10, 0, tick));
		},
		storage,
	});
	// Only the catalog read is used; the real store's criterion round trip is covered with Delivery Target planning.
	const deliveryTargetStore = {
		list: () =>
			Promise.resolve({
				deliveryTargets: [{ revisions }],
			}),
	};
	// Only the bundle lookup is used: the bundle exists in the project or it does not.
	const exportBundleStore = {
		get: (
			_userId: string,
			requestedProjectId: string,
			requestedBundleId: string
		) =>
			Promise.resolve(
				requestedProjectId === projectId &&
					[bundleId, otherBundleId].includes(requestedBundleId)
					? { id: requestedBundleId }
					: null
			),
	};
	const context = {
		deliveryTargetStore,
		exportBundleStore,
		runtimeValidationStore,
		session: { user: { id: userId } },
	} as unknown as Context;
	let keys = 0;
	const key = () => {
		keys += 1;
		return `key-${keys}`;
	};
	return {
		confirm: (recordId: string, failureSource: string) =>
			call(
				appRouter.runtimeValidation.confirmFailureSource,
				{ failureSource, idempotencyKey: key(), projectId, recordId } as never,
				{ context }
			),
		create: async (input: Record<string, unknown> = {}) =>
			(
				await call(
					appRouter.runtimeValidation.create,
					{
						bundleId,
						idempotencyKey: key(),
						projectId,
						...environmentA,
						...input,
					} as never,
					{ context }
				)
			).record,
		decide: (recordId: string, outcome: string) =>
			call(
				appRouter.runtimeValidation.finalizeOutcome,
				{ idempotencyKey: key(), outcome, projectId, recordId } as never,
				{ context }
			),
		readiness: (
			input: { bundleId?: string; revisionId?: string } = {},
			ctx = context
		) =>
			call(
				appRouter.runtimeValidation.deliveryTargetReadiness,
				{
					bundleId,
					projectId,
					revisionId: criterionRevisionId,
					...input,
				} as never,
				{ context: ctx }
			),
		context,
	};
}

test("a target without the criterion keeps its behavior and needs no runtime validation", async () => {
	const { readiness } = setup();
	expect(await readiness({ revisionId: plainRevisionId })).toEqual({
		environments: [],
		ready: true,
		required: false,
	});
});

test("only a Pass the user finalized for the exact bundle and environment makes the target ready", async () => {
	const { create, decide, readiness } = setup();
	expect((await readiness()).environments[0]?.blocker).toBe("no_record");

	const record = await create();
	expect((await readiness()).environments[0]?.blocker).toBe("decision_pending");
	await decide(record.id, "pass");

	const ready = await readiness();
	expect(ready).toMatchObject({ ready: true, required: true });
	expect(ready.environments[0]).toMatchObject({
		blocker: null,
		recordId: record.id,
		satisfied: true,
	});
	// the Pass belongs to its exact bundle only
	expect(
		(await readiness({ bundleId: otherBundleId })).environments[0]?.blocker
	).toBe("no_record");
});

test("an Inconclusive outcome blocks the target", async () => {
	const { create, decide, readiness } = setup();
	await decide((await create()).id, "inconclusive");
	expect(await readiness()).toMatchObject({
		environments: [{ blocker: "inconclusive" }],
		ready: false,
	});
});

test("a Source Unknown failure blocks the target until the user confirms a source, which then still needs revalidation", async () => {
	const { confirm, create, decide, readiness } = setup();
	const record = await create();
	await decide(record.id, "fail");
	expect(await readiness()).toMatchObject({
		environments: [{ blocker: "failed_source_unknown", recordId: record.id }],
		ready: false,
	});

	await confirm(record.id, "asset_content");
	expect((await readiness()).environments[0]?.blocker).toBe(
		"failed_revalidation_required"
	);
});

test("a Pass is invalidated by a changed environment or a later record for the same one", async () => {
	const { create, decide, readiness } = setup();
	const pass = await create();
	await decide(pass.id, "pass");
	expect((await readiness()).ready).toBe(true);

	// the target moves to another game build: the earlier Pass does not apply
	expect(
		(await readiness({ revisionId: otherBuildRevisionId })).environments[0]
			?.blocker
	).toBe("no_record");
	// a Pass for a different engine version is not a Pass for this environment
	const otherEngine = setup();
	await otherEngine.decide(
		(await otherEngine.create({ engineVersion: "Godot 4.5.0" })).id,
		"pass"
	);
	expect((await otherEngine.readiness()).environments[0]?.blocker).toBe(
		"no_record"
	);

	// a Pass cannot be superseded: only a failure with a confirmed source or an Inconclusive record can
	await expect(create({ supersedesRecordId: pass.id })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect((await readiness()).ready).toBe(true);

	// a later record that does not supersede it is the latest one and decides
	const later = await create();
	expect((await readiness()).environments[0]).toMatchObject({
		blocker: "decision_pending",
		recordId: later.id,
	});
	await decide(later.id, "fail");
	expect((await readiness()).environments[0]?.blocker).toBe(
		"failed_source_unknown"
	);
});

test("a Source Unknown failure cannot be hidden by a superseding Pass", async () => {
	const { create, decide, readiness } = setup();
	const failed = await create();
	await decide(failed.id, "fail");
	await expect(create({ supersedesRecordId: failed.id })).rejects.toMatchObject(
		{ code: "BAD_REQUEST" }
	);
	expect(await readiness()).toMatchObject({
		environments: [{ blocker: "failed_source_unknown", recordId: failed.id }],
		ready: false,
	});
});

test("a retest of a classified failure supersedes it and decides readiness", async () => {
	const { confirm, create, decide, readiness } = setup();
	const failed = await create();
	await decide(failed.id, "fail");
	await confirm(failed.id, "asset_content");
	const retest = await create({ supersedesRecordId: failed.id });
	expect((await readiness()).environments[0]).toMatchObject({
		blocker: "decision_pending",
		recordId: retest.id,
	});
	await decide(retest.id, "pass");
	expect((await readiness()).ready).toBe(true);
});

test("a failure blocks only this target's use: other bundles and other targets keep their own state", async () => {
	const { create, decide, readiness } = setup();
	const failed = await create({ bundleId: otherBundleId });
	await decide(failed.id, "fail");
	const pass = await create();
	await decide(pass.id, "pass");

	expect((await readiness({ bundleId: otherBundleId })).ready).toBe(false);
	expect((await readiness()).ready).toBe(true);
	expect((await readiness({ revisionId: plainRevisionId })).ready).toBe(true);
});

test("an unknown revision or a project the user cannot open reaches nothing", async () => {
	const { context, readiness } = setup();
	await expect(
		readiness({ revisionId: "6f1a3d62-3d2e-4b86-8a7c-0e6c2f0d3999" })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		readiness({}, { ...context, session: null } as unknown as Context)
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("readiness for a bundle that is not in the project reaches nothing", async () => {
	const { readiness } = setup();
	await expect(
		readiness({ bundleId: "5b1f0f0e-8f4e-4c36-9a53-0b0b6a2f2b99" })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

const criterion = {
	environments: [environmentA],
	freshness: "not_superseded" as const,
};

let recordCount = 0;
function makeRecord(
	overrides: Partial<RuntimeValidationRecord>
): RuntimeValidationRecord {
	recordCount += 1;
	return {
		...environmentA,
		bundleId,
		createdAt: new Date(
			Date.UTC(2026, 10, 11, 10, 0, recordCount)
		).toISOString(),
		decisions: [],
		evidence: [],
		failureSource: null,
		id: `00000000-0000-4000-8000-${String(recordCount).padStart(12, "0")}`,
		manifestDigest: "d".repeat(64),
		outcome: null,
		projectId,
		supersedesRecordId: null,
		...overrides,
	} as RuntimeValidationRecord;
}

test("a newer pending record that supersedes a Pass blocks the target", () => {
	const pass = makeRecord({ outcome: "pass" });
	const pendingRetest = makeRecord({ supersedesRecordId: pass.id });
	expect(
		evaluateRuntimeValidationCriterion(criterion, bundleId, [
			pass,
			pendingRetest,
		]).environments[0]
	).toMatchObject({ blocker: "decision_pending", recordId: pendingRetest.id });
});

test("a Pass stays current while nothing in its bundle and environment supersedes it", () => {
	const pass = makeRecord({ outcome: "pass" });
	// records of another environment or bundle, even when newer, never touch this Pass
	const unrelated = [
		makeRecord({ gameBuild: "build-B" }),
		makeRecord({ bundleId: otherBundleId }),
		makeRecord({ bundleId: otherBundleId, supersedesRecordId: pass.id }),
	];
	expect(
		evaluateRuntimeValidationCriterion(criterion, bundleId, [
			pass,
			...unrelated,
		]).environments[0]
	).toMatchObject({ blocker: null, recordId: pass.id, satisfied: true });
});
