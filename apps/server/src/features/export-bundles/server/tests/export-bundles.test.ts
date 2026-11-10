import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { ExportBundleSource } from "@sprite-anvil/api/export-bundle-manifest";
import type { ExportBundleSourceReader } from "@sprite-anvil/api/export-bundle-store";
import {
	sha256Hex,
	verifyExportBundle,
} from "@sprite-anvil/api/export-bundle-verification";
import type { ExportProfileStore } from "@sprite-anvil/api/export-profile-store";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import type { ExportBundleStorage } from "../export-bundle-storage";
import { createExportBundleStore } from "../export-bundle-store";
import { createMemoryExportBundleStorage } from "./memory-export-bundle-storage";

const userId = "user-1";
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
const profileId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d1001";
const revisionId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d3001";
const unknownRevisionId = "8b2a3d62-3d2e-4b86-8a7c-0e6c2f0d3999";
const forbiddenContent = /installer|executable|agent_instruction|consumption/i;
const familyId = "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2001";
const assetBytes = Uint8Array.from([137, 80, 78, 71, 1, 2, 3]);
const encoder = new TextEncoder();
const kitPaths = [
	"verification-kit/README.md",
	"verification-kit/checksums.txt",
	"verification-kit/examples/file-mapping.example.json",
	"verification-kit/schema/manifest.schema.json",
	"verification-kit/verify.ts",
];

/** The bundle directory as a consumer holds it: generated text plus the asset bytes. */
function directoryOf(bundle: {
	files: { content: string | null; path: string }[];
}) {
	return bundle.files.map((file) => ({
		bytes: file.content === null ? assetBytes : encoder.encode(file.content),
		path: file.path,
	}));
}

const profileDefinition = {
	fileFormat: "png" as const,
	layout: "grid" as const,
	metadataMapping: [],
	namingTemplate: "{family}_{item}",
	padding: 0,
	scale: 1,
	trim: "none" as const,
};

function resolvedSource(
	overrides: Partial<ExportBundleSource> = {}
): ExportBundleSource {
	return {
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
		...overrides,
	};
}

function setup(
	options: {
		hasAccess?: boolean;
		source?: ExportBundleSource;
		wrapStorage?: (storage: ExportBundleStorage) => ExportBundleStorage;
	} = {}
) {
	let tick = 0;
	const nextTime = () => {
		tick += 1;
		return new Date(Date.UTC(2026, 10, 10, 10, 0, tick));
	};
	const getProjectForUser = (_userId: string, requestedProjectId: string) =>
		Promise.resolve(
			(options.hasAccess ?? true) &&
				[projectId, otherProjectId].includes(requestedProjectId)
				? { id: requestedProjectId }
				: null
		);
	const exportProfileStore: ExportProfileStore = {
		createRevision: () => Promise.resolve(null),
		list: () =>
			Promise.resolve({
				profiles: [
					{
						id: profileId,
						name: "Sheets",
						revisions: [
							{
								contentDigest: "a".repeat(64),
								contractVersion: "1.0.0",
								createdAt: "2026-11-10T09:00:00.000Z",
								definition: profileDefinition,
								id: revisionId,
								revisionNumber: 1,
							},
						],
					},
				],
			}),
	};
	const sourceReader: ExportBundleSourceReader = {
		read: () =>
			Promise.resolve({
				source: options.source ?? resolvedSource(),
				status: "resolved" as const,
			}),
	};
	const storage = createMemoryExportBundleStorage();
	const context = {
		exportBundleStore: createExportBundleStore({} as Database, {
			getProjectForUser,
			now: nextTime,
			profiles: exportProfileStore,
			sourceReader,
			storage: options.wrapStorage ? options.wrapStorage(storage) : storage,
		}),
		session: { user: { id: userId } },
	} as unknown as Context;
	return {
		create: (input: Record<string, unknown> = {}) =>
			call(
				appRouter.exportBundles.create,
				{
					assetFamilyIds: [familyId],
					idempotencyKey: "key-1",
					profileRevisionId: revisionId,
					projectId,
					...input,
				} as never,
				{ context }
			),
		get: (bundleId: string) =>
			call(appRouter.exportBundles.get, { bundleId, projectId }, { context }),
		list: (id = projectId) =>
			call(appRouter.exportBundles.list, { projectId: id }, { context }),
	};
}

