/**
 * Test fixture for the Godot golden-project contract: a fixed Engine-Neutral
 * Bundle with animation, tile and UI data, and real PNG bytes for its
 * textures. Never imported by product code.
 */

import { crc32 } from "node:zlib";
import { zlibSync } from "fflate";
import type { ExportBundleEngineData } from "../src/export-bundle-engine-data";
import { buildExportBundle } from "../src/export-bundle-manifest";
import type { ExportBundle } from "../src/export-bundles";
import {
	fixtureProfile,
	fixtureSource,
} from "./export-bundle-verification-fixture";

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

/** A valid opaque RGBA PNG of one colour, so Godot can import it. */
export function solidPng(
	width: number,
	height: number,
	rgb: [number, number, number]
): Uint8Array {
	const row = new Uint8Array(1 + width * 4);
	for (let x = 0; x < width; x += 1) {
		row.set([...rgb, 255], 1 + x * 4);
	}
	const raw = new Uint8Array(row.length * height);
	for (let y = 0; y < height; y += 1) {
		raw.set(row, y * row.length);
	}
	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	header.set([8, 6, 0, 0, 0], 8);
	const parts = [
		Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", header),
		chunk("IDAT", zlibSync(raw)),
		chunk("IEND", new Uint8Array()),
	];
	const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		png.set(part, offset);
		offset += part.length;
	}
	return png;
}

/** Texture bytes by fixture Asset Version id. */
export const goldenTextures = {
	"av-1": solidPng(16, 16, [200, 40, 40]),
	"av-2": solidPng(32, 16, [40, 40, 200]),
} as const;

export const goldenEngineData: ExportBundleEngineData = {
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
			playbackSpeed: 1,
		},
	],
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
					naturalSize: { height: 16, width: 16 },
					stretchMargins: { bottom: 4, left: 5, right: 6, top: 7 },
					textSafeArea: { height: 8, width: 8, x: 4, y: 4 },
				},
			],
		},
	],
};

/** The golden bundle as the exportBundles router returns it. */
export async function buildGoldenBundle(): Promise<ExportBundle> {
	const built = await buildExportBundle(
		{ ...(await fixtureSource()), engineData: goldenEngineData },
		{
			adapterVersion: null,
			deliveryTargetRevisionId: null,
			profile: fixtureProfile,
		}
	);
	if (!built.ok) {
		throw new Error("The golden bundle must build.");
	}
	const { manifest } = built.bundle;
	return {
		adapterVersion: null,
		contextRevisionId: manifest.context.revisionId,
		contractVersion: manifest.contractVersion,
		createdAt: "2026-11-01T10:00:00.000Z",
		deliveryTargetRevisionId: null,
		files: built.bundle.files,
		id: "11111111-1111-4111-8111-111111111111",
		isLatest: true,
		manifest,
		// Fixed, so the golden output does not change when the verification kit text does.
		manifestDigest: "f".repeat(64),
		profileId: manifest.profile.profileId,
		profileRevisionId: manifest.profile.revisionId,
	};
}
