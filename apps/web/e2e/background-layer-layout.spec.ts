import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
	assetFamilyWorkspaceFixture,
	prepareAssetFamilyWorkspace,
} from "./asset-family-workspace-fixture";

test("configures background layers, rejects unsafe cropping, and rereads exact saved values", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"Requires a disposable PostgreSQL test database."
	);
	test.setTimeout(180_000);
	await prepareAssetFamilyWorkspace(
		page,
		{
			...assetFamilyWorkspaceFixture,
			userName: "Background Layout E2E",
			email: `background-layout-${crypto.randomUUID()}@example.test`,
			projectName: "Forest Background Project",
			visualWorldName: "Forest",
			identityName: "Forest",
			familyName: "Forest Background",
			useContext: "gameplay background",
			categoryLabel: "Arka planlar ve katmanlı kaydırma",
			records: [
				{ name: "Sky", uploadNote: "Sky background fixture." },
				{ name: "Trees", uploadNote: "Trees background fixture." },
				{
					name: "Player",
					uploadNote: "Exact player silhouette.",
					categoryLabel: "Karakterler, yaratıklar ve animasyonlar",
					png: readFileSync(
						new URL("./fixtures/background-player.png", import.meta.url)
					),
				},
			],
		},
		"1.0.1"
	);
	const layout = page
		.getByRole("heading", {
			name: "Background layer layout · Forest Background",
		})
		.locator("..");
	await layout.getByLabel("Layer identity").fill("sky");
	await layout.getByLabel("Exact version").selectOption({ label: "Sky · v1" });
	await layout.getByLabel("Safe area X").fill("24");
	await layout.getByLabel("Safe area Y").fill("8");
	await layout.getByLabel("Safe area width").fill("16");
	await layout.getByLabel("Safe area height").fill("16");
	await layout.getByRole("button", { name: "Save layer layout" }).click();
	await expect(layout.getByRole("alert")).toContainText(
		"Player safe area must remain inside the crop."
	);
	await layout.getByLabel("Safe area X").fill("8");
	await layout.getByRole("button", { name: "Add layer", exact: true }).click();
	const second = layout.getByRole("group", { name: "Layer 2", exact: true });
	await second.getByLabel("Layer identity").fill("trees");
	await second
		.getByLabel("Exact version")
		.selectOption({ label: "Trees · v1" });
	await second.getByLabel("Safe area X").fill("8");
	await second.getByLabel("Safe area Y").fill("8");
	await second.getByLabel("Safe area width").fill("16");
	await second.getByLabel("Safe area height").fill("16");
	await layout.getByRole("button", { name: "Save layer layout" }).click();
	await expect(
		layout.getByText("Layer layout saved.", { exact: true })
	).toBeVisible();
	await layout.getByRole("button", { name: "Test scrolling" }).click();
	await layout.getByLabel("Exact player version").selectOption({ index: 1 });
	const playback = layout.getByRole("region", {
		name: "Background scrolling playback",
	});
	await expect(
		playback.getByRole("button", { name: "Play scrolling" })
	).toBeEnabled();
	const initialPixels = await playback
		.getByRole("img", { name: "Actual background scrolling preview" })
		.screenshot();
	await playback.getByLabel("Timeline (ms)").fill("9000");
	await expect(
		playback.getByText("sky: 20 px · loop 5", { exact: true })
	).toBeVisible();
	await expect(
		playback.getByText("trees: 8 px · loop 11", { exact: true })
	).toBeVisible();
	const shiftedPixels = await playback
		.getByRole("img", { name: "Actual background scrolling preview" })
		.screenshot();
	expect(shiftedPixels.equals(initialPixels)).toBe(false);
	await expect(
		layout.getByRole("button", { name: "Save scrolling test" })
	).toBeDisabled();
	await layout.getByLabel("Test duration (ms)").fill("1000");
	await expect(
		playback.getByRole("button", { name: "Play scrolling" })
	).toBeEnabled();
	await playback.getByRole("button", { name: "Play scrolling" }).click();
	await expect(
		layout.getByText("Actual playback: 1000 / 1000 ms", { exact: true })
	).toBeVisible();
	for (const label of [
		"Loop",
		"Seam",
		"Crop",
		"Contrast",
		"Player visibility",
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser fields must be filled sequentially.
		await layout
			.getByLabel(`${label} notes`)
			.fill(`${label} inspected with moving layers and exact Player.`);
		await layout
			.getByLabel(`${label} outcome`)
			.selectOption(label === "Seam" ? "failed" : "passed");
	}
	await layout.getByRole("button", { name: "Save scrolling test" }).click();
	await expect(
		layout.getByText("Scrolling test saved.", { exact: true })
	).toBeVisible();
	await layout
		.getByRole("region", { name: "Scrolling setup" })
		.screenshot({ path: "../../.context/background-scrolling-test.png" });
	await layout.screenshot({
		path: "../../.context/background-layer-layout.png",
	});
	await page.reload();
	await expect(
		layout.getByText("sky · Sky · v1", { exact: true })
	).toBeVisible();
	await expect(
		layout.getByText("trees · Trees · v1", { exact: true })
	).toBeVisible();
	await expect(
		layout.getByText("Crop: 0, 0, 32 × 32 · Safe area: 8, 8, 16 × 16", {
			exact: true,
		})
	).toHaveCount(2);
	await layout.getByRole("button", { name: "Test scrolling" }).click();
	await expect(
		layout.getByText(
			"Seam: failed · Seam inspected with moving layers and exact Player.",
			{ exact: true }
		)
	).toBeVisible();
	await layout.getByRole("button", { name: "Replay test" }).click();
	await expect(
		playback.getByRole("button", { name: "Play scrolling" })
	).toBeEnabled();
	await expect(layout.getByLabel("Player width")).toHaveValue("16");
	await expect(
		layout.getByText("Actual scrolling test is still required.")
	).toBeVisible();
});

