import { expect, test } from "@playwright/test";
import { assetVersionFixture as fixture } from "./asset-version-fixture";
import { signUpWithFixture } from "./project-workflow";

const fourDirectionHistory = /4 yön · Takip gerekli/;
const eightDirectionHistory = /8 yön · Tutarlı/;
const activateContract = /Sözleşme v.*etkinleştir/;

test("reviews four and eight directions with variable timing and persisted human observations", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);

	test.setTimeout(90_000);
	await signUpWithFixture(page, {
		...fixture,
		projectName: "Direction Review Knight",
	});

	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill("Direction Review Knight");
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
			name: "ash-knight.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVRYhWNgGAVDDeR3zviPD48sBzw9XoGCRx2QP+LSQP5gdEA+rR2UTy8H5JNo0agD8kejoHM0Ec4YzYb/h3dBxECkI8m2EB2MOiB/NAo6R3oiHAUMdAIApRlBiwhnmmsAAAAASUVORK5CYII=",
				"base64"
			),
		});
	await page
		.getByLabel("Bilinmeyen üretim geçmişi")
		.fill("Test image created for the disposable browser fixture.");
	await page
		.getByLabel("Bilinen kaynak", { exact: true })
		.fill("Directional review browser fixture");
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
	const reviewRationale = "The silhouette matches the family design.";
	await page.getByLabel("İnceleme gerekçesi").fill(reviewRationale);
	await page.getByRole("button", { name: "Onayla" }).click();
	await expect(
		page.getByRole("paragraph").filter({ hasText: "Sürüm 1 · Onaylandı" })
	).toBeVisible();
	await expect(page.getByText(`— Gerekçe: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await page.getByRole("button", { name: "Ana Tasarım olarak seç" }).click();
	await expect(
		page.getByText("Ana Tasarım: Ash Knight base · Sürüm 1")
	).toBeVisible();

	const profile = page
		.getByRole("heading", {
			name: "Karakterler, yaratıklar ve animasyonlar",
			exact: true,
		})
		.locator("xpath=ancestor::li[1]");
	await profile.getByRole("button", { name: activateContract }).click();
	await expect(
		profile.getByText("Etkin sözleşme v1.0.1", { exact: true })
	).toBeVisible();
	const review = page.getByRole("region", {
		name: `${fixture.familyName} kimlik ve yön incelemesi`,
	});
	const version = { label: `${fixture.sourceName} · Sürüm 1` };
	await review
		.getByLabel("Yön 1 kare 1 sürümü", { exact: true })
		.selectOption(version);
	await review
		.getByLabel("Yön 2 kare 1 sürümü", { exact: true })
		.selectOption(version);
	await review
		.getByLabel("Yön 3 kare 1 sürümü", { exact: true })
		.selectOption(version);
	await review
		.getByLabel("Yön 4 kare 1 sürümü", { exact: true })
		.selectOption(version);
	await review.getByRole("button", { name: "Kare ekle" }).first().click();
	await review
		.getByLabel("Yön 1 kare 2 sürümü", { exact: true })
		.selectOption(version);
	await review.getByLabel("Yön 1 kare 2 süre (ms)").fill("250");
	await review.getByLabel("Oynatma konumu (ms)").fill("150");
	await expect(review.getByText("south · Kare 2")).toBeVisible();
	await expect(review.getByText("west · Kare 1")).toBeVisible();
	await review.getByRole("button", { name: "Birlikte oynat" }).click();
	await expect(review.getByLabel("Oynatma konumu (ms)")).not.toHaveValue("150");
	await review.getByRole("button", { name: "Duraklat" }).click();
	await review.getByRole("button", { name: "Başa dön" }).click();
	await expect(review.getByLabel("Yakınlaştırma")).toHaveValue("1");
	await review.getByLabel("Siluet", { exact: true }).fill("Same outline");
	await review.getByLabel("Oran", { exact: true }).fill("Same proportions");
	await review.getByLabel("Ekipman tarafı", { exact: true }).fill("Right");
	await review.getByLabel("Palet", { exact: true }).fill("Gray");
	await review.getByLabel("Perspektif", { exact: true }).fill("Side");
	await review.getByLabel("Ölçek", { exact: true }).fill("Native pixels");
	await review
		.getByLabel("Zemine temas", { exact: true })
		.fill("Needs follow-up");
	await review
		.getByLabel("Gerekçe", { exact: true })
		.fill("Four directions inspected by a human");
	await review.getByRole("button", { name: "İncelemeyi kaydet" }).click();
	await expect(
		review.getByText("İnceleme kalıcı kayıttan doğrulandı.")
	).toBeVisible();
	await page.reload();
	await review.getByRole("button", { name: fourDirectionHistory }).click();
	await expect(review.getByLabel("Gerekçe", { exact: true })).toHaveValue(
		"Four directions inspected by a human"
	);
	await expect(review.getByLabel("Yön 1 kare 2 süre (ms)")).toHaveValue("250");
	await expect(
		review.getByRole("button", { name: "İncelemeyi kaydet" })
	).toBeDisabled();
	await page.setViewportSize({ width: 1440, height: 2400 });
	await review.screenshot({
		path: "../../.context/directional-review-browser.png",
	});
	await review.getByRole("button", { name: "Yeni inceleme" }).click();
	await review.getByLabel("Yön sayısı").selectOption("8");
	for (const index of [1, 2, 3, 4, 5, 6, 7, 8]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions must occur in order.
		await review
			.getByLabel(`Yön ${index} kare 1 sürümü`, { exact: true })
			.selectOption(version);
	}
	for (const label of [
		"Siluet",
		"Oran",
		"Ekipman tarafı",
		"Palet",
		"Perspektif",
		"Ölçek",
		"Zemine temas",
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions must occur in order.
		await review.getByLabel(label, { exact: true }).fill("Reviewed");
	}
	await review
		.getByLabel("Gerekçe", { exact: true })
		.fill("Eight directions inspected");
	await review.getByLabel("Kullanıcı sonucu").selectOption("consistent");
	await review.getByRole("button", { name: "İncelemeyi kaydet" }).click();
	await expect(
		review.getByText("İnceleme kalıcı kayıttan doğrulandı.")
	).toBeVisible();
	await page.reload();
	await review.getByRole("button", { name: eightDirectionHistory }).click();
	await expect(review.getByLabel("Gerekçe", { exact: true })).toHaveValue(
		"Eight directions inspected"
	);
	await expect(review.getByRole("img")).toHaveCount(9);
});
