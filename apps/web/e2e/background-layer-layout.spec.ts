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
