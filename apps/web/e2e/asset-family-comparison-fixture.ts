import { expect, type Page } from "@playwright/test";
import { signUpWithFixture } from "./project-workflow";

const objectProfileHeading = "Objeler, silahlar, ekipmanlar ve durum aileleri";
const profileActivationButtonName = /Sözleşme v.*etkinleştir/;
const candidateVersionText = "Sürüm 1 · Aday";

export const assetFamilyComparisonFixture = {
	userName: "Asset Family Comparison E2E",
	email: `asset-family-comparison-e2e-${crypto.randomUUID()}@example.test`,
	password: "AssetFamilyComparisonE2E-Password-1",
	projectName: "Asset Family Comparison Project",
	generalArtDirection: "Readable states and directions for props",
	visualWorldName: "Comparison Gameplay",
	identityName: "Crate",
	familyName: "Crate States and Directions",
	useContext: "world props",
	records: [
		{ name: "Kapalı sandık", uploadNote: "Closed crate browser fixture." },
		{ name: "Açık sandık", uploadNote: "Open crate browser fixture." },
	],
	categoryLabel: objectProfileHeading,
	// A 32×32 PNG that passes the server's strict sharp decode; the shared
	// 1×1 asset-version fixture PNG trips the warning-failing libpng read.
	png: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVRYhWNgGAVDDeR3zviPD48sBzw9XoGCRx2QP+LSQP5gdEA+rR2UTy8H5JNo0agD8kejoHM0Ec4YzYb/h3dBxECkI8m2EB2MOiB/NAo6R3oiHAUMdAIApRlBiwhnmmsAAAAASUVORK5CYII=",
		"base64"
	),
};

export async function prepareAssetFamilyComparisonWorkspace(page: Page) {
	const fixture = assetFamilyComparisonFixture;
	await signUpWithFixture(page, fixture);

	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill(fixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: "Bağlam Önerisi hazırlayın" })
	).toBeVisible();
	await page.getByLabel("Görsel Dünya adı").fill(fixture.visualWorldName);
	await page.getByRole("button", { name: "Görsel Dünya ekle" }).click();
	await expect(
		page.locator(".scope-record-list").getByText(fixture.visualWorldName)
	).toBeVisible();

	await page.goto("/projects");
	await page.getByRole("link", { name: "Varlık Aileleri" }).click();
	await page.getByLabel("Varlık Kimliği adı").fill(fixture.identityName);
	await page.getByRole("button", { name: "Varlık Kimliği oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: fixture.identityName })
	).toBeVisible();
	await page.getByLabel("Varlık Ailesi adı").fill(fixture.familyName);
	await page.getByLabel("Görsel Dünya").selectOption({
		label: fixture.visualWorldName,
	});
	await page.getByLabel("Kullanım bağlamı").fill(fixture.useContext);
	await page.getByRole("button", { name: "Varlık Ailesi oluştur" }).click();
	await expect(
		page
			.getByRole("region", { name: "Kaydedilmiş Varlık Aileleri" })
			.getByRole("heading", { name: fixture.familyName, exact: true })
	).toBeVisible();

	const familyUrl = page.url();
	for (const record of fixture.records) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each record setup must occur in order.
		await page.getByLabel("Bağımsız ürün anlamı", { exact: true }).check();
		await page.getByLabel("Varlık Kaydı adı").fill(record.name);
		await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
		await expect(
			page
				.getByRole("listitem")
				.filter({ has: page.getByRole("heading", { name: record.name }) })
				.getByText("Henüz sürüm kaydedilmedi.")
		).toBeVisible();

		await page
			.getByRole("listitem")
			.filter({ has: page.getByRole("heading", { name: record.name }) })
			.getByRole("link", { name: "Varlık Sürümü yükle" })
			.click();

		await page
			.getByLabel("Varlık kategorisi")
			.selectOption({ label: fixture.categoryLabel });
		await page.getByRole("button", { name: "Metadata’yı kaydet" }).click();
		await expect(
			page.getByText("Varlık kaydı metadata’sı kaydedildi.")
		).toBeVisible();

		await page.getByLabel("PNG veya WebP dosyası").setInputFiles({
			name: `${record.name}.png`,
			mimeType: "image/png",
			buffer: fixture.png,
		});
		await page.getByLabel("Bilinmeyen üretim geçmişi").fill(record.uploadNote);
		await page
			.getByLabel("Bilinen kaynak", { exact: true })
			.fill("Asset family comparison browser fixture");
		await page.getByLabel("Varlıkla ilişkiniz").selectOption("created_by_user");
		await page
			.getByRole("button", { name: "Aday sürümü kaydet", exact: true })
			.click();
		await expect(
			page.getByText("Aday Sürüm kaydedildi.", { exact: true })
		).toBeVisible();

		await page.goto(familyUrl);
		await expect(
			page
				.getByRole("listitem")
				.filter({ has: page.getByRole("heading", { name: record.name }) })
				.getByRole("paragraph")
				.filter({ hasText: candidateVersionText })
		).toBeVisible();
	}

	const objectProfile = page
		.getByRole("heading", { name: fixture.categoryLabel, exact: true })
		.locator("xpath=ancestor::li[1]");
	await objectProfile
		.getByRole("button", { name: profileActivationButtonName })
		.click();
	await expect(
		objectProfile.getByText("Etkin sözleşme v1.0.0", { exact: true })
	).toBeVisible();

	return {
		familyName: fixture.familyName,
		comparison: page.getByRole("region", {
			name: `${fixture.familyName} durum ve yön ailesi karşılaştırması`,
		}),
	};
}
