import { expect, test } from "@playwright/test";
import {
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "./asset-record-fixture";

const identityCheckboxName = /Bağımsız ürün anlamı/;

test("persists reference transfer constraints through the web flow", async ({
	page,
}) => {
	const fixture = createAssetRecordFixture();
	test.skip(
		!assetVersionE2eEnabled,
		"A disposable Neon branch and explicitly selected test R2 bucket are required for reference persistence."
	);

	await page.goto("/login");
	await page.getByLabel("Name").fill(fixture.userName);
	await page.getByLabel("Email").fill(fixture.email);
	await page.getByLabel("Password").fill(fixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

	await page.getByRole("link", { name: "Projects" }).click();
	await page.getByLabel("Oyun projesi adı").fill(fixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Proje oluştur" }).click();
	await page
		.getByRole("link", {
			name: `${fixture.projectName} varlık kayıtlarını aç`,
		})
		.click();
	await page.getByLabel("Varlık adı").fill(fixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Varlık kaydı oluştur" }).click();
	await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();

	await page.locator("#reference-upload-file").setInputFiles({
		name: "walking-pose.png",
		mimeType: "image/png",
		buffer: Buffer.from(fixture.assetVersionPngBase64, "base64"),
	});
	await page
		.getByRole("group", { name: "Kaçınılacak özellikler" })
		.getByRole("checkbox", { name: "Kimlik" })
		.check();
	await page.getByLabel("Referans notu").fill("Use the pose only.");
	await page.getByRole("button", { name: "Görseli yükle" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Referans görseli panoya eklendi."
	);

	let card = page.getByRole("article").filter({
		has: page.getByRole("img", {
			name: "walking-pose.png adlı referans görseli",
		}),
	});
	await expect(card.getByText("Use the pose only.")).toBeVisible();
	await card.getByText("Kuralları düzenle").click();
	await card.getByLabel("Referans kullanım amacı").selectOption("custom");
	await card.getByLabel("Özel kullanım amacı").fill("Animation timing cue");
	await card.getByLabel("Referans notu").fill("Timing cue only.");
	await card.getByRole("button", { name: "Kuralları kaydet" }).click();
	await expect(card.getByRole("status")).toContainText(
		"Referans kuralları ve notu kaydedildi."
	);
	await card.getByText("Kural geçmişi").click();
	await expect(card.getByText("Revizyon 1 ·", { exact: false })).toBeVisible();
	await expect(card.getByText("Revizyon 2 ·", { exact: false })).toBeVisible();

	await page.reload();
	card = page.getByRole("article").filter({
		has: page.getByRole("img", {
			name: "walking-pose.png adlı referans görseli",
		}),
	});
	await expect(card.getByText("Animation timing cue")).toBeVisible();
	await expect(card.getByText("Timing cue only.")).toBeVisible();
	await card.getByText("Kural geçmişi").click();
	await expect(card.getByText("Revizyon 1 ·", { exact: false })).toBeVisible();
	await expect(card.getByText("Revizyon 2 ·", { exact: false })).toBeVisible();
});
