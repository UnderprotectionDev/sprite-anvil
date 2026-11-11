import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import {
	classifyDeliveryRefreshPaths,
	type DeliveryRefreshDecision,
	planDeliveryRefresh,
} from "@sprite-anvil/api/delivery-refresh-classification";
import type { DeliveryRefreshLock } from "@sprite-anvil/api/delivery-refresh-locks";
import {
	buildExportBundle,
	type ExportBundleSource,
} from "@sprite-anvil/api/export-bundle-manifest";
import type { ExportBundleStore } from "@sprite-anvil/api/export-bundle-store";
import type { ExportBundle } from "@sprite-anvil/api/export-bundles";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import type { DeliveryRefreshLockStorage } from "../delivery-refresh-lock-storage";
import { createDeliveryRefreshLockStore } from "../delivery-refresh-lock-store";
import { createMemoryDeliveryRefreshLockStorage } from "./memory-delivery-refresh-lock-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const profileId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d1001";
const revisionId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d3001";
const familyId = "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2001";
const bundleId = "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2002";
const secondBundleId = "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2003";
const missingId = "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2999";
const unsafePathPattern = /\\|\.\.|^[a-z]:/i;
const forbiddenContent = /consumption|receipt|sync/i;
const outOfScopeRouterName = /receipt|consumption|bidirectional|continuous/i;

const source: ExportBundleSource = {
	assetVersions: [
		{
			assetFamilyId: familyId,
			assetRecordId: "rec-1",
			byteSize: 120,
			contentType: "image/png",
			id: "av-1",
			productionEvidenceDigest: "b".repeat(64),
			providerGenerationRecordId: null,
			sha256: "c".repeat(64),
			versionNumber: 1,
		},
	],
	blockers: [],
	compositeVersions: [],
	context: { revisionId: "ctx-1", revisionNumber: 1 },
	families: [
		{
			assetFamilyId: familyId,
			assetFamilyName: "Hero",
			profileContractRevisionIds: [],
			requiredSet: {
				items: [
					{
						assetRecordIds: ["rec-1"],
						disposition: "required",
						id: "idle",
						kind: "state",
						name: "Idle",
					},
				],
				revisionId: "rs-1",
				revisionNumber: 1,
			},
			selections: [{ assetVersionIds: ["av-1"], itemId: "idle" }],
		},
	],
	quality: [],
	rights: [
		{
			assetRecordId: "rec-1",
			rightsRecordId: "rr-1",
			state: "documented",
			versionNumber: 1,
		},
	],
	unitVersions: [],
};

const profile = {
	contentDigest: "a".repeat(64),
	contractVersion: "1.0.0",
	definition: {
		fileFormat: "png" as const,
		layout: "grid" as const,
		metadataMapping: [],
		namingTemplate: "{family}_{item}",
		padding: 0,
		scale: 1,
		trim: "none" as const,
	},
	profileId,
	revisionId,
	revisionNumber: 1,
};

/** The same source with the one asset's bytes changed: the second bundle differs from the first in one asset. */
function withAssetDigest(sha256: string): ExportBundleSource {
	return {
		...source,
		assetVersions: source.assetVersions.map((version) => ({
			...version,
			sha256,
		})),
	};
}

/** An immutable Export Bundle as the Export Bundle store re-reads it, built from the real manifest builder. */
async function builtBundle(
	id: string,
	assetSha256 = "c".repeat(64)
): Promise<ExportBundle> {
	const built = await buildExportBundle(withAssetDigest(assetSha256), {
		adapterVersion: null,
		deliveryTargetRevisionId: null,
		profile,
	});
	if (!built.ok) {
		throw new Error("The test bundle did not build.");
	}
	return {
		adapterVersion: null,
		contextRevisionId: "ctx-1",
		contractVersion: built.bundle.manifest.contractVersion,
		createdAt: "2026-11-11T09:00:00.000Z",
		deliveryTargetRevisionId: null,
		files: built.bundle.files,
		id,
		isLatest: true,
		manifest: built.bundle.manifest,
		manifestDigest: built.bundle.manifestDigest,
		profileId,
		profileRevisionId: revisionId,
	};
}