test("a created bundle is re-read from storage with its pinned manifest and files", async () => {
	const { create, get, list } = setup();
	const created = await create();

	expect(created.status).toBe("created");
	const reread = await get(created.bundle.id);
	expect(reread).toEqual(created.bundle);
	expect(reread.manifest.profile.revisionId).toBe(revisionId);
	expect(reread.manifest.context.revisionId).toBe("ctx-1");
	expect(reread.manifest.requiredSets[0]?.revisionId).toBe("rs-1");
	expect(reread.adapterVersion).toBeNull();
	expect(reread.deliveryTargetRevisionId).toBeNull();
	expect(reread.manifest.families[0]?.support).toBe("general_asset_support");
	expect(reread.files.map((file) => file.path)).toEqual([
		"checksums.txt",
		"images/hero_idle.png",
		"manifest.json",
		...kitPaths,
	]);

	const catalog = await list();
	expect(catalog.latestBundleId).toBe(created.bundle.id);
	expect(catalog.bundles).toHaveLength(1);
});

test("two bundles from the same exact inputs and profile revision are identical in content", async () => {
	const { create } = setup();
	const first = await create({ idempotencyKey: "key-1" });
	const second = await create({ idempotencyKey: "key-2" });

	expect(second.bundle.id).not.toBe(first.bundle.id);
	expect(second.bundle.manifestDigest).toBe(first.bundle.manifestDigest);
	expect(second.bundle.files).toEqual(first.bundle.files);
	expect(second.bundle.manifest).toEqual(first.bundle.manifest);
});

test("the same idempotency key replays the bundle and never makes a second one", async () => {
	const { create, list } = setup();
	const first = await create();
	const replay = await create();

	expect(replay.status).toBe("replayed");
	expect(replay.bundle).toEqual(first.bundle);
	expect((await list()).bundles).toHaveLength(1);

	await expect(create({ adapterVersion: "godot-1.0.0" })).rejects.toMatchObject(
		{ code: "CONFLICT" }
	);
	expect((await list()).bundles).toHaveLength(1);
});

test("a newer bundle moves the latest marker and leaves the earlier bundle unchanged", async () => {
	const { create, get, list } = setup();
	const first = await create({ idempotencyKey: "key-1" });
	const second = await create({ idempotencyKey: "key-2" });

	const catalog = await list();
	expect(catalog.latestBundleId).toBe(second.bundle.id);
	expect(
		catalog.bundles.find((bundle) => bundle.id === first.bundle.id)?.isLatest
	).toBe(false);
	expect({ ...(await get(first.bundle.id)), isLatest: true }).toEqual(
		first.bundle
	);
});

test("a Required Set item that is not Export-Ready creates no bundle", async () => {
	const { create, list } = setup({
		source: resolvedSource({
			blockers: [
				{ assetFamilyId: familyId, codes: ["quality"], itemId: "idle" },
			],
		}),
	});
	await expect(create()).rejects.toMatchObject({ code: "BAD_REQUEST" });

	const catalog = await list();
	expect(catalog.bundles).toEqual([]);
	expect(catalog.latestBundleId).toBeNull();
});

