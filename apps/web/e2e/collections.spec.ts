import { expect, test } from "@playwright/test";
import { createAssetRecordFixture } from "./asset-record-fixture";
import {
	createProjectFromProjectsView,
	signUpWithFixture,
} from "./project-workflow";

const identityCheckboxName = /Bağımsız ürün anlamı/;

test("persists Collection membership changes through the web flow", async ({
	page,
}) => {
	const fixture = createAssetRecordFixture();
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A dedicated test database is required for the persistent flow."
	);

	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);
	await page
		.getByRole("link", {
			name: `${fixture.projectName} varlık kayıtlarını aç`,
		})
		.click();
	await page.getByLabel("Varlık adı").fill(fixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Varlık kaydı oluştur" }).click();
	await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();

	await page.getByRole("link", { name: "Projeler" }).click();
	await page
		.getByRole("link", {
			name: `${fixture.projectName} koleksiyonlarını düzenle`,
		})
		.click();
	const collectionName = `Planning ${fixture.name}`;
	await page.getByLabel("Koleksiyon adı").fill(collectionName);
	await page.getByRole("button", { name: "Koleksiyon oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: collectionName, level: 2 })
	).toBeVisible();

	await page
		.getByLabel("Varlık Kaydı")
		.selectOption({ label: `${fixture.name} · Varlık Ailesi atanmamış` });
	await page.getByRole("button", { name: "Koleksiyona ekle" }).click();
	await expect(
		page.getByRole("heading", { name: fixture.name, level: 3 })
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: fixture.name, level: 3 })
	).toBeVisible();

	await page
		.getByRole("button", {
			name: `${fixture.name} Varlık Kaydını Koleksiyondan kaldır`,
		})
		.click();
	await expect(
		page.getByText("Bu Koleksiyonda henüz Varlık Kaydı yok.", {
			exact: true,
		})
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: collectionName, level: 2 })
	).toBeVisible();
	await expect(
		page.getByText("Bu Koleksiyonda henüz Varlık Kaydı yok.", {
			exact: true,
		})
	).toBeVisible();
});
