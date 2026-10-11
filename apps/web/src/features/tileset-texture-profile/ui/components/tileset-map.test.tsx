import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { TilesetTestMap } from "@sprite-anvil/api/tileset-adjacency-reviews";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { expect, test, vi } from "vitest";
import { TilesetMap } from "./tileset-map";

vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "http://tiles.test" } }));

test.each([
	{ width: 16, height: 16, cellWidth: 48 },
	{ width: 32, height: 16, cellWidth: 96 },
])(
	"renders $width by $height atlas tiles with intact adjoining edges and keyboard focus",
	async ({ width, height, cellWidth }) => {
		const tile = {
			unitVersionId: "unit",
			tileId: "grass",
			assetVersionId: "version",
			terrainId: "grass",
			region: { x: width, y: 0, width, height },
			edges: { north: "grass", east: "grass", south: "grass", west: "grass" },
		};
		const version = {
			id: "version",
			sourceImageDimensions: { width: width * 2, height },
			previewUrl: "/tile.svg",
		} as AssetVersion;
		const map: TilesetTestMap = {
			scenario: "terrain_fill",
			width: 2,
			height: 2,
			cells: ["unit", "unit", "unit", "unit"],
			outcome: "inconclusive",
			notes: "Inspect seams",
			issues: [],
		};
		const html = renderToStaticMarkup(
			<TilesetMap
				map={map}
				onInspect={() => undefined}
				tiles={[tile]}
				versions={[version]}
			/>
		);
		const require = createRequire(import.meta.url);
		const entry = require.resolve("tailwindcss/index.css");
		const compiler = await compile(await readFile(entry, "utf8"), {
			base: dirname(entry),
			loadStylesheet: async (id, base) => {
				const path = resolve(base, id);
				return {
					path,
					base: dirname(path),
					content: await readFile(path, "utf8"),
				};
			},
		});
		const classes = [...html.matchAll(/class="([^"]+)"/g)].flatMap((match) =>
			(match[1] ?? "").split(" ")
		);
		const browser = await chromium.launch({ headless: true });
		try {
			const page = await browser.newPage();
			await page.route("**/tile.svg", (route) =>
				route.fulfill({
					contentType: "image/svg+xml",
					body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 2}" height="${height}"><rect width="100%" height="100%" fill="green"/></svg>`,
				})
			);
			await page.setContent(`<style>${compiler.build(classes)}</style>${html}`);
			const bounds = await page.getByRole("button").evaluateAll((buttons) =>
				buttons.map((button) => {
					const cell = button.getBoundingClientRect();
					const crop = button.querySelector("span")?.getBoundingClientRect();
					return {
						x: cell.x,
						y: cell.y,
						width: cell.width,
						height: cell.height,
						cropWidth: crop?.width,
						cropHeight: crop?.height,
						border: getComputedStyle(button).borderWidth,
					};
				})
			);
			expect(bounds[0]).toMatchObject({
				width: cellWidth,
				height: 48,
				cropWidth: cellWidth,
				cropHeight: 48,
				border: "0px",
			});
			expect(bounds[1]?.x).toBe((bounds[0]?.x ?? 0) + cellWidth);
			expect(bounds[2]?.y).toBe((bounds[0]?.y ?? 0) + 48);
			await page.keyboard.press("Tab");
			expect(
				await page
					.getByRole("button")
					.first()
					.evaluate((button) => ({
						focused: document.activeElement === button,
						outline: getComputedStyle(button).outlineStyle,
					}))
			).toEqual({ focused: true, outline: "solid" });
		} finally {
			await browser.close();
		}
	},
	20_000
);
