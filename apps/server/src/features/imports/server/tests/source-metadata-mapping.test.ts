import { describe, expect, test } from "bun:test";
import { parseSourceMetadataSidecar } from "../source-metadata-mapping";

const entryId = "6f0a51a5-5ac0-4b3e-9a43-4f0f0b0f2a11";
const asepriteApp = "https://www.aseprite.org/";
const texturePackerApp = "https://www.codeandweb.com/texturepacker";

function parse(document: unknown) {
	return parseSourceMetadataSidecar({
		entryId,
		fileName: "sheet.json",
		sha256: "a".repeat(64),
		text: typeof document === "string" ? document : JSON.stringify(document),
	});
}

function frame(overrides: Record<string, unknown> = {}) {
	return { frame: { x: 0, y: 0, w: 16, h: 16 }, ...overrides };
}

function arrayDocument(meta: Record<string, unknown>, frames: unknown[]) {
	return { frames, meta: { app: asepriteApp, version: "1.3", ...meta } };
}

describe("source metadata sidecar acceptance", () => {
	test.each([
		["text that is not JSON", "{not json"],
		["a top-level array", [frame()]],
		["a document without meta", { frames: [frame()] }],
		["a meta array", { frames: [frame()], meta: [] }],
	])("rejects %s as invalid JSON", (_label, document) => {
		expect(parse(document)).toEqual({ ok: false, reason: "invalid_json" });
	});

	test.each([
		["a missing app", { version: "1" }],
		["a non-string app", { app: 42, version: "1" }],
		["an app that is not a URL", { app: "aseprite", version: "1" }],
		["an unknown host", { app: "https://example.com/", version: "1" }],
		[
			"a CodeAndWeb path outside TexturePacker",
			{ app: "https://codeandweb.com/physicseditor", version: "1" },
		],
	])("rejects %s as an unsupported format", (_label, meta) => {
		expect(parse({ frames: [frame({ filename: "a" })], meta })).toEqual({
			ok: false,
			reason: "unsupported_format",
		});
	});

	test.each([
		["a missing version", { app: asepriteApp }, [frame({ filename: "a" })]],
		[
			"a blank version",
			{ app: asepriteApp, version: "  " },
			[frame({ filename: "a" })],
		],
		["frames that are a string", { app: asepriteApp, version: "1" }, "frames"],
		["an empty frame list", { app: asepriteApp, version: "1" }, []],
		["an empty frame hash", { app: asepriteApp, version: "1" }, {}],
		[
			"an array frame without a filename",
			{ app: asepriteApp, version: "1" },
			[frame()],
		],
		[
			"an array frame with a blank filename",
			{ app: asepriteApp, version: "1" },
			[frame({ filename: " " })],
		],
		[
			"a negative frame origin",
			{ app: asepriteApp, version: "1" },
			[frame({ filename: "a", frame: { x: -1, y: 0, w: 1, h: 1 } })],
		],
		[
			"a zero frame width",
			{ app: asepriteApp, version: "1" },
			[frame({ filename: "a", frame: { x: 0, y: 0, w: 0, h: 1 } })],
		],
		[
			"a fractional frame coordinate",
			{ app: asepriteApp, version: "1" },
			[frame({ filename: "a", frame: { x: 0.5, y: 0, w: 1, h: 1 } })],
		],
		[
			"an unsafe frame integer",
			{ app: asepriteApp, version: "1" },
			[
				frame({
					filename: "a",
					frame: { x: 2 ** 53, y: 0, w: 1, h: 1 },
				}),
			],
		],
		[
			"a frame rectangle given as a string",
			{ app: asepriteApp, version: "1" },
			[frame({ filename: "a", frame: { x: "0", y: 0, w: 1, h: 1 } })],
		],
		[
			"a frame rectangle that is an array",
			{ app: asepriteApp, version: "1" },
			[frame({ filename: "a", frame: [0, 0, 1, 1] })],
		],
	])("rejects %s as invalid JSON", (_label, meta, frames) => {
		expect(parse({ frames, meta })).toEqual({
			ok: false,
			reason: "invalid_json",
		});
	});

	test("rejects a JSON number that overflows to infinity in a frame", () => {
		expect(
			parse(
				`{"frames":[{"filename":"a","frame":{"x":1e400,"y":0,"w":1,"h":1}}],"meta":{"app":"${asepriteApp}","version":"1"}}`
			)
		).toEqual({ ok: false, reason: "invalid_json" });
	});

	test("accepts Aseprite hosts with and without www and TexturePacker paths", () => {
		for (const app of [
			"http://aseprite.org/",
			"https://WWW.Aseprite.org/docs",
			texturePackerApp,
			"http://codeandweb.com/texturepacker/download",
		]) {
			const result = parse({
				frames: { walk: frame() },
				meta: { app, version: "2" },
			});
			expect(result.ok).toBe(true);
		}
	});
});