function setup(
	options: {
		hasAccess?: boolean;
		wrapStorage?: (
			storage: DeliveryRefreshLockStorage
		) => DeliveryRefreshLockStorage;
	} = {}
) {
	let tick = 0;
	const now = () => {
		tick += 1;
		return new Date(Date.UTC(2026, 10, 11, 10, 0, tick));
	};
	const getProjectForUser = (_userId: string, requested: string) =>
		Promise.resolve(
			(options.hasAccess ?? true) &&
				[projectId, otherProjectId].includes(requested)
				? { id: requested }
				: null
		);
	const bundles = new Map<string, ExportBundle>();
	const bundleStore: ExportBundleStore = {
		create: () => Promise.resolve(null),
		get: (_userId, requestedProjectId, requestedBundleId) =>
			Promise.resolve(
				requestedProjectId === projectId
					? (bundles.get(requestedBundleId) ?? null)
					: null
			),
		list: () => Promise.resolve(null),
	};
	const lockStorage = createMemoryDeliveryRefreshLockStorage();
	const context = {
		deliveryRefreshLockStore: createDeliveryRefreshLockStore({} as Database, {
			bundles: bundleStore,
			getProjectForUser,
			now,
			storage: options.wrapStorage
				? options.wrapStorage(lockStorage)
				: lockStorage,
		}),
		session: { user: { id: userId } },
	} as unknown as Context;

	const createBundle = async (id = bundleId, assetSha256?: string) => {
		const bundle = await builtBundle(id, assetSha256);
		bundles.set(id, bundle);
		return bundle;
	};
	/** What a surface reports after writing a bundle to a destination folder. */
	const writtenBy = (bundle: ExportBundle) =>
		bundle.files.map(({ path, sha256 }) => ({ path, sha256 }));

	return {
		apply: (input: Record<string, unknown>) =>
			call(
				appRouter.deliveryRefreshLocks.apply,
				{
					destinationLabel: "Test game folder",
					idempotencyKey: "apply-1",
					projectId,
					...input,
				} as never,
				{ context }
			),
		createBundle,
		refresh: (input: Record<string, unknown>) =>
			call(
				appRouter.deliveryRefreshLocks.refresh,
				{ idempotencyKey: "refresh-1", projectId, ...input } as never,
				{ context }
			),
		get: (lockId: string, id = projectId) =>
			call(
				appRouter.deliveryRefreshLocks.get,
				{ lockId, projectId: id },
				{ context }
			),
		list: (id = projectId) =>
			call(appRouter.deliveryRefreshLocks.list, { projectId: id }, { context }),
		readBundle: (id: string) => bundles.get(id),
		removeBundle: (id: string) => bundles.delete(id),
		writtenBy,
	};
}

test("applying a bundle writes a lock bound to the exact bundle and profile revision, re-read from storage", async () => {
	const { apply, createBundle, get, list, writtenBy } = setup();
	const bundle = await createBundle();

	const { lock, status } = await apply({
		bundleId: bundle.id,
		written: writtenBy(bundle),
	});

	expect(status).toBe("created");
	expect(lock.bundleId).toBe(bundle.id);
	expect(lock.bundleManifestDigest).toBe(bundle.manifestDigest);
	expect(lock.profile).toMatchObject({
		contentDigest: "a".repeat(64),
		profileId,
		revisionId,
		revisionNumber: 1,
	});
	expect(lock.destinationLabel).toBe("Test game folder");
	expect(lock.contractVersion).toBe("1.0.0");
	expect(lock.files.map((file) => file.path)).toEqual(
		bundle.files.map((file) => file.path)
	);
	expect(lock.files).toEqual(
		bundle.files.map(({ byteSize, path, sha256 }) => ({
			byteSize,
			path,
			sha256,
		}))
	);

	expect(await get(lock.id)).toEqual(lock);
	expect((await list()).locks).toEqual([
		expect.objectContaining({ bundleId: bundle.id, id: lock.id }),
	]);
});

