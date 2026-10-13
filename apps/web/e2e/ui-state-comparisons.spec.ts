import { expect, test } from "@playwright/test";
import { uiComponentStates } from "@sprite-anvil/api/ui-state-comparisons";
import { prepareAssetFamilyWorkspace } from "./asset-family-workspace-fixture";
import { uiStateComparisonFixture } from "./ui-state-comparison-fixture";

test("compares all UI states with a screen, panel and item slot and reopens exact persisted mappings", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A persistent fixture database is required."
	);
	test.setTimeout(240_000);
	page.setDefaultTimeout(15_000);
	const { familyName } = await prepareAssetFamilyWorkspace(
		page,
		uiStateComparisonFixture
	);
	const comparison = page.getByRole("region", {
		name: `${familyName} · Ekran ve Bileşen Durumlarını Karşılaştırma`,
	});
	await comparison.getByLabel("Comparison name").fill("Inventory controls");
	await comparison
		.getByLabel("Screen version")
		.selectOption({ label: "Inventory screen · Version 1" });
	for (let index = 2; index < 9; index += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: Each browser action must finish before adding the next state.
		await comparison
			.getByRole("button", { name: "Add component state" })
			.click();
	}
	const componentRows = [
		...uiComponentStates.map((state) => ({
			identity: "inventory-button",
			kind: "button",
			state,
			version: "Inventory button states",
		})),
		{
			identity: "inventory-panel",
			kind: "panel",
			state: "normal",
			version: "Inventory panel",
		},
		{
			identity: "inventory-slot",
			kind: "item_slot",
			state: "normal",
			version: "Inventory item slot",
		},
	];
	for (const [index, component] of componentRows.entries()) {
		const row = comparison.getByRole("group", {
			name: `Component state ${index + 1}`,
			exact: true,
		});
		// biome-ignore lint/performance/noAwaitInLoops: Fill one component state at a time.
		await row.getByLabel("Component identity").fill(component.identity);
		await row.getByLabel("Component kind").selectOption(component.kind);
		await row
			.getByRole("combobox", { name: "State", exact: true })
			.selectOption(component.state);
		await row
			.getByLabel("Component version")
			.selectOption({ label: `${component.version} · Version 1` });
	}
	await comparison
		.getByLabel("Family style observations")
		.fill("Disabled border needs a family style review.");
	await comparison
		.getByLabel("State distinction observations")
		.fill("All seven button states remain explicitly mapped.");
	await comparison
		.getByLabel("Comparison outcome")
		.selectOption("needs_follow_up");
	await comparison.getByRole("button", { name: "Save comparison" }).click();
	await expect(
		comparison.getByText("Comparison verified from persistent storage.")
	).toBeVisible();
	await page.reload();
	await page
		.getByRole("button", { name: "Profil incelemeleri", exact: true })
		.click();
	await expect(
		comparison.getByRole("heading", { name: "Inventory controls", exact: true })
	).toBeVisible();
	await comparison
		.getByText("Show comparison details", { exact: true })
		.click();
	await expect(
		comparison.getByRole("img", {
			name: "inventory-button · Button · Disabled",
			exact: true,
		})
	).toBeVisible();
	await expect(
		comparison.getByRole("img", {
			name: "inventory-panel · Panel · Normal",
			exact: true,
		})
	).toBeVisible();
	await expect(
		comparison.getByRole("img", {
			name: "inventory-slot · Item slot · Normal",
			exact: true,
		})
	).toBeVisible();
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		comparison
			.getByRole("button", { name: "Download comparison JSON" })
			.click(),
	]);
	const stream = await download.createReadStream();
	if (!stream) {
		throw new Error("Comparison JSON download is missing.");
	}
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.from(chunk));
	}
	const archive = JSON.parse(Buffer.concat(chunks).toString("utf8"));
	expect(
		archive.record.items
			.slice(0, 7)
			.map((item: { state: string }) => item.state)
	).toEqual([
		"normal",
		"hover",
		"pressed",
		"disabled",
		"selected",
		"open",
		"closed",
	]);
	expect(archive.record.versionPins).toHaveLength(4);
	await comparison
		.getByRole("region", { name: "Saved UI State Comparisons" })
		.screenshot({
			path: "../../.context/ui-state-comparison.png",
		});
});
