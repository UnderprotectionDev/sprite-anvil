import { expect, test } from "bun:test";
import { unzipSync } from "fflate";
import {
	fixtureProfile,
	fixtureSource,
} from "../test-support/export-bundle-verification-fixture";
import type { ExportBundleEngineData } from "./export-bundle-engine-data";
import { buildExportBundle } from "./export-bundle-manifest";
import type { ExportBundle } from "./export-bundles";
import {
	buildGodotOutput,
	buildGodotOutputZip,
	godotAdapterVersion,
	godotSupportedEngineVersions,
} from "./godot-output";

const sha256Pattern = /^[0-9a-f]{64}$/;

const engineData: ExportBundleEngineData = {
	animations: [
		{
			assetFamilyId: "fam-1",
			directions: [
				{
					direction: "south",
					frames: [
						{
							assetVersionId: "av-2",
							durationMs: 120,
							events: [{ id: "footstep", timeMs: 40 }],
							frameKey: "walk_01",
							pivot: { x: 8, y: 15 },
							region: { height: 16, width: 16, x: 16, y: 0 },
						},
						{
							assetVersionId: "av-2",
							durationMs: 80,
							events: [],
							frameKey: "walk_00",
							pivot: null,
							region: null,
						},
					],
				},
			],
			looping: true,
			name: "Walk Cycle",
			playbackSpeed: 1.5,
		},
	],
	tilesets: [],
	uiComponents: [],
};

const tilesAndUi: ExportBundleEngineData = {
	...engineData,
	tilesets: [
		{
			assetFamilyId: "fam-1",
			compositeVersionId: "cv-1",
			tiles: [
				{
					assetVersionId: "av-1",
					edges: { east: "g", north: null, south: null, west: "g" },
					region: { height: 16, width: 16, x: 0, y: 0 },
					terrainId: "grass",
					unitVersionId: "uv-1",
				},
			],
		},
	],
	uiComponents: [
		{
			assetFamilyId: "fam-1",
			id: "button",
			states: [
				{
					assetVersionId: "av-1",
					id: "normal",
					naturalSize: { height: 24, width: 48 },
					stretchMargins: { bottom: 4, left: 5, right: 6, top: 7 },
					textSafeArea: { height: 16, width: 40, x: 4, y: 4 },
				},
			],
		},
	],
};

async function bundleWith(
	data: ExportBundleEngineData | undefined,
	adapterVersion: string | null = null
): Promise<ExportBundle> {
	const source = await fixtureSource();
	const built = await buildExportBundle(
		{ ...source, engineData: data },
		{ adapterVersion, deliveryTargetRevisionId: null, profile: fixtureProfile }
	);
	if (!built.ok) {
		throw new Error("The fixture bundle must build.");
	}
	const { manifest, manifestDigest } = built.bundle;
	return {
		adapterVersion,
		contextRevisionId: manifest.context.revisionId,
		contractVersion: manifest.contractVersion,
		createdAt: "2026-11-01T10:00:00.000Z",
		deliveryTargetRevisionId: null,
		files: built.bundle.files,
		id: "11111111-1111-4111-8111-111111111111",
		isLatest: true,
		manifest,
		manifestDigest,
		profileId: manifest.profile.profileId,
		profileRevisionId: manifest.profile.revisionId,
	};
}

async function output(bundle: ExportBundle) {
	const result = await buildGodotOutput(bundle);
	if (!result.ok) {
		throw new Error(`expected output, got ${result.reason}`);
	}
	return result.output;
}

function textOf(
	built: Awaited<ReturnType<typeof output>>,
	path: string
): string {
	const file = built.files.find((entry) => entry.path === path);
	if (typeof file?.content !== "string") {
		throw new Error(`expected generated text at ${path}`);
	}
	return file.content;
}

