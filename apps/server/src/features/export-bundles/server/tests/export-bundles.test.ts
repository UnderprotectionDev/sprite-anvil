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
		godotOutput: (bundleId: string, id = projectId) =>
			call(
				appRouter.exportBundles.godotOutput,
				{ bundleId, projectId: id },
				{ context }
			),
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

interface TextFile {
	content: string | null;
	path: string;
}

/** A storage whose stored bundle is rewritten after creation, with every recorded digest kept consistent. */
function rewritingStorage(
	rewrite: (files: TextFile[]) => Promise<{
		files: TextFile[];
		manifestDigest?: string;
	}>
) {
	let active = false;
	return {
		activate: () => {
			active = true;
		},
		wrap: (storage: ExportBundleStorage): ExportBundleStorage => ({
			...storage,
			findBundle: async (...args) => {
				const found = await storage.findBundle(...args);
				if (!(found && active)) {
					return found;
				}
				const changed = await rewrite(found.files);
				const files = await Promise.all(
					found.files.map(async (file) => {
						const content =
							changed.files.find((entry) => entry.path === file.path)
								?.content ?? file.content;
						return content === null || content === file.content
							? file
							: {
									...file,
									byteSize: encoder.encode(content).length,
									content,
									sha256: await sha256Hex(encoder.encode(content)),
								};
					})
				);
				return {
					bundle: {
						...found.bundle,
						manifestDigest:
							changed.manifestDigest ?? found.bundle.manifestDigest,
					},
					files,
				};
			},
		}),
	};
}

test("a stored bundle with an altered kit file is rejected even when its recorded digest is consistent", async () => {
	const rewriting = rewritingStorage((files) =>
		Promise.resolve({
			files: files.map((file) =>
				file.path === "verification-kit/verify.ts"
					? { ...file, content: "export {};\n" }
					: file
			),
		})
	);
	const { create, get } = setup({
		source: await sourceWithRealAsset(),
		wrapStorage: rewriting.wrap,
	});
	const created = await create();
	rewriting.activate();
	await expect(get(created.bundle.id)).rejects.toMatchObject({
		code: "CONFLICT",
	});
	await expect(create()).rejects.toMatchObject({ code: "CONFLICT" });
});

test("a stored bundle with a broken record link is rejected even when its manifest and checksums are consistent", async () => {
	const rewriting = rewritingStorage(async (files) => {
		const manifestText = files.find(
			(file) => file.path === "manifest.json"
		)?.content;
		const manifest = JSON.parse(manifestText ?? "{}");
		manifest.productionEvidence = [];
		const nextManifest = `${JSON.stringify(manifest, null, 2)}\n`;
		const digest = await sha256Hex(encoder.encode(nextManifest));
		const checksums = (
			files.find((file) => file.path === "checksums.txt")?.content ?? ""
		)
			.split("\n")
			.map((line) =>
				line.endsWith("  manifest.json") ? `${digest}  manifest.json` : line
			)
			.join("\n");
		return {
			files: files.map((file) => {
				if (file.path === "manifest.json") {
					return { ...file, content: nextManifest };
				}
				return file.path.endsWith("checksums.txt")
					? { ...file, content: checksums }
					: file;
			}),
			manifestDigest: digest,
		};
	});
	const { create, get } = setup({
		source: await sourceWithRealAsset(),
		wrapStorage: rewriting.wrap,
	});
	const created = await create();
	rewriting.activate();
	await expect(get(created.bundle.id)).rejects.toMatchObject({
		code: "CONFLICT",
	});
});

const walkAnimation = {
	assetFamilyId: familyId,
	directions: [
		{
			direction: "south",
			frames: [
				{
					assetVersionId: "av-1",
					durationMs: 100,
					events: [{ id: "step", timeMs: 20 }],
					frameKey: "idle_00",
					pivot: { x: 4, y: 8 },
					region: { height: 16, width: 16, x: 0, y: 0 },
				},
			],
		},
	],
	looping: true,
	name: "idle",
	playbackSpeed: 1,
};

test("Godot output is derived from a stored bundle, repeats exactly and stores nothing", async () => {
	const { create, godotOutput, list } = setup({
		source: resolvedSource({
			engineData: {
				animations: [walkAnimation],
				tilesets: [],
				uiComponents: [],
			},
		}),
	});
	const { bundle } = await create();
	const catalogBefore = await list();

	const first = await godotOutput(bundle.id);
	const second = await godotOutput(bundle.id);

	expect(second).toEqual(first);
	expect(first.bundleId).toBe(bundle.id);
	expect(first.bundleManifestDigest).toBe(bundle.manifestDigest);
	expect(first.files.map((file) => file.path)).toEqual([
		"sprite_anvil/adapter.json",
		"sprite_anvil/animations.json",
		"sprite_anvil/animations/idle.tres",
		"sprite_anvil/textures/hero_idle.png",
	]);
	// The output is a separate result: the bundle and its marker are unchanged.
	expect(await list()).toEqual(catalogBefore);
});

test("Godot output is not found for an unknown bundle or another project, and refused for another adapter", async () => {
	const { create, godotOutput } = setup();
	const { bundle } = await create({ adapterVersion: "unity-adapter/1.0.0" });
	await expect(
		godotOutput("11111111-1111-4111-8111-111111111111")
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(godotOutput(bundle.id, otherProjectId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(godotOutput(bundle.id)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

test("Godot output is not found when the user cannot access the project", async () => {
	const { godotOutput } = setup({ hasAccess: false });
	await expect(
		godotOutput("11111111-1111-4111-8111-111111111111")
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
