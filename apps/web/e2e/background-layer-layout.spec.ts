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