test("the same bundle and adapter version give the same output", async () => {
	const first = await output(await bundleWith(engineData));
	const second = await output(await bundleWith(engineData));
	expect(second).toEqual(first);
	expect(first.files.map((file) => file.path)).toEqual(
		[...first.files.map((file) => file.path)].sort()
	);
	expect(first.adapterVersion).toBe(godotAdapterVersion);
	expect(first.outputDigest).toMatch(sha256Pattern);
});

test("states the adapter version, the supported Godot range and the source bundle", async () => {
	const bundle = await bundleWith(engineData);
	const built = await output(bundle);
	expect(godotSupportedEngineVersions).toEqual(["4.3", "4.4", "4.5"]);
	const adapter = JSON.parse(textOf(built, "sprite_anvil/adapter.json"));
	expect(adapter.adapterVersion).toBe(godotAdapterVersion);
	expect(adapter.supportedGodotVersions).toEqual(["4.3", "4.4", "4.5"]);
	expect(adapter.bundleId).toBe(bundle.id);
	expect(adapter.bundleManifestDigest).toBe(bundle.manifestDigest);
	expect(
		adapter.files.map((file: { path: string }) => file.path)
	).not.toContain("sprite_anvil/adapter.json");
});

test("references each pinned texture by Asset Version without copying bytes", async () => {
	const built = await output(await bundleWith(engineData));
	const texture = built.files.find(
		(file) => file.path === "sprite_anvil/textures/hero_walk.png"
	);
	expect(texture).toMatchObject({ assetVersionId: "av-2", content: null });
	const manifestFile = (await bundleWith(engineData)).manifest.files.find(
		(file) => file.assetVersionId === "av-2"
	);
	expect(texture?.sha256).toBe(manifestFile?.sha256);
});

test("maps frame region and duration into a SpriteFrames resource", async () => {
	const built = await output(await bundleWith(engineData));
	const tres = textOf(built, "sprite_anvil/animations/walk-cycle.tres");
	// 120 ms and 80 ms share a 40 ms step: 25 frames per second, 3x and 2x.
	expect(tres).toContain('"speed": 25.0');
	expect(tres).toContain('"duration": 3.0');
	expect(tres).toContain('"duration": 2.0');
	expect(tres).toContain("region = Rect2(16, 0, 16, 16)");
	expect(tres).toContain('"loop": true');
	expect(tres).toContain('"name": &"south"');
	expect(tres).toContain('path="res://sprite_anvil/textures/hero_walk.png"');
	expect(tres.indexOf("Rect2(16, 0, 16, 16)")).toBeGreaterThan(-1);
});

test("keeps millisecond timing, pivot, offset and events in animations.json", async () => {
	const built = await output(await bundleWith(engineData));
	const data = JSON.parse(textOf(built, "sprite_anvil/animations.json"));
	expect(data.animations).toEqual([
		{
			directions: [
				{
					animation: "south",
					direction: "south",
					frames: [
						{
							assetVersionId: "av-2",
							durationMs: 120,
							events: [{ id: "footstep", timeMs: 40 }],
							frameKey: "walk_01",
							offset: { x: 0, y: -7 },
							pivot: { x: 8, y: 15 },
							region: { height: 16, width: 16, x: 16, y: 0 },
							texture: "res://sprite_anvil/textures/hero_walk.png",
						},
						{
							assetVersionId: "av-2",
							durationMs: 80,
							events: [],
							frameKey: "walk_00",
							offset: null,
							pivot: null,
							region: null,
							texture: "res://sprite_anvil/textures/hero_walk.png",
						},
					],
				},
			],
			looping: true,
			name: "Walk Cycle",
			playbackSpeed: 1.5,
			resource: "res://sprite_anvil/animations/walk-cycle.tres",
		},
	]);
});

test("omits tile and UI output when the families carry none", async () => {
	const built = await output(await bundleWith(engineData));
	const paths = built.files.map((file) => file.path);
	expect(paths.some((path) => path.startsWith("sprite_anvil/tiles"))).toBe(
		false
	);
	expect(paths).not.toContain("sprite_anvil/tilesets.json");
	expect(paths).not.toContain("sprite_anvil/ui.json");
});