describe("source metadata sidecar fields and diagnostics", () => {
	test("reads frame, duration, pivot and nine-slice fields from a hash layout", () => {
		const result = parse({
			frames: {
				walk: frame({
					duration: 90,
					pivot: { x: 0.5, y: 1 },
					scale9: { x: 1 },
					ninePatch: { y: 2 },
					nineSlice: { z: 3 },
					rotated: false,
				}),
			},
			meta: { app: texturePackerApp, version: "7.0" },
		});
		if (!result.ok) {
			throw new Error("Expected the sidecar to parse.");
		}
		expect(result.sidecar).toMatchObject({
			format: "texture-packer",
			jsonLayout: "hash",
			version: "7.0",
		});
		expect(
			result.fields.map(({ field, key, sourcePath, value }) => [
				field,
				key,
				sourcePath,
				value,
			])
		).toEqual([
			[
				"frame",
				"walk",
				"frames.walk",
				{ frame: { x: 0, y: 0, w: 16, h: 16 }, rotated: false },
			],
			["duration", "walk", "frames.walk.duration", 90],
			["pivot", "walk", "frames.walk.pivot", { x: 0.5, y: 1 }],
			["nine-slice", "walk", "frames.walk.nineSlice", { z: 3 }],
			["nine-slice", "walk", "frames.walk.ninePatch", { y: 2 }],
			["nine-slice", "walk", "frames.walk.scale9", { x: 1 }],
		]);
		expect(result.diagnostics).toEqual([]);
	});

	test("reports tag, slice and slice key diagnostics with their source paths", () => {
		const result = parse(
			arrayDocument(
				{
					frameTags: [{ name: "idle", from: 0, to: 0 }, { name: " " }, "run"],
					slices: [
						{ name: "button", keys: [{ frame: 0, center: { x: 1 } }, 7] },
						{ name: "panel" },
						{ keys: [] },
						{
							name: "badge",
							keys: [{ frame: 2, pivot: { x: 3, y: 4 }, center: null }],
						},
						{ name: "icon", keys: [{ frame: 1, pivot: [1, 2] }] },
					],
				},
				[frame({ filename: "walk-0" })]
			)
		);
		if (!result.ok) {
			throw new Error("Expected the sidecar to parse.");
		}
		expect(
			result.diagnostics.map(({ message, severity, sourcePath }) => [
				sourcePath,
				severity,
				message,
			])
		).toEqual([
			["meta.frameTags[1]", "warning", "Tag name is missing"],
			["meta.frameTags[2]", "warning", "Tag name is missing"],
			["meta.slices[0].keys[1]", "warning", "Slice key is not an object"],
			["meta.slices[1].keys", "warning", "Slice keys are missing"],
			["meta.slices[2]", "warning", "Slice name is missing"],
		]);
		expect(
			result.fields
				.filter(({ field }) => field !== "frame")
				.map(({ field, key, sourcePath }) => [field, key, sourcePath])
		).toEqual([
			["tag", "idle", "meta.frameTags[0]"],
			["slice", "button", "meta.slices[0]"],
			["nine-slice", "button", "meta.slices[0].keys[0].center"],
			["slice", "panel", "meta.slices[1]"],
			["slice", "badge", "meta.slices[3]"],
			["nine-slice", "badge", "meta.slices[3].keys[0].center"],
			["pivot", "badge", "meta.slices[3].keys[0].pivot"],
			["slice", "icon", "meta.slices[4]"],
		]);
		expect(
			result.fields.find(
				({ field, key }) => field === "pivot" && key === "badge"
			)?.value
		).toEqual({ frame: 2, x: 3, y: 4 });
	});

	test("reports non-array tag and slice lists", () => {
		const result = parse(
			arrayDocument({ frameTags: { idle: {} }, slices: "button" }, [
				frame({ filename: "walk-0" }),
			])
		);
		if (!result.ok) {
			throw new Error("Expected the sidecar to parse.");
		}
		expect(
			result.diagnostics.map(({ message, sourcePath }) => [sourcePath, message])
		).toEqual([
			["meta.frameTags", "Tag list is not an array"],
			["meta.slices", "Slice list is not an array"],
		]);
	});

	test("reads animations and palettes from the document or meta and ignores non-object animations", () => {
		const fromDocument = parse({
			...arrayDocument({ animations: { ignored: ["x"] } }, [
				frame({ filename: "walk-0" }),
			]),
			animations: { walk: ["walk-0"] },
			palette: ["#000"],
		});
		const fromMeta = parse(
			arrayDocument({ animations: { run: ["walk-0"] }, palette: ["#fff"] }, [
				frame({ filename: "walk-0" }),
			])
		);
		const arrayAnimations = parse(
			arrayDocument({ animations: ["walk"] }, [frame({ filename: "walk-0" })])
		);
		if (!(fromDocument.ok && fromMeta.ok && arrayAnimations.ok)) {
			throw new Error("Expected every sidecar to parse.");
		}
		expect(
			fromDocument.fields
				.filter(({ field }) => field !== "frame")
				.map(({ field, key, value }) => [field, key, value])
		).toEqual([
			["tag", "walk", { frames: ["walk-0"], name: "walk" }],
			["palette", "palette", ["#000"]],
		]);
		expect(
			fromMeta.fields
				.filter(({ field }) => field !== "frame")
				.map(({ field, key, value }) => [field, key, value])
		).toEqual([
			["tag", "run", { frames: ["walk-0"], name: "run" }],
			["palette", "palette", ["#fff"]],
		]);
		expect(arrayAnimations.fields.map(({ field }) => field)).toEqual(["frame"]);
	});
});
