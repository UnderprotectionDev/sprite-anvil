/**
 * The Godot Verified Engine Adapter: a pure, deterministic derivation of Godot
 * project files from a stored Engine-Neutral Bundle.
 *
 * The output is a separate user result on top of the immutable bundle. It is
 * derived on demand, never stored and never read back as a source of truth; the
 * same bundle and adapter version always give the same files. Generated files
 * are text (sorted keys, LF, no timestamps). Texture files are referenced by
 * Asset Version, exactly as the bundle references them, and their bytes are
 * added only when the output is packed.
 */
import { zipSync } from "fflate";
import { z } from "zod";
import type { ExportBundleEngineData } from "./export-bundle-engine-data";
import {
	exportBundleHasEngineData,
	exportBundleSha256,
	renderExportBundleChecksums,
	sha256Schema,
} from "./export-bundle-manifest";
import type { ExportBundle } from "./export-bundles";

/** Changes whenever the generated layout or mapping changes. */
export const godotAdapterVersion = "godot-adapter/1.0.0";
/** Godot 4.x stable releases the golden-project contract covers. */
export const godotSupportedEngineVersions = ["4.3", "4.4", "4.5"] as const;

export const godotOutputRoot = "sprite_anvil";

export const godotOutputGetInputSchema = z
	.object({ bundleId: z.uuid(), projectId: z.uuid() })
	.strict();

export const godotOutputFileSchema = z.object({
	assetVersionId: z.string().nullable(),
	byteSize: z.number().int().positive(),
	/** Text of a generated file; null for a texture referenced by `assetVersionId`. */
	content: z.string().nullable(),
	path: z.string(),
	sha256: sha256Schema,
});
export const godotOutputSchema = z.object({
	adapterVersion: z.string(),
	bundleId: z.string(),
	bundleManifestDigest: sha256Schema,
	files: z.array(godotOutputFileSchema),
	outputDigest: sha256Schema,
	supportedGodotVersions: z.array(z.string()),
});
export type GodotOutput = z.infer<typeof godotOutputSchema>;
export type GodotOutputFile = z.infer<typeof godotOutputFileSchema>;

export type GodotOutputRejection =
	| { ok: false; reason: "engine_data_missing" }
	| {
			bundleAdapterVersion: string;
			ok: false;
			reason: "adapter_version_mismatch";
	  }
	| { assetVersionIds: string[]; ok: false; reason: "texture_missing" };

export type GodotOutputResult =
	| { ok: true; output: GodotOutput }
	| GodotOutputRejection;

const encoder = new TextEncoder();

function compare(left: string, right: string): number {
	return Number(left > right) - Number(left < right);
}

function slug(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "item"
	);
}

/** A slug that is unique among the names already taken, in the order names arrive. */
function uniqueSlug(value: string, taken: Set<string>): string {
	const base = slug(value);
	let candidate = base;
	for (let n = 2; taken.has(candidate); n += 1) {
		candidate = `${base}-${n}`;
	}
	taken.add(candidate);
	return candidate;
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => compare(left, right))
				.map(([key, member]) => [key, sortKeys(member)])
		);
	}
	return value;
}

