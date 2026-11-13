import { expect, test } from "bun:test";
import type { ErasureImpactSource } from "@sprite-anvil/api/permanent-erasure-scope";
import type { ErasureImpactSourceReader } from "@sprite-anvil/api/permanent-erasure-store";
import {
	IdempotencyConflictError,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import { createErasureImpactStore } from "../erasure-impact-store";
import {
	archiveId,
	assetRecordId,
	bundleId,
	fulfilmentId,
	otherVersionId,
	projectId,
	userId,
	versionId,
	yas04Source,
} from "./erasure-impact-fixtures";
import { createMemoryErasureImpactStorage } from "./memory-erasure-impact-storage";

function setup(
	source: ErasureImpactSource | null = yas04Source(),
	retention: { purgeWindowDays: number; version: string } | null = null
) {
	const storage = createMemoryErasureImpactStorage();
	const reader: ErasureImpactSourceReader = {
		read: () => Promise.resolve(source),
	};
	const make = () =>
		createErasureImpactStore({
			getProjectForUser: (user, project) =>
				Promise.resolve(user === userId && project === projectId ? {} : null),
			now: () => new Date("2026-11-13T10:00:00.000Z"),
			retentionSchedule: () => retention,
			sourceReader: reader,
			storage,
		});
	return { make, storage, store: make() };
}

const contractVersionMessage = /contract version/i;
const input = { assetRecordId, idempotencyKey: "key-1", projectId };

test("YAS-04 report separates copies, whole containers, fulfilments and external copies, and rereads from the stored record", async () => {
	const { make, store } = setup();
	const created = await store.prepare(userId, input);
	if (created?.status !== "created") {
		throw new Error("expected a created report");
	}
	const { report } = created;
	expect(report.contractVersion).toBe("erasure-impact-report/1.0.0");
	// Identity, size and digest only: no file name or content type is kept in the report.
	expect(report.managedCopies).toEqual([
		{ assetVersionId: versionId, byteSize: 120, sha256: "c".repeat(64) },
	]);
	expect(report.containers).toEqual([
		expect.objectContaining({
			embeddedAssetVersionIds: [versionId],
			id: bundleId,
			kind: "export_bundle",
			removal: "whole",
		}),
		expect.objectContaining({
			embeddedAssetVersionIds: [versionId],
			id: archiveId,
			kind: "project_archive",
			removal: "whole",
		}),
	]);
	expect(report.fulfilments).toEqual([
		expect.objectContaining({
			bundleIds: [bundleId],
			id: fulfilmentId,
			pinsErasedVersions: true,
		}),
	]);
	expect(report.externalCopies.recallable).toBe(false);
	expect(report.backup).toEqual({ status: "unpublished" });
	expect(report.counts).toEqual({
		archives: 1,
		bundles: 1,
		containerFiles: 2,
		fulfilments: 1,
		managedCopies: 1,
	});
	// The other version only travels in the archive; it is not the target's content.
	expect(JSON.stringify(report)).not.toContain(otherVersionId);

	// A fresh store over the same persistent rows rereads the identical report.
	const reread = await make().get(userId, projectId, report.id);
	expect(reread).toEqual(report);
});

test("a published retention schedule is carried with its version and never invented", async () => {
	const { store } = setup(yas04Source(), {
		purgeWindowDays: 35,
		version: "backup-retention/2026-11",
	});
	const created = await store.prepare(userId, input);
	expect(created?.status === "created" && created.report.backup).toEqual({
		purgeWindowDays: 35,
		retentionScheduleVersion: "backup-retention/2026-11",
		status: "scheduled",
	});
});

test("the same key replays one report; another asset or changed content never reuses it", async () => {
	const { storage, store } = setup();
	const first = await store.prepare(userId, input);
	const second = await store.prepare(userId, input);
	expect(second?.status).toBe("replayed");
	if (first?.status !== "created" || second?.status !== "replayed") {
		throw new Error("expected a created and then a replayed report");
	}
	expect(second.report).toEqual(first.report);
	expect(storage.rows.size).toBe(1);
	// A key is scoped to its asset: another asset under the same key is its own report.
	const other = await store.prepare(userId, {
		...input,
		assetRecordId: "11111111-1111-4111-8111-111111111199",
	});
	expect(other?.status).toBe("created");
	expect(storage.rows.size).toBe(2);
	// A stored report whose request content differs from the repeated request is a conflict.
	const [row] = [...storage.rows.values()];
	if (!row) {
		throw new Error("expected a stored row");
	}
	storage.rows.set(row.id, { ...row, requestDigest: "d".repeat(64) });
	await expect(store.prepare(userId, input)).rejects.toBeInstanceOf(
		IdempotencyConflictError
	);
});

test("the digest follows the exact scope: a changed source gives another digest", async () => {
	const { store } = setup();
	const first = await store.prepare(userId, input);
	const changed = setup({ ...yas04Source(), archives: [] });
	const second = await changed.store.prepare(userId, input);
	if (first?.status !== "created" || second?.status !== "created") {
		throw new Error("expected created reports");
	}
	expect(second.report.reportDigest).not.toBe(first.report.reportDigest);
	expect(second.report.containers.map((container) => container.kind)).toEqual([
		"export_bundle",
	]);
});

test("unknown project or missing asset gives no report", async () => {
	const { store } = setup();
	expect(await store.prepare("someone-else", input)).toBeNull();
	expect(await setup(null).store.prepare(userId, input)).toBeNull();
	expect(await store.get("someone-else", projectId, "x")).toBeNull();
});

test("an inexact or already erased scope is rejected and nothing is stored", async () => {
	const missingDigest = yas04Source();
	missingDigest.versions[0] = {
		...(missingDigest.versions[0] as NonNullable<
			(typeof missingDigest.versions)[0]
		>),
		sha256: null,
	};
	const unverifiable = setup(missingDigest);
	expect(await unverifiable.store.prepare(userId, input)).toEqual({
		assetVersionIds: [versionId],
		reason: "copy_digest_missing",
		status: "rejected",
	});
	expect(unverifiable.storage.rows.size).toBe(0);

	const erased = yas04Source();
	erased.assetRecord = { availability: "erased", id: assetRecordId };
	expect((await setup(erased).store.prepare(userId, input))?.status).toBe(
		"rejected"
	);
});

test("a stored report with an unknown major or a changed body is not read as valid", async () => {
	const { make, storage, store } = setup();
	const created = await store.prepare(userId, input);
	if (created?.status !== "created") {
		throw new Error("expected a created report");
	}
	const row = storage.rows.get(created.report.id);
	if (!row) {
		throw new Error("expected a stored row");
	}

	storage.rows.set(row.id, {
		...row,
		contractVersion: "erasure-impact-report/2.0.0",
	});
	await expect(make().get(userId, projectId, row.id)).rejects.toThrow(
		contractVersionMessage
	);

	storage.rows.set(row.id, {
		...row,
		scope: { ...row.scope, managedCopies: [] },
	});
	await expect(make().get(userId, projectId, row.id)).rejects.toBeInstanceOf(
		RecordIntegrityError
	);
});