test("the lock carries no absolute path, secret, receipt or sync state", async () => {
	const { apply, createBundle, writtenBy } = setup();
	const bundle = await createBundle();
	const { lock } = await apply({
		bundleId: bundle.id,
		written: writtenBy(bundle),
	});

	for (const file of lock.files) {
		expect(file.path.startsWith("/")).toBe(false);
		expect(file.path).not.toMatch(unsafePathPattern);
	}
	expect(JSON.stringify(lock)).not.toMatch(forbiddenContent);
});

test("a destination label that is a local path is refused", async () => {
	const { apply, createBundle, list, writtenBy } = setup();
	const bundle = await createBundle();

	const labels = ["/Users/me/game", "C:\\games\\mine", "~/game", "../game"];
	const outcomes = await Promise.allSettled(
		labels.map((destinationLabel) =>
			apply({
				bundleId: bundle.id,
				destinationLabel,
				written: writtenBy(bundle),
			})
		)
	);
	for (const outcome of outcomes) {
		expect(outcome.status).toBe("rejected");
		expect((outcome as PromiseRejectedResult).reason).toMatchObject({
			code: "BAD_REQUEST",
		});
	}
	expect((await list()).locks).toHaveLength(0);
});

test("a partial application is not a success and writes no lock", async () => {
	const { apply, createBundle, list, writtenBy } = setup();
	const bundle = await createBundle();
	const [, ...partial] = writtenBy(bundle);

	await expect(
		apply({ bundleId: bundle.id, written: partial })
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "written_files_incomplete" },
	});
	expect((await list()).locks).toHaveLength(0);
});