test("an unknown profile revision is refused", async () => {
	const { create } = setup();
	await expect(
		create({ profileRevisionId: unknownRevisionId })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("a failed write leaves no bundle and no marker", async () => {
	const { create, list } = setup({
		wrapStorage: (storage) => ({
			...storage,
			insertBundle: () => Promise.reject(new Error("disk full")),
		}),
	});
	await expect(create()).rejects.toBeDefined();

	const catalog = await list();
	expect(catalog.bundles).toEqual([]);
	expect(catalog.latestBundleId).toBeNull();
});

test("a stored bundle whose content no longer matches its manifest fails verification", async () => {
	let tampered = false;
	const { create, get } = setup({
		wrapStorage: (storage) => ({
			...storage,
			findBundle: async (...args) => {
				const found = await storage.findBundle(...args);
				return found && tampered
					? {
							...found,
							files: found.files.map((file) =>
								file.path === "checksums.txt"
									? { ...file, content: "tampered\n" }
									: file
							),
						}
					: found;
			},
		}),
	});
	const created = await create();
	tampered = true;
	await expect(get(created.bundle.id)).rejects.toMatchObject({
		code: "CONFLICT",
	});
	await expect(create()).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		get("9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e9999")
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("the bundle holds only images, a manifest, checksums and the data-only kit, never an installer or agent instruction", async () => {
	const { create } = setup();
	const { bundle } = await create();

	for (const file of bundle.files) {
		expect(
			file.path === "manifest.json" ||
				file.path === "checksums.txt" ||
				file.path.startsWith("images/") ||
				file.path.startsWith("verification-kit/")
		).toBe(true);
	}
	expect(JSON.stringify(bundle.manifest)).not.toMatch(forbiddenContent);
});

test("a project the user cannot access is not found", async () => {
	const { create, list } = setup({ hasAccess: false });
	await expect(create()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(list()).rejects.toMatchObject({ code: "NOT_FOUND" });
});

async function sourceWithRealAsset(): Promise<ExportBundleSource> {
	const base = resolvedSource();
	return {
		...base,
		assetVersions: await Promise.all(
			base.assetVersions.map(async (version) => ({
				...version,
				byteSize: assetBytes.length,
				sha256: await sha256Hex(assetBytes),
			}))
		),
	};
}

test("a created bundle stores the Package Verification Kit and passes the offline verifier when re-read", async () => {
	const { create, get } = setup({ source: await sourceWithRealAsset() });
	const created = await create();
	const reread = await get(created.bundle.id);

	const kitFiles = reread.files
		.map((file) => file.path)
		.filter((path) => path.startsWith("verification-kit/"));
	expect(kitFiles).toEqual(kitPaths);
	const kitChecksums = reread.files.find(
		(file) => file.path === "verification-kit/checksums.txt"
	);
	const checksums = reread.files.find((file) => file.path === "checksums.txt");
	expect(kitChecksums?.content).toBe(checksums?.content ?? "missing");

	const result = await verifyExportBundle(directoryOf(reread));
	expect(result).toMatchObject({ ok: true });
});

test("a corrupted kit or asset file is rejected by the verifier and by the store", async () => {
	const { create, get } = setup({ source: await sourceWithRealAsset() });
	const created = await create();
	const files = directoryOf(await get(created.bundle.id));

	const results = await Promise.all(
		["verification-kit/checksums.txt", "images/hero_idle.png"].map((path) =>
			verifyExportBundle(
				files.map((file) =>
					file.path === path
						? { ...file, bytes: encoder.encode("changed") }
						: file
				)
			)
		)
	);
	for (const result of results) {
		expect(result).toMatchObject({ ok: false });
	}

	let tampered = false;
	const tamperedSetup = setup({
		source: await sourceWithRealAsset(),
		wrapStorage: (storage) => ({
			...storage,
			findBundle: async (...args) => {
				const found = await storage.findBundle(...args);
				return found && tampered
					? {
							...found,
							files: found.files.map((file) =>
								file.path === "verification-kit/verify.ts"
									? { ...file, content: "tampered\n" }
									: file
							),
						}
					: found;
			},
		}),
	});
	const second = await tamperedSetup.create();
	tampered = true;
	await expect(tamperedSetup.get(second.bundle.id)).rejects.toMatchObject({
		code: "CONFLICT",
	});
});
