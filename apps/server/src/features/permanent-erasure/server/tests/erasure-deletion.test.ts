import { expect, test } from "bun:test";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type {
	ErasureImpactReport,
	ErasureImpactSource,
} from "@sprite-anvil/api/permanent-erasure";
import {
	type ErasureApprovalInput,
	erasureApprovalInputSchema,
	selectedErasureCounts,
} from "@sprite-anvil/api/permanent-erasure-deletion";
import { createDeletionReceiptStore } from "../deletion-receipt-store";
import { createErasureDeletionOperations } from "../erasure-deletion-operations";
import { createErasureImpactStore } from "../erasure-impact-store";
import {
	archiveId,
	assetRecordId,
	bundleId,
	fulfilmentId,
	projectId,
	userId,
	versionId,
	yas04Source,
} from "./erasure-impact-fixtures";
import { createMemoryErasureDeletionStorage } from "./memory-erasure-deletion-storage";
import { createMemoryErasureImpactStorage } from "./memory-erasure-impact-storage";

const objectKey = "projects/p/objects/hero-secret-location";
const retention = { purgeWindowDays: 30, version: "fixture-schedule-1" };
const operationId = "99999999-9999-4999-8999-999999999901";

const archiveCopyKey = "projects/p/objects/hero-working-copy";

interface Options {
	archiveKeys?: string[];
	failDelete?: boolean;
	/** Object keys whose removal fails once, then succeeds. */
	failOnce?: string[];
	retention?: typeof retention | null;
}

function setup(options: Options = {}) {
	const state = { source: yas04Source() as ErasureImpactSource };
	const impactStorage = createMemoryErasureImpactStorage();
	const clock = () => new Date("2026-11-13T10:00:00.000Z");
	const accessCheck = (user: string, project: string) =>
		Promise.resolve(user === userId && project === projectId ? {} : null);
	const impactStore = createErasureImpactStore({
		getProjectForUser: accessCheck,
		now: clock,
		retentionSchedule: () =>
			options.retention === undefined ? retention : options.retention,
		sourceReader: { read: () => Promise.resolve(state.source) },
		storage: impactStorage,
	});
	const deletion = createMemoryErasureDeletionStorage(
		{ [versionId]: objectKey },
		{ [archiveId]: options.archiveKeys ?? [] }
	);
	const deletedObjects: string[] = [];
	const failOnce = new Set(options.failOnce);
	const enqueued: unknown[] = [];
	const operations = createErasureDeletionOperations({
		getProjectForUser: accessCheck,
		impactStore,
		now: clock,
		objects: {
			delete: (key) => {
				if (options.failDelete) {
					return Promise.reject(new Error("storage unavailable"));
				}
				if (failOnce.delete(key)) {
					return Promise.reject(new Error("storage unavailable"));
				}
				if (!deletedObjects.includes(key)) {
					deletedObjects.push(key);
				}
				return Promise.resolve();
			},
		},
		operations: {
			enqueue: (request) => {
				enqueued.push(request);
				return Promise.resolve({
					id: operationId,
					projectId: request.projectId,
					scopeTargetId: request.scopeTargetId,
				} as BackgroundOperation);
			},
		},
		permanentFailure: (message) => new Error(message),
		transientFailure: (message) => new Error(message),
		sourceReader: { read: () => Promise.resolve(state.source) },
		storage: deletion.storage,
	});
	const receipts = createDeletionReceiptStore({
		getProjectForUser: accessCheck,
		storage: deletion.storage,
	});
	async function prepare(key = "report-key") {
		const result = await impactStore.prepare(userId, {
			assetRecordId,
			idempotencyKey: key,
			projectId,
		});
		if (result?.status !== "created" && result?.status !== "replayed") {
			throw new Error("expected a report");
		}
		return result.report;
	}
	return {
		deletedObjects,
		deletion,
		enqueued,
		impactStorage,
		impactStore,
		operations,
		prepare,
		receipts,
		state,
	};
}