test("a written file with another digest, or a path outside the bundle, writes no lock", async () => {
	const { apply, createBundle, list, writtenBy } = setup();
	const bundle = await createBundle();
	const written = writtenBy(bundle);

	await expect(
		apply({
			bundleId: bundle.id,
			written: written.map((file, index) =>
				index === 0 ? { ...file, sha256: "f".repeat(64) } : file
			),
		})
	).rejects.toMatchObject({
		data: { paths: [written[0]?.path], reason: "written_digest_mismatch" },
	});
	await expect(
		apply({
			bundleId: bundle.id,
			written: [
				...written,
				{ path: "local-notes.txt", sha256: "d".repeat(64) },
			],
		})
	).rejects.toMatchObject({
		data: { paths: ["local-notes.txt"], reason: "written_path_not_in_bundle" },
	});
	await expect(
		apply({
			bundleId: bundle.id,
			written: [...written, { path: "../escape.png", sha256: "d".repeat(64) }],
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect((await list()).locks).toHaveLength(0);
});

test("a missing bundle or project creates nothing", async () => {
	const { apply } = setup();
	await expect(
		apply({ bundleId: missingId, written: [] })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		apply({
			bundleId: missingId,
			written: [{ path: "a.png", sha256: "a".repeat(64) }],
		})
	).rejects.toMatchObject({
		data: { reason: "bundle_unavailable" },
	});

	const denied = setup({ hasAccess: false });
	await expect(
		denied.apply({
			bundleId: missingId,
			written: [{ path: "a.png", sha256: "a".repeat(64) }],
		})
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("the same idempotency key replays the lock and never makes a second one", async () => {
	const { apply, createBundle, list, writtenBy } = setup();
	const bundle = await createBundle();
	const input = { bundleId: bundle.id, written: writtenBy(bundle) };

	const first = await apply(input);
	const replay = await apply(input);

	expect(replay.status).toBe("replayed");
	expect(replay.lock).toEqual(first.lock);
	expect((await list()).locks).toHaveLength(1);

	await expect(
		apply({ ...input, destinationLabel: "Another folder" })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect((await list()).locks).toHaveLength(1);
});

test("a failed write leaves no partial lock and a retry with the same key succeeds", async () => {
	let failNext = true;
	const { apply, createBundle, list, writtenBy } = setup({
		wrapStorage: (storage) => ({
			...storage,
			insertLock: (lock, files) => {
				if (failNext) {
					failNext = false;
					return Promise.reject(new Error("write failed"));
				}
				return storage.insertLock(lock, files);
			},
		}),
	});
	const bundle = await createBundle();
	const input = { bundleId: bundle.id, written: writtenBy(bundle) };

	await expect(apply(input)).rejects.toBeDefined();
	expect((await list()).locks).toHaveLength(0);
	expect((await apply(input)).status).toBe("created");
	expect((await list()).locks).toHaveLength(1);
});

test("a stored lock whose files changed fails the integrity check on read", async () => {
	let tamper = false;
	const { apply, createBundle, get, writtenBy } = setup({
		wrapStorage: (storage) => ({
			...storage,
			findLock: async (project, lockId) => {
				const found = await storage.findLock(project, lockId);
				if (found && tamper) {
					found.files[0] = {
						...found.files[0],
						sha256: "e".repeat(64),
					} as never;
				}
				return found;
			},
		}),
	});
	const bundle = await createBundle();
	const { lock } = await apply({
		bundleId: bundle.id,
		written: writtenBy(bundle),
	});
	tamper = true;

	await expect(get(lock.id)).rejects.toMatchObject({ code: "CONFLICT" });
});

test("listing locks whose bundle is gone is a verification conflict, not an unhandled error", async () => {
	const { apply, createBundle, list, removeBundle, writtenBy } = setup();
	const bundle = await createBundle();
	await apply({ bundleId: bundle.id, written: writtenBy(bundle) });
	removeBundle(bundle.id);

	await expect(list()).rejects.toMatchObject({ code: "CONFLICT" });
});

test("locks are scoped to their project and bundles stay immutable", async () => {
	const { apply, createBundle, get, list, writtenBy } = setup();
	const bundle = await createBundle();
	const { lock } = await apply({
		bundleId: bundle.id,
		written: writtenBy(bundle),
	});

	expect((await list(otherProjectId)).locks).toHaveLength(0);
	await expect(get(lock.id, otherProjectId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(get(missingId)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

/** A destination folder as a surface sees it: relative path to the SHA-256 of its bytes. */
type Folder = Map<string, string>;

const editedByHand = "f".repeat(64);

const sha256Of = (bundle: ExportBundle, path: string) =>
	bundle.files.find((file) => file.path === path)?.sha256 as string;
const unrecognisedFile = "my-own-notes.txt";
const unrecognisedDigest = "9".repeat(64);

/** The folder after the first apply, a hand edit and an unrecognised local file. */
function folderAfterFirstApply(first: ExportBundle, editedPath: string) {
	const folder: Folder = new Map(first.files.map((f) => [f.path, f.sha256]));
	folder.set(editedPath, editedByHand);
	folder.set(unrecognisedFile, unrecognisedDigest);
	return folder;
}

/**
 * What a surface does for a refresh: observe the owned and bundle paths, classify them
 * with the shared module, write the paths the plan allows, and report both sides.
 */
function surfaceRefresh(
	folder: Folder,
	previous: DeliveryRefreshLock,
	next: ExportBundle,
	decisions: DeliveryRefreshDecision[] = []
) {
	const paths = [
		...new Set([
			...previous.files.map((file) => file.path),
			...next.files.map((file) => file.path),
		]),
	];
	const observed = paths.map((path) => ({
		path,
		sha256: folder.get(path) ?? null,
	}));
	const classification = classifyDeliveryRefreshPaths({
		next: next.files,
		observed,
		previous: previous.files,
	});
	const plan = planDeliveryRefresh(classification, decisions);
	const nextDigest = new Map(next.files.map((f) => [f.path, f.sha256]));
	const written = plan.applied.map((path) => ({
		path,
		sha256: nextDigest.get(path) as string,
	}));
	for (const { path, sha256 } of written) {
		folder.set(path, sha256);
	}
	return { classification, decisions, observed, plan, written };
}

async function firstDelivery() {
	const harness = setup();
	const first = await harness.createBundle(bundleId);
	const second = await harness.createBundle(secondBundleId, "d".repeat(64));
	const { lock } = await harness.apply({
		bundleId: first.id,
		written: harness.writtenBy(first),
	});
	const editedPath = second.files.find((file) =>
		file.path.startsWith("images/")
	)?.path as string;
	return {
		...harness,
		editedPath,
		first,
		folder: folderAfterFirstApply(first, editedPath),
		previous: lock,
		second,
	};
}

test("refresh separates the five path classes and never touches an unrecognised file", async () => {
	const { editedPath, folder, previous, second } = await firstDelivery();
	// The user already put the new checksum list in place by hand.
	folder.set("checksums.txt", sha256Of(second, "checksums.txt"));

	const { classification } = surfaceRefresh(folder, previous, second);
	const byClass = (name: string) =>
		classification.entries
			.filter((entry) => entry.class === name)
			.map((entry) => entry.path);

	expect(byClass("diverged")).toEqual([editedPath]);
	expect(byClass("to-update")).toContain("manifest.json");
	expect(byClass("unchanged")).toEqual(["checksums.txt"]);
	expect(classification.entries.map((entry) => entry.path)).not.toContain(
		unrecognisedFile
	);
	expect(folder.get(unrecognisedFile)).toBe(unrecognisedDigest);
});

test("a hand-edited owned file halts the refresh: applied and halted are reported apart and no lock is made", async () => {
	const { editedPath, folder, list, previous, refresh, second } =
		await firstDelivery();
	const report = surfaceRefresh(folder, previous, second);

	const result = await refresh({
		bundleId: second.id,
		decisions: report.decisions,
		observed: report.observed,
		previousLockId: previous.id,
		written: report.written,
	});

	expect(result.status).toBe("halted");
	if (result.status !== "halted") {
		throw new Error("expected a halted refresh");
	}
	expect(result.halted.map((entry) => entry.path)).toEqual([editedPath]);
	expect(result.applied).toEqual(report.written.map((file) => file.path));
	expect(result.applied).not.toContain(editedPath);
	expect(folder.get(editedPath)).toBe(editedByHand);
	expect("lock" in result).toBe(false);
	expect((await list()).locks).toHaveLength(1);
});

test("replace after the decision refreshes every owned path into a new lock and keeps the history untouched", async () => {
	const {
		editedPath,
		first,
		folder,
		get,
		list,
		previous,
		readBundle,
		refresh,
		second,
	} = await firstDelivery();
	const bundlesBefore = structuredClone([
		readBundle(first.id),
		readBundle(second.id),
	]);
	const decisions: DeliveryRefreshDecision[] = [
		{ decision: "replace", path: editedPath },
	];
	const report = surfaceRefresh(folder, previous, second, decisions);

	const result = await refresh({
		bundleId: second.id,
		decisions,
		observed: report.observed,
		previousLockId: previous.id,
		written: report.written,
	});

	expect(result.status).toBe("created");
	if (result.status !== "created") {
		throw new Error("expected a created refresh");
	}
	expect(result.outcome).toBe("complete");
	expect(result.lock.bundleId).toBe(second.id);
	expect(result.lock.destinationLabel).toBe(previous.destinationLabel);
	expect(result.lock.contractVersion).toBe("1.0.0");
	expect(result.lock.files.map((file) => file.path)).toEqual(
		second.files.map((file) => file.path)
	);
	expect(result.applied).toContain(editedPath);
	expect(folder.get(editedPath)).toBe(
		second.files.find((file) => file.path === editedPath)?.sha256
	);
	expect(folder.get(unrecognisedFile)).toBe(unrecognisedDigest);

	expect(await get(result.lock.id)).toEqual(result.lock);
	expect(await get(previous.id)).toEqual(previous);
	expect((await list()).locks).toHaveLength(2);
	expect([readBundle(first.id), readBundle(second.id)]).toEqual(bundlesBefore);
});

test("preserving the diverged file refreshes the rest, shows a partial result and does not claim the preserved path", async () => {
	const { editedPath, folder, previous, refresh, second } =
		await firstDelivery();
	const decisions: DeliveryRefreshDecision[] = [
		{ decision: "preserve", path: editedPath },
	];
	const report = surfaceRefresh(folder, previous, second, decisions);

	const result = await refresh({
		bundleId: second.id,
		decisions,
		observed: report.observed,
		previousLockId: previous.id,
		written: report.written,
	});

	expect(result.status).toBe("created");
	if (result.status !== "created") {
		throw new Error("expected a created refresh");
	}
	expect(result.outcome).toBe("partial");
	expect(result.preserved).toEqual([
		{ decision: "preserve", path: editedPath },
	]);
	expect(result.lock.files.map((file) => file.path)).not.toContain(editedPath);
	expect(folder.get(editedPath)).toBe(editedByHand);
});

test("the server refuses a diverged path in the written set without a replace decision", async () => {
	const { editedPath, folder, list, previous, refresh, second } =
		await firstDelivery();
	const report = surfaceRefresh(folder, previous, second);
	const edited = second.files.find((file) => file.path === editedPath);
	const withDiverged = [
		...report.written,
		{ path: editedPath, sha256: edited?.sha256 as string },
	];

	await expect(
		refresh({
			bundleId: second.id,
			decisions: [],
			observed: report.observed,
			previousLockId: previous.id,
			written: withDiverged,
		})
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { paths: [editedPath], reason: "diverged_path_not_released" },
	});
	await expect(
		refresh({
			bundleId: second.id,
			decisions: [{ decision: "preserve", path: editedPath }],
			observed: report.observed,
			previousLockId: previous.id,
			written: withDiverged,
		})
	).rejects.toMatchObject({
		data: { reason: "diverged_path_not_released" },
	});
	expect((await list()).locks).toHaveLength(1);
});

test("a refresh that writes an unrecognised path, a wrong digest or too little is rejected and makes no lock", async () => {
	const { editedPath, folder, list, previous, refresh, second } =
		await firstDelivery();
	const decisions: DeliveryRefreshDecision[] = [
		{ decision: "replace", path: editedPath },
	];
	folder.set("checksums.txt", sha256Of(second, "checksums.txt"));
	const report = surfaceRefresh(folder, previous, second, decisions);
	const base = {
		bundleId: second.id,
		decisions,
		observed: report.observed,
		previousLockId: previous.id,
	};

	await expect(
		refresh({
			...base,
			written: [
				...report.written,
				{ path: unrecognisedFile, sha256: unrecognisedDigest },
			],
		})
	).rejects.toMatchObject({
		data: { paths: [unrecognisedFile], reason: "written_path_not_in_bundle" },
	});
	await expect(
		refresh({
			...base,
			written: report.written.map((file, index) =>
				index === 0 ? { ...file, sha256: "e".repeat(64) } : file
			),
		})
	).rejects.toMatchObject({
		data: { reason: "written_digest_mismatch" },
	});
	await expect(
		refresh({ ...base, written: report.written.slice(1) })
	).rejects.toMatchObject({
		data: { reason: "written_files_incomplete" },
	});
	await expect(
		refresh({
			...base,
			written: [
				...report.written,
				{ path: "checksums.txt", sha256: sha256Of(second, "checksums.txt") },
			],
		})
	).rejects.toMatchObject({
		data: { paths: ["checksums.txt"], reason: "written_path_not_expected" },
	});
	expect((await list()).locks).toHaveLength(1);
});

test("a decision for a path that is not diverged is rejected", async () => {
	const { folder, list, previous, refresh, second } = await firstDelivery();
	const report = surfaceRefresh(folder, previous, second);

	await expect(
		refresh({
			bundleId: second.id,
			decisions: [{ decision: "replace", path: "manifest.json" }],
			observed: report.observed,
			previousLockId: previous.id,
			written: report.written,
		})
	).rejects.toMatchObject({
		data: { paths: ["manifest.json"], reason: "decision_not_applicable" },
	});
	expect((await list()).locks).toHaveLength(1);
});

test("a refresh whose observation omits a path, or adds an unrecognised one, is rejected and makes no lock", async () => {
	const { editedPath, folder, list, previous, refresh, second } =
		await firstDelivery();
	const report = surfaceRefresh(folder, previous, second, [
		{ decision: "preserve", path: editedPath },
	]);
	const base = {
		bundleId: second.id,
		decisions: report.decisions,
		previousLockId: previous.id,
		written: report.written,
	};

	// Omitting the hand-edited path would make it look absent and release it for overwrite.
	await expect(
		refresh({
			...base,
			decisions: [],
			observed: report.observed.filter((o) => o.path !== editedPath),
		})
	).rejects.toMatchObject({
		data: { paths: [editedPath], reason: "observation_incomplete" },
	});
	await expect(
		refresh({
			...base,
			observed: [
				...report.observed,
				{ path: unrecognisedFile, sha256: unrecognisedDigest },
			],
		})
	).rejects.toMatchObject({
		data: { paths: [unrecognisedFile], reason: "observation_not_expected" },
	});
	await expect(
		refresh({
			...base,
			observed: [...report.observed, report.observed[0]],
		})
	).rejects.toMatchObject({
		data: {
			paths: [report.observed[0]?.path],
			reason: "observation_not_expected",
		},
	});
	expect((await list()).locks).toHaveLength(1);
});

test("a lock with an unknown major version, or a missing required field, stops the refresh", async () => {
	let mutate:
		| ((found: { lock: Record<string, unknown>; files: unknown[] }) => void)
		| null = null;
	const harness = setup({
		wrapStorage: (storage) => ({
			...storage,
			findLock: async (project, lockId) => {
				const found = await storage.findLock(project, lockId);
				if (found && mutate) {
					mutate(found as never);
				}
				return found;
			},
		}),
	});
	const first = await harness.createBundle(bundleId);
	const second = await harness.createBundle(secondBundleId, "d".repeat(64));
	const { lock } = await harness.apply({
		bundleId: first.id,
		written: harness.writtenBy(first),
	});
	const folder: Folder = new Map(first.files.map((f) => [f.path, f.sha256]));
	const report = surfaceRefresh(folder, lock, second);
	const input = {
		bundleId: second.id,
		decisions: [],
		observed: report.observed,
		previousLockId: lock.id,
		written: report.written,
	};

	mutate = (found) => {
		found.lock.contractVersion = "2.0.0";
	};
	await expect(harness.refresh(input)).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "lock_version_unsupported" },
	});
	mutate = (found) => {
		found.lock.destinationLabel = undefined;
	};
	await expect(harness.refresh(input)).rejects.toMatchObject({
		data: { reason: "lock_malformed" },
	});
	mutate = null;
	expect((await harness.list()).locks).toHaveLength(1);
});

test("a refresh is idempotent: the same key replays the lock and a different request on that key conflicts", async () => {
	const { editedPath, folder, list, previous, refresh, second } =
		await firstDelivery();
	const decisions: DeliveryRefreshDecision[] = [
		{ decision: "replace", path: editedPath },
	];
	const report = surfaceRefresh(folder, previous, second, decisions);
	const input = {
		bundleId: second.id,
		decisions,
		observed: report.observed,
		previousLockId: previous.id,
		written: report.written,
	};

	const created = await refresh(input);
	const replay = await refresh(input);

	expect(replay.status).toBe("replayed");
	if (created.status === "halted" || replay.status === "halted") {
		throw new Error("expected locks");
	}
	expect(replay.lock).toEqual(created.lock);
	expect(replay.applied).toEqual(created.applied);
	expect((await list()).locks).toHaveLength(2);

	await expect(
		refresh({
			...input,
			decisions: [{ decision: "preserve", path: editedPath }],
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect((await list()).locks).toHaveLength(2);
});

test("a failed write leaves no partial refresh and a retry with the same key succeeds", async () => {
	let failNext = false;
	const harness = setup({
		wrapStorage: (storage) => ({
			...storage,
			insertLock: (row, files) => {
				if (failNext) {
					failNext = false;
					return Promise.reject(new Error("write failed"));
				}
				return storage.insertLock(row, files);
			},
		}),
	});
	const first = await harness.createBundle(bundleId);
	const second = await harness.createBundle(secondBundleId, "d".repeat(64));
	const { lock } = await harness.apply({
		bundleId: first.id,
		written: harness.writtenBy(first),
	});
	const folder: Folder = new Map(first.files.map((f) => [f.path, f.sha256]));
	const report = surfaceRefresh(folder, lock, second);
	const input = {
		bundleId: second.id,
		decisions: [],
		observed: report.observed,
		previousLockId: lock.id,
		written: report.written,
	};

	failNext = true;
	await expect(harness.refresh(input)).rejects.toBeDefined();
	expect((await harness.list()).locks).toHaveLength(1);
	expect((await harness.refresh(input)).status).toBe("created");
	expect((await harness.list()).locks).toHaveLength(2);
});

test("refresh is scoped to the project and the user's own lock and bundle", async () => {
	const { folder, previous, refresh, second } = await firstDelivery();
	const report = surfaceRefresh(folder, previous, second);
	const input = {
		bundleId: second.id,
		decisions: [],
		observed: report.observed,
		previousLockId: previous.id,
		written: report.written,
	};

	await expect(
		refresh({ ...input, previousLockId: missingId })
	).rejects.toMatchObject({
		data: { reason: "previous_lock_unavailable" },
	});
	await expect(
		refresh({ ...input, bundleId: missingId })
	).rejects.toMatchObject({ data: { reason: "bundle_unavailable" } });
	await expect(
		refresh({ ...input, projectId: otherProjectId })
	).rejects.toMatchObject({ data: { reason: "bundle_unavailable" } });

	const denied = setup({ hasAccess: false });
	await expect(denied.refresh(input)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

test("refresh stays one-way: no continuous sync, no Consumption Receipt and no deletion", async () => {
	const { editedPath, folder, previous, refresh, second } =
		await firstDelivery();
	const decisions: DeliveryRefreshDecision[] = [
		{ decision: "replace", path: editedPath },
	];
	const report = surfaceRefresh(folder, previous, second, decisions);
	const result = await refresh({
		bundleId: second.id,
		decisions,
		observed: report.observed,
		previousLockId: previous.id,
		written: report.written,
	});

	expect(Object.keys(appRouter.deliveryRefreshLocks).sort()).toEqual([
		"apply",
		"get",
		"list",
		"refresh",
	]);
	expect(
		Object.keys(appRouter).filter((name) => outOfScopeRouterName.test(name))
	).toEqual([]);
	expect(JSON.stringify(result)).not.toMatch(forbiddenContent);
	expect(Object.keys(result)).not.toContain("deleted");
	expect(JSON.stringify(report.classification)).not.toMatch(forbiddenContent);
});
