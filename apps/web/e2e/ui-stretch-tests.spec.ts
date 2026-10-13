import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { readUiProfileManifest } from "@sprite-anvil/api/ui-profile-export";
import {
	assetFamilyWorkspaceFixture,
	prepareAssetFamilyWorkspace,
} from "./asset-family-workspace-fixture";

async function expectCornersAndText(
	page: Page,
	target: Locator,
	expectedWidth: number,
	expectedHeight: number
) {
	const screenshot = await target.screenshot();
	const corners = await page.evaluate(
		async ({ bytes, width, height }) => {
			const bitmap = await createImageBitmap(
				new Blob([new Uint8Array(bytes)], { type: "image/png" })
			);
			const canvas = document.createElement("canvas");
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				throw new Error("Missing pixel reader");
			}
			ctx.drawImage(bitmap, 0, 0);
			return (
				[
					[1, 1],
					[width - 2, 1],
					[1, height - 2],
					[width - 2, height - 2],
				] as const
			).map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data));
		},
		{
			bytes: Array.from(screenshot),
			width: expectedWidth,
			height: expectedHeight,
		}
	);
	expect(corners).toEqual([
		[255, 0, 0, 255],
		[0, 255, 0, 255],
		[0, 0, 255, 255],
		[255, 255, 0, 255],
	]);
	const text = target.locator("foreignObject div");
	await expect(text).toHaveText("Items");
	const bounds = await text.evaluate((element) => ({
		width: element.clientWidth,
		height: element.clientHeight,
		textWidth: element.scrollWidth,
		textHeight: element.scrollHeight,
	}));
	expect(bounds.textWidth).toBeLessThanOrEqual(bounds.width);
	expect(bounds.textHeight).toBeLessThanOrEqual(bounds.height);
}