test("maps tile data to a TileSet and UI data to nine-patch margins", async () => {
	const built = await output(await bundleWith(tilesAndUi));
	const tres = textOf(built, "sprite_anvil/tiles/cv-1.tres");
	expect(tres).toContain("texture_region_size = Vector2i(16, 16)");
	expect(tres).toContain('0:0/0/custom_data_0 = "grass"');
	expect(tres).toContain("tile_size = Vector2i(16, 16)");
	const tilesets = JSON.parse(textOf(built, "sprite_anvil/tilesets.json"));
	expect(tilesets.tilesets[0].tiles[0].edges).toEqual({
		east: "g",
		north: null,
		south: null,
		west: "g",
	});
	const ui = JSON.parse(textOf(built, "sprite_anvil/ui.json"));
	expect(ui.components[0].states[0]).toEqual({
		id: "normal",
		naturalSize: { height: 24, width: 48 },
		patchMargin: { bottom: 4, left: 5, right: 6, top: 7 },
		textSafeArea: { height: 16, width: 40, x: 4, y: 4 },
		texture: "res://sprite_anvil/textures/hero_idle.png",
	});
});

test("refuses a bundle that pins no engine data, another adapter, or a missing texture", async () => {
	const legacy = await bundleWith(engineData);
	const { engineData: _omitted, ...manifest } = legacy.manifest;
	expect(
		await buildGodotOutput({
			...legacy,
			manifest: { ...manifest, contractVersion: "1.0.0" },
		})
	).toMatchObject({ ok: false, reason: "engine_data_missing" });
	expect(
		await buildGodotOutput(await bundleWith(engineData, "unity-adapter/1.0.0"))
	).toMatchObject({ ok: false, reason: "adapter_version_mismatch" });
	const missing = await bundleWith({
		...engineData,
		animations: [
			{
				...(engineData
					.animations[0] as ExportBundleEngineData["animations"][number]),
				directions: [
					{
						direction: "south",
						frames: [
							{
								assetVersionId: "av-unknown",
								durationMs: 100,
								events: [],
								frameKey: "x",
								pivot: null,
								region: null,
							},
						],
					},
				],
			},
		],
	});
	expect(await buildGodotOutput(missing)).toMatchObject({
		assetVersionIds: ["av-unknown"],
		ok: false,
		reason: "texture_missing",
	});
});

test("a bundle that pins no game data still gives textures and the adapter record", async () => {
	const built = await output(await bundleWith(undefined));
	expect(built.files.map((file) => file.path)).toEqual([
		"sprite_anvil/adapter.json",
		"sprite_anvil/textures/hero_idle.png",
		"sprite_anvil/textures/hero_walk.png",
	]);
});

test("a bundle pinned to this adapter version is accepted", async () => {
	const built = await buildGodotOutput(
		await bundleWith(engineData, godotAdapterVersion)
	);
	expect(built.ok).toBe(true);
});

test("the zip is deterministic and carries every file at its path", async () => {
	const built = await output(await bundleWith(engineData));
	const textures = new Map([
		["av-1", Uint8Array.from([137, 80, 78, 71, 1, 2, 3])],
		["av-2", Uint8Array.from([137, 80, 78, 71, 9, 8, 7, 6])],
	]);
	const first = buildGodotOutputZip(built, textures);
	const second = buildGodotOutputZip(built, textures);
	expect(first).toEqual(second);
	const entries = unzipSync(first);
	expect(Object.keys(entries).sort()).toEqual(
		built.files.map((file) => file.path)
	);
	expect([...(entries["sprite_anvil/textures/hero_walk.png"] ?? [])]).toEqual([
		137, 80, 78, 71, 9, 8, 7, 6,
	]);
});

test("the zip is refused when a texture's bytes are missing", async () => {
	const built = await output(await bundleWith(engineData));
	expect(() => buildGodotOutputZip(built, new Map())).toThrow(
		"Texture bytes are missing for av-1"
	);
});