function approval(
	report: ErasureImpactReport,
	overrides: Partial<ErasureApprovalInput> = {}
): ErasureApprovalInput {
	const selectedContainerIds = report.containers.map((c) => c.id);
	return {
		acknowledgements: { externalCopiesRemain: true, irreversible: true },
		confirmed: selectedErasureCounts(report, selectedContainerIds),
		idempotencyKey: "approve-1",
		projectId,
		reportDigest: report.reportDigest,
		reportId: report.id,
		selectedContainerIds,
		...overrides,
	};
}

function run(
	operations: ReturnType<typeof setup>["operations"],
	checkpoint: () => Promise<void> = () => Promise.resolve()
) {
	return operations.execute({
		checkpoint,
		operation: { id: operationId, projectId, scopeTargetId: scopeTarget.id },
	});
}

const scopeTarget = { id: "" };

async function approve(
	ctx: ReturnType<typeof setup>,
	overrides: Partial<ErasureApprovalInput> = {}
) {
	const report = await ctx.prepare();
	const result = await ctx.operations.approve(
		userId,
		approval(report, overrides)
	);
	if (result?.status === "accepted") {
		scopeTarget.id =
			(result.operation as { scopeTargetId?: string }).scopeTargetId ?? "";
	}
	return { report, result };
}

test("YAS-04 report, approval, whole-container deletion and a content-free receipt reread", async () => {
	const ctx = setup();
	const { report, result } = await approve(ctx);
	expect(result?.status).toBe("accepted");
	expect(ctx.enqueued).toHaveLength(1);
	expect(ctx.enqueued[0]).toMatchObject({ kind: "deletion" });

	const summary = await run(ctx.operations);
	expect(summary).toContain("Deletion Receipt");

	expect(ctx.deletedObjects).toEqual([objectKey]);
	expect(new Set(ctx.deletion.removedContainers)).toEqual(
		new Set([bundleId, archiveId])
	);
	expect(ctx.deletion.tombstones).toEqual([
		expect.objectContaining({
			assetRecordId,
			assetVersionId: versionId,
			projectId,
		}),
	]);
	expect(ctx.deletion.erasedAssetRecords).toEqual([assetRecordId]);

	const receipt = await ctx.receipts.get(userId, projectId, scopeTarget.id);
	expect(receipt).toMatchObject({
		backup: {
			purgeDueAt: "2026-12-13T10:00:00.000Z",
			retentionScheduleVersion: "fixture-schedule-1",
			status: "scheduled",
			verification: "operational_check_pending",
		},
		contractVersion: "deletion-receipt/1.0.0",
		erased: { assetVersionIds: [versionId] },
		externalCopies: { recallable: false },
		operationId,
		remainingContainers: [],
		reportDigest: report.reportDigest,
		requestedByUserId: userId,
		unverifiableFulfilmentIds: [fulfilmentId],
	});
	const text = JSON.stringify(receipt);
	expect(text).not.toContain(objectKey);
	expect(text).not.toContain("hero.png");
});

test("an approval of an older report digest is rejected once the scope has changed, and nothing is recorded", async () => {
	const ctx = setup();
	const report = await ctx.prepare();
	ctx.state.source.bundles.push({
		files: [{ assetVersionId: versionId, path: "extra/hero.png" }],
		id: "33333333-3333-4333-8333-333333333399",
		manifestDigest: "d".repeat(64),
	});

	const result = await ctx.operations.approve(userId, approval(report));

	expect(result).toEqual({ reason: "report_changed", status: "rejected" });
	expect(ctx.deletion.approvals.size).toBe(0);
	expect(ctx.enqueued).toHaveLength(0);
});

test("an approval naming another digest, wrong counts or an unknown container is rejected", async () => {
	const ctx = setup();
	const report = await ctx.prepare();

	expect(
		await ctx.operations.approve(
			userId,
			approval(report, { reportDigest: "e".repeat(64) })
		)
	).toEqual({ reason: "report_changed", status: "rejected" });
	expect(
		await ctx.operations.approve(
			userId,
			approval(report, {
				confirmed: { ...approval(report).confirmed, managedCopies: 9 },
			})
		)
	).toEqual({ reason: "counts_mismatch", status: "rejected" });
	expect(
		await ctx.operations.approve(
			userId,
			approval(report, { selectedContainerIds: ["no-such-container"] })
		)
	).toMatchObject({ reason: "unknown_container", status: "rejected" });
	expect(ctx.deletion.approvals.size).toBe(0);
});