test("stretches exact UI states at multiple sizes, preserves corners and rereads metadata", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"Requires disposable PostgreSQL."
	);
	test.setTimeout(180_000);
	await prepareAssetFamilyWorkspace(page, {
		...assetFamilyWorkspaceFixture,
		userName: "UI Stretch E2E",
		email: `ui-stretch-${crypto.randomUUID()}@example.test`,
		projectName: "Inventory UI Project",
		visualWorldName: "Inventory UI",
		identityName: "Inventory panel",
		familyName: "Inventory panels",
		categoryLabel: "Arayüz ekranları ve bileşenleri",
		png: readFileSync(new URL("./fixtures/ui-panel.png", import.meta.url)),
		records: [
			{ name: "Normal panel", uploadNote: "Nine slice fixture." },
			{ name: "Pressed panel", uploadNote: "Exact pressed fixture." },
		],
	});
	const manager = page
		.getByRole("heading", {
			name: "UI stretch and text test · Inventory panels",
		})
		.locator("..");
	const first = manager.getByRole("group", { name: "State 1", exact: true });
	await first.getByLabel("Component identity").fill("panel");
	await first.getByLabel("State identity").fill("normal");
	await first
		.getByLabel("Exact version")
		.selectOption({ label: "Normal panel · v1" });
	for (const [label, value] of [
		["Left margin", "4"],
		["Right margin", "6"],
		["Top margin", "3"],
		["Bottom margin", "5"],
		["Text area X", "6"],
		["Text area Y", "5"],
		["Text area width", "18"],
		["Text area height", "12"],
	] as const) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser edits must be sequential.
		await first.getByLabel(label).fill(value);
	}
	await manager.getByLabel("Target width").fill("64");
	await manager.getByLabel("Target height").fill("40");
	await manager.getByLabel("Sample text").fill("Items");
	await expect(
		manager.getByRole("img", {
			name: "panel normal at 64 × 40 px",
			exact: true,
		})
	).toBeVisible();
	const target = manager.getByRole("img", {
		name: "panel normal at 64 × 40 px",
		exact: true,
	});
	await expectCornersAndText(page, target, 64, 40);
	await manager.getByLabel("Test result").selectOption("passed");
	await manager
		.getByLabel("Observation")
		.fill("Corners and text inspected at 64 × 40.");
	await target.screenshot({ path: "../../.context/ui-stretch-target.png" });
	await manager
		.getByRole("button", { name: "Add target", exact: true })
		.click();
	const secondTarget = manager.getByRole("group", {
		name: "Target 2",
		exact: true,
	});
	await secondTarget.getByLabel("Target width").fill("80");
	await secondTarget.getByLabel("Target height").fill("48");
	await expectCornersAndText(
		page,
		manager.getByRole("img", {
			name: "panel normal at 80 × 48 px",
			exact: true,
		}),
		80,
		48
	);
	await manager
		.getByRole("button", { name: "Add target", exact: true })
		.click();
	const thirdTarget = manager.getByRole("group", {
		name: "Target 3",
		exact: true,
	});
	await thirdTarget.getByLabel("Target width").fill("8");
	await thirdTarget.getByLabel("Target height").fill("7");
	const validTarget = manager.getByRole("group", {
		name: "panel · normal · 64 × 40 px",
		exact: true,
	});
	await validTarget.getByLabel("Test result").selectOption("passed");
	await validTarget
		.getByLabel("Observation")
		.fill("All corners and Items text inspected.");

	await expect(
		manager.getByText("Target is too small to preserve the corners.")
	).toBeVisible();
	await manager.getByLabel("Left margin").fill("32");
	await manager
		.getByRole("button", { name: "Save stretch test", exact: true })
		.click();
	await expect(manager.getByRole("alert")).toContainText(
		"Stretch margins must leave a positive source center."
	);
	await manager.getByLabel("Left margin").fill("4");
	await validTarget.getByLabel("Test result").selectOption("passed");
	await validTarget
		.getByLabel("Observation")
		.fill("All corners and Items text inspected.");
	const largerTarget = manager.getByRole("group", {
		name: "panel · normal · 80 × 48 px",
		exact: true,
	});
	await largerTarget.getByLabel("Test result").selectOption("passed");
	await largerTarget
		.getByLabel("Observation")
		.fill("Corners and Items text inspected at 80 × 48.");
	await manager
		.getByRole("button", { name: "Save stretch test", exact: true })
		.click();
	await expect(
		manager.getByText("Stretch test saved.", { exact: true })
	).toBeVisible();
	await page.reload();
	await page
		.getByRole("button", { name: "Profil incelemeleri", exact: true })
		.click();
	await expect(
		manager.getByText("panel · normal · 8 × 7 px · failed · geometry failed", {
			exact: true,
		})
	).toBeVisible();
	await expect(
		manager.getByText(
			"panel · normal · 80 × 48 px · passed · geometry passed",
			{ exact: true }
		)
	).toBeVisible();
	await manager.getByText("View saved test", { exact: true }).click();
	await expect(
		manager.getByText(
			"Margins: left 4, right 6, top 3, bottom 5 · Text area: 6, 5, 18 × 12 px",
			{ exact: true }
		)
	).toBeVisible();
	const downloaded = page.waitForEvent("download");
	await manager
		.getByRole("button", { name: "Download UI profile metadata" })
		.click();
	const download = await downloaded;
	const path = await download.path();
	if (!path) {
		throw new Error("Missing metadata download");
	}
	const manifest = readUiProfileManifest(readFileSync(path, "utf8"));
	expect(manifest.evidence.targets).toEqual([
		{ width: 64, height: 40 },
		{ width: 80, height: 48 },
		{ width: 8, height: 7 },
	]);
	expect(manifest.evidence.evaluations.map((e) => e.outcome)).toEqual([
		"passed",
		"passed",
		"failed",
	]);
	await manager.screenshot({ path: "../../.context/ui-stretch-manager.png" });
});
