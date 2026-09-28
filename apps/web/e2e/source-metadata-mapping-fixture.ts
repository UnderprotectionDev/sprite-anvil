import { createHash } from "node:crypto";

const sourceFileName = "walking-sheet.png";
const frameRectangle = { h: 16, w: 16, x: 0, y: 0 };

function frameWithPivot(pivot: { x: number; y: number }, duration?: number) {
	return {
		...(duration === undefined ? {} : { duration }),
		filename: "walk-0",
		frame: frameRectangle,
		pivot,
	};
}

function jsonBytes(value: unknown) {
	return Buffer.from(JSON.stringify(value));
}

export const sourceMetadataMappingFixture = {
	aseprite: {
		contentType: "application/json",
		fileName: "aseprite-sidecar.json",
		format: "aseprite",
		jsonLayout: "array",
		version: "1.3.10",
		bytes: jsonBytes({
			frames: [frameWithPivot({ x: 1, y: 0 }, 100)],
			meta: {
				app: "http://www.aseprite.org/",
				frameTags: [{ direction: "forward", from: 0, name: "walk", to: 0 }],
				image: sourceFileName,
				palette: [{ a: 255, b: 0, g: 0, r: 0 }],
				version: "1.3.10",
			},
		}),
	},
	source: {
		contentType: "image/png",
		fileName: sourceFileName,
		bytes: Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==",
			"base64"
		),
	},
	texturePacker: {
		contentType: "application/json",
		fileName: "texture-packer-sidecar.json",
		format: "texture-packer",
		jsonLayout: "array",
		version: "1.0",
		bytes: jsonBytes({
			frames: [frameWithPivot({ x: 0.5, y: 1 })],
			meta: {
				app: "http://www.codeandweb.com/texturepacker",
				image: sourceFileName,
				version: "1.0",
			},
		}),
	},
} as const;

export function sourceMetadataMappingFixtureHash(bytes: Uint8Array) {
	return createHash("sha256").update(bytes).digest("hex");
}
