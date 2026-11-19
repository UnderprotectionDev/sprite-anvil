import { expect, test } from "@playwright/test";
import { prepareAssetFamilyComparisonWorkspace } from "./asset-family-comparison-fixture";

const scaleObservation = "Her iki sandık aynı ızgara ölçeğini kullanıyor.";
const closedCrateCheckboxName = /Kapalı sandık/u;
const openCrateCheckboxName = /Açık sandık/u;
const persistedRecordButtonName = /· 2 Asset Version/u;

test("compares current versions from two Asset Records and reopens the persisted comparison", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);
	test.setTimeout(180_000);

	const { comparison } = await prepareAssetFamilyComparisonWorkspace(page);

	await comparison
		.getByRole("checkbox", { name: closedCrateCheckboxName })
		.check();
	await comparison
		.getByRole("checkbox", { name: openCrateCheckboxName })
		.check();
	await comparison.getByLabel("Scale observation").fill(scaleObservation);
	await comparison
		.getByLabel("Perspective observation")
		.fill("Perspektif tutarlı.");
	await comparison
		.getByLabel("Material language observation")
		.fill("Malzeme dili aynı ahşap.");
	await comparison
		.getByLabel("State and direction distinction observation")
		.fill("Kapalı ve açık durumlar net ayrışıyor.");

	const saveButton = comparison.getByRole("button", {
		name: "Save comparison",
	});
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await expect(
		comparison.getByText("Comparison verified from the saved record.")
	).toBeVisible();
	await expect(comparison.getByText(scaleObservation)).toBeVisible();

	await page.reload();
	await page
		.getByRole("button", { name: "Profile reviews", exact: true })
		.click();
	const persistedRecord = comparison.getByRole("button", {
		name: persistedRecordButtonName,
	});
	await persistedRecord.click();
	await expect(comparison.getByText(scaleObservation)).toBeVisible();
	await expect(
		comparison.getByRole("heading", { name: "Kapalı sandık · Asset Version 1" })
	).toBeVisible();
	await expect(
		comparison.getByRole("heading", { name: "Açık sandık · Asset Version 1" })
	).toBeVisible();
	await expect(
		comparison.getByRole("button", { name: "Save comparison" })
	).toHaveCount(0);

	await comparison.getByRole("button", { name: "New comparison" }).click();
	await expect(
		comparison.getByRole("checkbox", { name: closedCrateCheckboxName })
	).not.toBeChecked();
	await expect(
		comparison.getByRole("checkbox", { name: openCrateCheckboxName })
	).not.toBeChecked();
	await expect(comparison.getByLabel("Scale observation")).toHaveValue("");
});