test("the approval contract needs both explicit acknowledgements", () => {
	const base = {
		acknowledgements: { externalCopiesRemain: true, irreversible: true },
		confirmed: {
			archives: 0,
			bundles: 0,
			containerFiles: 0,
			fulfilments: 0,
			managedCopies: 1,
		},
		idempotencyKey: "k",
		projectId,
		reportDigest: "a".repeat(64),
		reportId: assetRecordId,
		selectedContainerIds: [],
	};
	expect(erasureApprovalInputSchema.safeParse(base).success).toBe(true);
	expect(
		erasureApprovalInputSchema.safeParse({
			...base,
			acknowledgements: { externalCopiesRemain: true, irreversible: false },
		}).success
	).toBe(false);
	expect(
		erasureApprovalInputSchema.safeParse({ ...base, acknowledgements: {} })
			.success
	).toBe(false);
});

test("a scope that changes after approval fails the job before any object is removed", async () => {
	const ctx = setup();
	await approve(ctx);
	ctx.state.source.bundles[0]?.files.push({
		assetVersionId: versionId,
		path: "late/hero.png",
	});

	await expect(run(ctx.operations)).rejects.toThrow("no object was removed");
	expect(ctx.deletedObjects).toEqual([]);
	expect(ctx.deletion.receipts.size).toBe(0);
});

test("a repeated approval and a repeated delivery never make a second approval, receipt or removal", async () => {
	const ctx = setup();
	const { report } = await approve(ctx);
	const firstTarget = scopeTarget.id;
	const replay = await ctx.operations.approve(userId, approval(report));
	expect(replay).toMatchObject({
		operation: { scopeTargetId: firstTarget },
		status: "accepted",
	});
	expect(ctx.deletion.approvals.size).toBe(1);

	await run(ctx.operations);
	const again = await run(ctx.operations);

	expect(again).toContain("replayed");
	expect(ctx.deletedObjects).toEqual([objectKey]);
	expect(ctx.deletion.receipts.size).toBe(1);
	expect(ctx.deletion.tombstones).toHaveLength(1);
});

test("the same key with another selection is a conflict", async () => {
	const ctx = setup();
	const { report } = await approve(ctx);
	const bundleOnly = [bundleId];

	await expect(
		ctx.operations.approve(
			userId,
			approval(report, {
				confirmed: selectedErasureCounts(report, bundleOnly),
				selectedContainerIds: bundleOnly,
			})
		)
	).rejects.toMatchObject({ name: "IdempotencyConflictError" });
	expect(ctx.deletion.approvals.size).toBe(1);
});

test("a cancel at the checkpoint before the first removal deletes nothing and leaves no receipt", async () => {
	const ctx = setup();
	await approve(ctx);

	await expect(
		run(ctx.operations, () => Promise.reject(new Error("cancelled")))
	).rejects.toThrow("cancelled");

	expect(ctx.deletedObjects).toEqual([]);
	expect(ctx.deletion.receipts.size).toBe(0);
	expect(ctx.deletion.tombstones).toEqual([]);
});

test("after the first removal no checkpoint runs, so a late cancel still reports the real result", async () => {
	const ctx = setup();
	await approve(ctx);
	let checkpoints = 0;

	const summary = await run(ctx.operations, () => {
		checkpoints += 1;
		return Promise.resolve();
	});

	expect(checkpoints).toBe(1);
	expect(summary).toContain("created");
	expect(ctx.deletion.receipts.size).toBe(1);
});

test("a failing storage removal leaves no receipt, tombstone or container removal", async () => {
	const ctx = setup({ failDelete: true });
	await approve(ctx);

	await expect(run(ctx.operations)).rejects.toThrow("0 of 1 were removed");

	expect(ctx.deletion.receipts.size).toBe(0);
	expect(ctx.deletion.tombstones).toEqual([]);
	expect(ctx.deletion.removedContainers).toEqual([]);
});