function renderJson(value: unknown): string {
	return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function gdFloat(value: number): string {
	return Number.isInteger(value) ? `${value}.0` : String(value);
}

function gcd(left: number, right: number): number {
	return right === 0 ? left : gcd(right, left % right);
}

interface Region {
	height: number;
	width: number;
	x: number;
	y: number;
}

function rect2(region: Region): string {
	return `Rect2(${region.x}, ${region.y}, ${region.width}, ${region.height})`;
}

const imagesPrefix = /^images\//;

function texturePath(manifestPath: string): string {
	return `${godotOutputRoot}/textures/${manifestPath.replace(imagesPrefix, "")}`;
}

interface TextureRef {
	assetVersionId: string;
	byteSize: number;
	path: string;
	sha256: string;
}

type Animation = ExportBundleEngineData["animations"][number];
type AnimationDirection = Animation["directions"][number];

/** Ordered, unique texture references of a resource, with their resource ids. */
class TextureTable {
	private readonly ids = new Map<string, string>();
	readonly byVersion: Map<string, TextureRef>;

	constructor(byVersion: Map<string, TextureRef>) {
		this.byVersion = byVersion;
	}

	idOf(assetVersionId: string): string {
		let id = this.ids.get(assetVersionId);
		if (!id) {
			id = `${this.ids.size + 1}_tex`;
			this.ids.set(assetVersionId, id);
		}
		return id;
	}

	renderExternal(): string[] {
		return [...this.ids.entries()].map(([versionId, id]) => {
			const ref = this.byVersion.get(versionId);
			return `[ext_resource type="Texture2D" path="res://${ref?.path}" id="${id}"]`;
		});
	}

	get size(): number {
		return this.ids.size;
	}
}

interface PlayableDirection {
	/** The unique Godot animation name of the direction within its animation. */
	animation: string;
	direction: AnimationDirection;
	/** Greatest common divisor of the frame durations; always positive. */
	step: number;
}

/**
 * The directions Godot can play, in order, with unique animation names. A
 * direction without frames or without a positive duration has no speed to
 * derive, so it is left out of every generated file.
 */
function playableDirections(animation: Animation): PlayableDirection[] {
	const taken = new Set<string>();
	return animation.directions.flatMap((direction) => {
		const step = direction.frames.reduce(
			(common, frame) => gcd(common, frame.durationMs),
			0
		);
		return step > 0
			? [{ animation: uniqueSlug(direction.direction, taken), direction, step }]
			: [];
	});
}

function renderSpriteFrames(
	animation: Animation,
	byVersion: Map<string, TextureRef>
): string {
	const table = new TextureTable(byVersion);
	const atlas: string[] = [];
	const entries = playableDirections(animation).map(
		({ animation: name, direction, step }) => {
			const frames = direction.frames.map((frame) => {
				const textureId = table.idOf(frame.assetVersionId);
				let texture = `ExtResource("${textureId}")`;
				if (frame.region) {
					const atlasId = `AtlasTexture_${atlas.length + 1}`;
					atlas.push(
						`[sub_resource type="AtlasTexture" id="${atlasId}"]\natlas = ExtResource("${textureId}")\nregion = ${rect2(frame.region)}\n`
					);
					texture = `SubResource("${atlasId}")`;
				}
				return `{\n"duration": ${gdFloat(frame.durationMs / step)},\n"texture": ${texture}\n}`;
			});
			return `{\n"frames": [${frames.join(", ")}],\n"loop": ${animation.looping},\n"name": &"${name}",\n"speed": ${gdFloat(1000 / step)}\n}`;
		}
	);
	return [
		`[gd_resource type="SpriteFrames" load_steps=${table.size + atlas.length + 1} format=3]\n`,
		`${table.renderExternal().join("\n")}\n`,
		...atlas,
		`[resource]\nanimations = [${entries.join(", ")}]\n`,
	].join("\n");
}

function offsetOf(
	pivot: { x: number; y: number } | null,
	region: Region | null
): { x: number; y: number } | null {
	return pivot && region
		? { x: region.width / 2 - pivot.x, y: region.height / 2 - pivot.y }
		: null;
}

function animationJson(
	animation: Animation,
	resource: string,
	byVersion: Map<string, TextureRef>
) {
	return {
		directions: playableDirections(animation).map(
			({ animation: name, direction }) => ({
				animation: name,
				direction: direction.direction,
				frames: direction.frames.map((frame) => ({
					assetVersionId: frame.assetVersionId,
					durationMs: frame.durationMs,
					events: frame.events,
					frameKey: frame.frameKey,
					offset: offsetOf(frame.pivot, frame.region),
					pivot: frame.pivot,
					region: frame.region,
					texture: `res://${byVersion.get(frame.assetVersionId)?.path}`,
				})),
			})
		),
		looping: animation.looping,
		name: animation.name,
		playbackSpeed: animation.playbackSpeed,
		resource,
	};
}

type Tileset = ExportBundleEngineData["tilesets"][number];

function renderTileSet(
	tileset: Tileset,
	byVersion: Map<string, TextureRef>
): string {
	const table = new TextureTable(byVersion);
	const hasTerrain = tileset.tiles.some((tile) => tile.terrainId !== null);
	const sources = tileset.tiles.map((tile, index) => {
		const textureId = table.idOf(tile.assetVersionId);
		const lines = [
			`[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_${index + 1}"]`,
			`texture = ExtResource("${textureId}")`,
			...(tile.region.x === 0 && tile.region.y === 0
				? []
				: [`margins = Vector2i(${tile.region.x}, ${tile.region.y})`]),
			`texture_region_size = Vector2i(${tile.region.width}, ${tile.region.height})`,
			"0:0/0 = 0",
			...(tile.terrainId === null
				? []
				: [`0:0/0/custom_data_0 = ${JSON.stringify(tile.terrainId)}`]),
		];
		return `${lines.join("\n")}\n`;
	});
	// A TileSet has one tile_size; each source keeps its own texture_region_size.
	// The smallest tile gives the same size whatever the tile order.
	const tileWidth = Math.min(...tileset.tiles.map((tile) => tile.region.width));
	const tileHeight = Math.min(
		...tileset.tiles.map((tile) => tile.region.height)
	);
	return [
		`[gd_resource type="TileSet" load_steps=${table.size + sources.length + 1} format=3]\n`,
		`${table.renderExternal().join("\n")}\n`,
		...sources,
		`${[
			"[resource]",
			`tile_size = Vector2i(${tileset.tiles.length > 0 ? tileWidth : 0}, ${tileset.tiles.length > 0 ? tileHeight : 0})`,
			...(hasTerrain
				? [
						'custom_data_layer_0/name = "terrain"',
						"custom_data_layer_0/type = 4",
					]
				: []),
			...tileset.tiles.map(
				(_, index) =>
					`sources/${index} = SubResource("TileSetAtlasSource_${index + 1}")`
			),
		].join("\n")}\n`,
	].join("\n");
}

interface DraftFile {
	assetVersionId: string | null;
	byteSize: number;
	content: string | null;
	path: string;
	sha256: string;
}

async function textFile(path: string, content: string): Promise<DraftFile> {
	return {
		assetVersionId: null,
		byteSize: encoder.encode(content).length,
		content,
		path,
		sha256: await exportBundleSha256(content),
	};
}

function missingTextures(
	data: ExportBundleEngineData,
	byVersion: Map<string, TextureRef>
): string[] {
	const used = [
		...data.animations.flatMap((animation) =>
			animation.directions.flatMap((direction) =>
				direction.frames.map((frame) => frame.assetVersionId)
			)
		),
		...data.tilesets.flatMap((tileset) =>
			tileset.tiles.map((tile) => tile.assetVersionId)
		),
		...data.uiComponents.flatMap((component) =>
			component.states.map((state) => state.assetVersionId)
		),
	];
	return [...new Set(used.filter((id) => !byVersion.has(id)))].sort(compare);
}

/**
 * Derives the Godot output of one stored bundle. A bundle that pinned no
 * engine data (manifest contract 1.0.0), that names another adapter, or whose
 * game data points at a texture the bundle does not hold gets no output.
 */
export async function buildGodotOutput(
	bundle: Pick<ExportBundle, "id" | "manifest" | "manifestDigest">
): Promise<GodotOutputResult> {
	const { manifest } = bundle;
	const data = manifest.engineData;
	if (!(data && exportBundleHasEngineData(manifest.contractVersion))) {
		return { ok: false, reason: "engine_data_missing" };
	}
	if (
		manifest.adapterVersion !== null &&
		manifest.adapterVersion !== godotAdapterVersion
	) {
		return {
			bundleAdapterVersion: manifest.adapterVersion,
			ok: false,
			reason: "adapter_version_mismatch",
		};
	}
	const textures = new Map<string, TextureRef>(
		manifest.files.map((file) => [
			file.assetVersionId,
			{
				assetVersionId: file.assetVersionId,
				byteSize: file.byteSize,
				path: texturePath(file.path),
				sha256: file.sha256,
			},
		])
	);
	const missing = missingTextures(data, textures);
	if (missing.length > 0) {
		return { assetVersionIds: missing, ok: false, reason: "texture_missing" };
	}

	const pending: { content: string; path: string }[] = [];

	const taken = new Set<string>();
	const animations: ReturnType<typeof animationJson>[] = [];
	for (const animation of data.animations) {
		const name = uniqueSlug(animation.name, taken);
		const path = `${godotOutputRoot}/animations/${name}.tres`;
		pending.push({ content: renderSpriteFrames(animation, textures), path });
		animations.push(animationJson(animation, `res://${path}`, textures));
	}
	if (animations.length > 0) {
		pending.push({
			content: renderJson({ animations }),
			path: `${godotOutputRoot}/animations.json`,
		});
	}

	const tileNames = new Set<string>();
	const tilesets: Record<string, unknown>[] = [];
	for (const tileset of data.tilesets) {
		const name = uniqueSlug(tileset.compositeVersionId, tileNames);
		const path = `${godotOutputRoot}/tiles/${name}.tres`;
		pending.push({ content: renderTileSet(tileset, textures), path });
		tilesets.push({
			compositeVersionId: tileset.compositeVersionId,
			resource: `res://${path}`,
			tiles: tileset.tiles.map((tile) => ({
				assetVersionId: tile.assetVersionId,
				edges: tile.edges,
				region: tile.region,
				terrainId: tile.terrainId,
				unitVersionId: tile.unitVersionId,
			})),
		});
	}
	if (tilesets.length > 0) {
		pending.push({
			content: renderJson({ tilesets }),
			path: `${godotOutputRoot}/tilesets.json`,
		});
	}

	if (data.uiComponents.length > 0) {
		pending.push({
			content: renderJson({
				components: data.uiComponents.map((component) => ({
					id: component.id,
					states: component.states.map((state) => ({
						id: state.id,
						naturalSize: state.naturalSize,
						patchMargin: state.stretchMargins,
						textSafeArea: state.textSafeArea,
						texture: `res://${textures.get(state.assetVersionId)?.path}`,
					})),
				})),
			}),
			path: `${godotOutputRoot}/ui.json`,
		});
	}

	const drafts: DraftFile[] = [
		...[...textures.values()].map((ref) => ({
			assetVersionId: ref.assetVersionId,
			byteSize: ref.byteSize,
			content: null,
			path: ref.path,
			sha256: ref.sha256,
		})),
		...(await Promise.all(
			pending.map((file) => textFile(file.path, file.content))
		)),
	];

	drafts.push(
		await textFile(
			`${godotOutputRoot}/adapter.json`,
			renderJson({
				adapterVersion: godotAdapterVersion,
				bundleId: bundle.id,
				bundleManifestDigest: bundle.manifestDigest,
				files: drafts
					.map((file) => ({ path: file.path, sha256: file.sha256 }))
					.sort((left, right) => compare(left.path, right.path)),
				profileRevisionId: manifest.profile.revisionId,
				supportedGodotVersions: godotSupportedEngineVersions,
				textureFilter: "nearest",
			})
		)
	);

	const files = drafts.sort((left, right) => compare(left.path, right.path));
	return {
		ok: true,
		output: {
			adapterVersion: godotAdapterVersion,
			bundleId: bundle.id,
			bundleManifestDigest: bundle.manifestDigest,
			files,
			outputDigest: await exportBundleSha256(
				renderExportBundleChecksums(files)
			),
			supportedGodotVersions: [...godotSupportedEngineVersions],
		},
	};
}

/**
 * The zip's fixed timestamp, so equal output zips to equal bytes. A zip stores
 * the local wall-clock fields of its mtime, so a Date built from local fields
 * stores the same fields in every time zone; noon avoids a midnight that a
 * zone's clock change could skip.
 */
const zipTimestamp = new Date(1980, 0, 1, 12, 0, 0);

/**
 * Packs the output into one zip with a fixed timestamp and path order.
 * `textureBytes` maps each Asset Version id to its file bytes.
 */
export function buildGodotOutputZip(
	output: Pick<GodotOutput, "files">,
	textureBytes: Map<string, Uint8Array>
): Uint8Array {
	const entries: Record<string, [Uint8Array, { level: 0 | 6; mtime: Date }]> =
		{};
	for (const file of output.files) {
		if (file.content === null) {
			const bytes = file.assetVersionId
				? textureBytes.get(file.assetVersionId)
				: undefined;
			if (!bytes) {
				throw new Error(
					`Texture bytes are missing for ${file.assetVersionId ?? file.path}.`
				);
			}
			entries[file.path] = [bytes, { level: 0, mtime: zipTimestamp }];
		} else {
			entries[file.path] = [
				encoder.encode(file.content),
				{ level: 6, mtime: zipTimestamp },
			];
		}
	}
	return zipSync(entries);
}
