import { expect, test } from "@playwright/test";
import { prepareAssetFamilyComparisonWorkspace } from "./asset-family-comparison-fixture";

const scaleObservation = "Her iki sandık aynı ızgara ölçeğini kullanıyor.";
const closedCrateCheckboxName = /Kapalı sandık/;
const openCrateCheckboxName = /Açık sandık/;
const persistedRecordButtonName = /· 2 Varlık Sürümü/;

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
	await comparison.getByLabel("Ölçek gözlemi").fill(scaleObservation);
	await comparison.getByLabel("Perspektif gözlemi").fill("Perspektif tutarlı.");
	await comparison
		.getByLabel("Malzeme dili gözlemi")
		.fill("Malzeme dili aynı ahşap.");
	await comparison
		.getByLabel("Durum ve yön ayrışması gözlemi")
		.fill("Kapalı ve açık durumlar net ayrışıyor.");

	const saveButton = comparison.getByRole("button", {
		name: "Karşılaştırmayı kaydet",
	});
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await expect(
		comparison.getByText("Karşılaştırma kalıcı kayıttan doğrulandı.")
	).toBeVisible();
	await expect(comparison.getByText(scaleObservation)).toBeVisible();

	await page.reload();
	const persistedRecord = comparison.getByRole("button", {
		name: persistedRecordButtonName,
	});
	await persistedRecord.click();
	await expect(comparison.getByText(scaleObservation)).toBeVisible();
	await expect(
		comparison.getByRole("heading", { name: "Kapalı sandık · Varlık Sürümü 1" })
	).toBeVisible();
	await expect(
		comparison.getByRole("heading", { name: "Açık sandık · Varlık Sürümü 1" })
	).toBeVisible();
	await expect(
		comparison.getByRole("button", { name: "Karşılaştırmayı kaydet" })
	).toHaveCount(0);

	await comparison.getByRole("button", { name: "Yeni karşılaştırma" }).click();
	await expect(
		comparison.getByRole("checkbox", { name: closedCrateCheckboxName })
	).not.toBeChecked();
	await expect(
		comparison.getByRole("checkbox", { name: openCrateCheckboxName })
	).not.toBeChecked();
	await expect(comparison.getByLabel("Ölçek gözlemi")).toHaveValue("");
});
