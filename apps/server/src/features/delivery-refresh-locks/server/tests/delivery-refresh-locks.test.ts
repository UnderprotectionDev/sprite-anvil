import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
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
const missingId = "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2999";
const unsafePathPattern = /\\|\.\.|^[a-z]:/i;
const forbiddenContent = /consumption|receipt|sync/i;

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

/** An immutable Export Bundle as the Export Bundle store re-reads it, built from the real manifest builder. */
async function builtBundle(id: string): Promise<ExportBundle> {
	const built = await buildExportBundle(source, {
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

	const createBundle = async (id = bundleId) => {
		const bundle = await builtBundle(id);
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
		get: (lockId: string, id = projectId) =>
			call(
				appRouter.deliveryRefreshLocks.get,
				{ lockId, projectId: id },
				{ context }
			),
		list: (id = projectId) =>
			call(appRouter.deliveryRefreshLocks.list, { projectId: id }, { context }),
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
