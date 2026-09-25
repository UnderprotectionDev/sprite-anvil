import { expect, test } from "@playwright/test";
import { assetVersionFixture as fixture } from "./asset-version-fixture";

test("uploads, reviews, selects, and rereads exact Asset Version lineage", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);

	await page.goto("/login");
	await page.getByLabel("Name").fill(fixture.userName);
	await page.getByLabel("Email").fill(fixture.email);
	await page.getByLabel("Password").fill(fixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

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
		page.getByText(fixture.familyName, { exact: true })
	).toBeVisible();

	await page.getByLabel("Varlık Kaydı adı").fill(fixture.sourceName);
	await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
	await page.getByLabel("Varlık Kaydı adı").fill(fixture.derivativeName);
	await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
	await expect(
		page.getByText(fixture.derivativeName, { exact: true })
	).toBeVisible();

	await page
		.getByLabel(`${fixture.sourceName} için Varlık Sürümü dosyası`)
		.setInputFiles({
			name: "ash-knight.png",
			mimeType: "image/png",
			buffer: fixture.png,
		});
	await expect(page.getByText("Sürüm 1 · Aday")).toBeVisible();
	const reviewRationale = "The silhouette matches the family design.";
	await page.getByLabel("İnceleme gerekçesi").fill(reviewRationale);
	await page.getByRole("button", { name: "Onayla" }).click();
	await expect(page.getByText("Sürüm 1 · Onaylandı")).toBeVisible();
	await expect(page.getByText(`— Gerekçe: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await page.getByRole("button", { name: "Ana Tasarım olarak seç" }).click();
	await expect(
		page.getByText("Ana Tasarım: Ash Knight base · Sürüm 1")
	).toBeVisible();

	await page.getByLabel("İlişki türü").selectOption("derivative");
	await expect(
		page.getByText("Ash Knight base · Ana Tasarım Sürüm 1")
	).toBeVisible();
	await page
		.getByLabel("İlgili Varlık Kaydı")
		.selectOption({ label: fixture.derivativeName });
	await page.getByRole("button", { name: "İlişki ekle" }).click();
	await expect(page.getByText(fixture.visibleLineage)).toBeVisible();

	await page.reload();
	await expect(page.getByText("Sürüm 1 · Onaylandı")).toBeVisible();
	await expect(page.getByText(`— Gerekçe: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await expect(page.getByText(fixture.visibleLineage)).toBeVisible();
});
