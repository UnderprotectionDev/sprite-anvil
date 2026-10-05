import { expect, type Page } from "@playwright/test";
import { assetVersionFixture } from "./asset-version-fixture";
import { signUpWithFixture } from "./project-workflow";

const profileContractActivationName = /Sözleşme v.*etkinleştir/;

export const animationTimingFixture = {
	...assetVersionFixture,
	userName: "Animation Timing Review E2E",
	email: `animation-timing-e2e-${crypto.randomUUID()}@example.test`,
	projectName: "Animation Timing Review Project",
	visualWorldName: "Animation Timing Gameplay",
	identityName: "Animation Timing Character",
	familyName: "Animation Timing Sprite",
	useContext: "character walk animation",
	sourceName: "Animation Timing Sprite Sheet",
	png: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVRYhWNgGAVDDeR3zviPD48sBzw9XoGCRx2QP+LSQP5gdEA+rR2UTy8H5JNo0agD8kejoHM0Ec4YzYb/h3dBxECkI8m2EB2MOiB/NAo6R3oiHAUMdAIApRlBiwhnmmsAAAAASUVORK5CYII=",
		"base64"
	),
};

export async function prepareAnimationTimingReviewWorkspace(page: Page) {
	const fixture = animationTimingFixture;
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

	await page.getByLabel("Bağımsız ürün anlamı", { exact: true }).check();
	await page.getByLabel("Varlık Kaydı adı").fill(fixture.sourceName);
	await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
	const familyUrl = page.url();
	await page
		.getByRole("link", { name: "Varlık Sürümü yükle", exact: true })
		.click();
	await page
		.getByLabel("PNG veya WebP dosyası", { exact: true })
		.setInputFiles({
			name: "animation-timing-sprite.png",
			mimeType: "image/png",
			buffer: fixture.png,
		});
	await page
		.getByLabel("Bilinmeyen üretim geçmişi")
		.fill("Test image created for the disposable animation timing fixture.");
	await page
		.getByLabel("Bilinen kaynak", { exact: true })
		.fill("Animation timing review browser fixture");
	await page.getByLabel("Varlıkla ilişkiniz").selectOption("created_by_user");
	await page
		.getByRole("button", { name: "Aday sürümü kaydet", exact: true })
		.click();
	await expect(
		page.getByText("Aday Sürüm kaydedildi.", { exact: true })
	).toBeVisible();
	await page.goto(familyUrl);

	await expect(
		page.getByRole("paragraph").filter({ hasText: "Sürüm 1 · Aday" })
	).toBeVisible();
	await page
		.getByLabel("İnceleme gerekçesi")
		.fill("The sprite is suitable for timing review.");
	await page.getByRole("button", { name: "Onayla" }).click();
	await expect(
		page.getByRole("paragraph").filter({ hasText: "Sürüm 1 · Onaylandı" })
	).toBeVisible();
	await page.getByRole("button", { name: "Ana Tasarım olarak seç" }).click();
	await expect(
		page.getByText(`Ana Tasarım: ${fixture.sourceName} · Sürüm 1`)
	).toBeVisible();

	const profile = page
		.getByRole("heading", {
			name: "Karakterler, yaratıklar ve animasyonlar",
			exact: true,
		})
		.locator("xpath=ancestor::li[1]");
	await profile
		.getByRole("button", { name: profileContractActivationName })
		.click();
	await expect(
		profile.getByText("Etkin sözleşme v1.0.1", { exact: true })
	).toBeVisible();

	return {
		familyName: fixture.familyName,
		review: page.getByRole("region", {
			name: `${fixture.familyName} animasyon zamanlaması incelemesi`,
		}),
		versionLabel: `${fixture.sourceName} · Sürüm 1`,
	};
}