test("recovers a lost save response using the same operation without duplicating the layout", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"Requires a disposable PostgreSQL test database."
	);
	test.setTimeout(180_000);
	await prepareAssetFamilyWorkspace(
		page,
		{
			...assetFamilyWorkspaceFixture,
			email: `background-recovery-${crypto.randomUUID()}@example.test`,
			familyName: "Forest Background",
			categoryLabel: "Arka planlar ve katmanlı kaydırma",
			records: [{ name: "Sky", uploadNote: "Background recovery fixture." }],
		},
		"1.0.1"
	);
	const layout = page
		.getByRole("heading", {
			name: "Background layer layout · Forest Background",
		})
		.locator("..");
	await layout.getByLabel("Layer identity").fill("sky");
	await layout.getByLabel("Exact version").selectOption({ label: "Sky · v1" });
	await layout.getByLabel("Safe area X").fill("8");
	await layout.getByLabel("Safe area Y").fill("8");
	await layout.getByLabel("Safe area width").fill("16");
	await layout.getByLabel("Safe area height").fill("16");
	const inputs: unknown[] = [];
	await page.route("**/rpc/backgroundLayerLayouts/save", async (route) => {
		inputs.push(route.request().postDataJSON());
		if (inputs.length === 1) {
			const response = await route.fetch();
			expect(response.ok()).toBe(true);
			await route.abort("failed");
		} else {
			await route.continue();
		}
	});
	await layout.getByRole("button", { name: "Save layer layout" }).click();
	const check = layout.getByRole("button", { name: "Check current layouts" });
	await expect(check).toBeVisible();
	// Model a successful read before the pending write becomes visible.
	await page.route(
		"**/rpc/backgroundLayerLayouts/list",
		async (route) => {
			const response = await route.fetch();
			const body = await response.json();
			await route.fulfill({ response, json: { ...body, json: [] } });
		},
		{ times: 1 }
	);
	await check.click();
	await expect(layout.getByRole("alert")).toContainText(
		"The pending layout is not visible yet."
	);
	await expect(layout.getByLabel("Layer identity")).toBeDisabled();
	await expect(
		layout.getByRole("button", { name: "Save layer layout" })
	).toBeDisabled();
	await layout.getByRole("button", { name: "Retry same layout" }).click();
	await expect(
		layout.getByText("Layer layout saved.", { exact: true })
	).toBeVisible();
	expect(inputs).toHaveLength(2);
	expect(inputs[1]).toEqual(inputs[0]);
	await page.reload();
	await expect(layout.getByText("sky · Sky · v1", { exact: true })).toHaveCount(
		1
	);
});