test("a selection of one container removes only it whole and the receipt lists the other as remaining", async () => {
	const ctx = setup();
	const report = await ctx.prepare();
	const selected = [archiveId];
	const result = await ctx.operations.approve(
		userId,
		approval(report, {
			confirmed: selectedErasureCounts(report, selected),
			selectedContainerIds: selected,
		})
	);
	if (result?.status !== "accepted") {
		throw new Error("expected an accepted approval");
	}
	scopeTarget.id = result.operation.scopeTargetId ?? "";
	await run(ctx.operations);

	expect(ctx.deletion.removedContainers).toEqual([archiveId]);
	const receipt = await ctx.receipts.get(userId, projectId, scopeTarget.id);
	expect(receipt?.remainingContainers).toEqual([
		{ id: bundleId, kind: "export_bundle" },
	]);
	expect(receipt?.externalCopies.recallable).toBe(false);
});

test("a report or receipt of an unknown contract major is never used", async () => {
	const ctx = setup();
	const report = await ctx.prepare();
	const stored = ctx.impactStorage.rows.get(report.id);
	if (!stored) {
		throw new Error("expected a stored report");
	}
	stored.contractVersion = "erasure-impact-report/2.0.0";
	expect(await ctx.operations.approve(userId, approval(report))).toEqual({
		reason: "report_unreadable",
		status: "rejected",
	});

	const done = setup();
	await approve(done);
	await run(done.operations);
	const receipt = done.deletion.receipts.get(scopeTarget.id);
	if (!receipt) {
		throw new Error("expected a stored receipt");
	}
	receipt.receipt.contractVersion = "deletion-receipt/2.0.0";
	await expect(
		done.receipts.get(userId, projectId, scopeTarget.id)
	).rejects.toMatchObject({ name: "RecordIntegrityError" });
});

test("a selected archive's own copies of the erased content are removed with it, an unselected archive's are not", async () => {
	const selectedArchive = setup({ archiveKeys: [archiveCopyKey] });
	await approve(selectedArchive);
	await run(selectedArchive.operations);
	expect(selectedArchive.deletedObjects).toEqual([objectKey, archiveCopyKey]);

	const bundleOnly = setup({ archiveKeys: [archiveCopyKey] });
	const report = await bundleOnly.prepare();
	const selected = [bundleId];
	const result = await bundleOnly.operations.approve(
		userId,
		approval(report, {
			confirmed: selectedErasureCounts(report, selected),
			selectedContainerIds: selected,
		})
	);
	if (result?.status !== "accepted") {
		throw new Error("expected an accepted approval");
	}
	scopeTarget.id = result.operation.scopeTargetId ?? "";
	await run(bundleOnly.operations);
	expect(bundleOnly.deletedObjects).toEqual([objectKey]);
});

test("a failure in the middle of the removals says what was removed, and a retry completes with one receipt and one tombstone", async () => {
	const ctx = setup({
		archiveKeys: [archiveCopyKey],
		failOnce: [archiveCopyKey],
	});
	await approve(ctx);

	const failure = await run(ctx.operations).catch((error: Error) => error);
	expect(failure).toBeInstanceOf(Error);
	expect((failure as Error).message).toContain("1 of 2");
	expect((failure as Error).message).not.toContain("nothing was deleted");
	expect(ctx.deletedObjects).toEqual([objectKey]);
	expect(ctx.deletion.receipts.size).toBe(0);

	const summary = await run(ctx.operations);

	expect(summary).toContain("created");
	// The first object is removed again: removing a missing object is not an error.
	expect(ctx.deletedObjects).toEqual([objectKey, archiveCopyKey]);
	expect(ctx.deletion.receipts.size).toBe(1);
	expect(ctx.deletion.tombstones).toHaveLength(1);
});

test("an empty selection is valid: only the managed copies are erased and every container stays out of scope", async () => {
	const ctx = setup();
	const report = await ctx.prepare();
	const result = await ctx.operations.approve(
		userId,
		approval(report, {
			confirmed: selectedErasureCounts(report, []),
			selectedContainerIds: [],
		})
	);
	if (result?.status !== "accepted") {
		throw new Error("expected an accepted approval");
	}
	scopeTarget.id = result.operation.scopeTargetId ?? "";
	await run(ctx.operations);

	expect(ctx.deletion.removedContainers).toEqual([]);
	const receipt = await ctx.receipts.get(userId, projectId, scopeTarget.id);
	expect(receipt?.remainingContainers).toHaveLength(2);
});
