// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GameplayMetadataOverlay } from "./gameplay-metadata-overlay";

const { drawCalls } = vi.hoisted(() => ({
	drawCalls: [] as { method: string; args: unknown[] }[],
}));

vi.mock("pixi.js", () => {
	class Graphics {
		rect(...args: unknown[]) {
			drawCalls.push({ method: "rect", args });
			return this;
		}
		moveTo(...args: unknown[]) {
			drawCalls.push({ method: "moveTo", args });
			return this;
		}
		lineTo(...args: unknown[]) {
			drawCalls.push({ method: "lineTo", args });
			return this;
		}
		stroke() {
			drawCalls.push({ method: "stroke", args: [] });
			return this;
		}
	}
	class Application {
		canvas = document.createElement("canvas");
		stage = {
			addChild: () => undefined,
			scale: { set: () => undefined },
		};
		init = async () => undefined;
		render = () => undefined;
		destroy = () => undefined;
	}
	return {
		Application,
		Graphics,
		Sprite: class {},
		Texture: { from: () => ({ source: {} }) },
	};
});

function recordWith(
	fields: GameplayMetadataRecord["fields"]
): GameplayMetadataRecord {
	return {
		id: "64869356-a595-4a3a-995f-87dad6c77d04",
		projectId: "project",
		assetRecordId: "record",
		assetVersionId: "version-1",
		frameKey: "walk-0",
		profileId: "character_creature_animation",
		contractRevisionId: "character@1",
		useContext: "walk east",
		createdAt: "2026-10-02T00:00:00.000Z",
		fields,
	};
}

function pxAreaField(
	value: GameplayMetadataRecord["fields"][number]["value"]
): GameplayMetadataRecord["fields"][number] {
	return {
		fieldId: "collision_areas",
		value,
		unit: "px",
		coordinateSystem: "source_image_top_left",
		source: { kind: "authored" },
	};
}

beforeEach(() => {
	Object.defineProperty(HTMLImageElement.prototype, "decode", {
		configurable: true,
		value: () => Promise.resolve(),
	});
});

afterEach(() => {
	cleanup();
	drawCalls.splice(0);
	vi.restoreAllMocks();
});

test("draws one rectangle per collision area in an array", async () => {
	render(
		<GameplayMetadataOverlay
			onReady={() => undefined}
			previewUrl="/preview.png"
			record={recordWith([
				pxAreaField([
					{ x: 4, y: 6, width: 10, height: 12 },
					{ x: 20, y: 22, width: 8, height: 9 },
				]),
			])}
		/>
	);
	await waitFor(() => {
		expect(
			drawCalls
				.filter((call) => call.method === "rect")
				.map((call) => call.args)
		).toEqual([
			[4, 6, 10, 12],
			[20, 22, 8, 9],
		]);
	});
});

test("draws the rectangle when collision areas hold a single object", async () => {
	render(
		<GameplayMetadataOverlay
			onReady={() => undefined}
			previewUrl="/preview.png"
			record={recordWith([pxAreaField({ x: 4, y: 6, width: 10, height: 12 })])}
		/>
	);
	await waitFor(() => {
		expect(
			drawCalls
				.filter((call) => call.method === "rect")
				.map((call) => call.args)
		).toEqual([[4, 6, 10, 12]]);
	});
	expect(drawCalls.filter((call) => call.method === "moveTo")).toHaveLength(0);
});
