import { expect, type Page } from "@playwright/test";
import { signUpWithFixture } from "./project-workflow";

export const deliveryPlanningFixture = {
	userName: "Delivery Planning E2E",
	email: `delivery-planning-e2e-${crypto.randomUUID()}@example.test`,
	password: "DeliveryPlanningE2E-Password-1",
	projectName: "Delivery Planning Project",
	generalArtDirection: "Readable pixel silhouettes for a chapter demo",
	visualWorldName: "Ember Keep",
	identityName: "Keep Dwellers",
	useContext: "chapter demo",
	targetName: "Chapter 1 demo",
	// Each family gets one Asset Record with no Asset Version, so its required
	// item stays incomplete and the Readiness Plan is Blocked.
	families: [
		{
			familyName: "Ash Knight",
			itemName: "East-facing sprite",
			recordName: "Ash Knight east",
		},
		{
			familyName: "Moss Slime",
			itemName: "Idle loop",
			recordName: "Moss Slime idle",
		},
	],
} as const;

const recordSelectName = /^Varlık Kaydı/;

type DeliveryPlanningFixture = typeof deliveryPlanningFixture;

export async function createFamiliesWithRequiredLists(
	page: Page,
	fixture: DeliveryPlanningFixture = deliveryPlanningFixture
) {
	await page.goto("/projects");
	await page.getByRole("link", { name: "Varlık Aileleri" }).click();
	await page
		.getByRole("button", { name: "Aile ve temsil ilişkileri", exact: true })
		.click();
	await page.getByLabel("Varlık Kimliği adı").fill(fixture.identityName);
	await page.getByRole("button", { name: "Varlık Kimliği oluştur" }).click();

	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each family setup must occur in order.
		await page
			.getByRole("button", { name: "Aile ve temsil ilişkileri", exact: true })
			.click();
		await page.getByLabel("Varlık Ailesi adı").fill(family.familyName);
		await page
			.getByLabel("Görsel Dünya")
			.selectOption({ label: fixture.visualWorldName });
		await page.getByLabel("Kullanım bağlamı").fill(fixture.useContext);
		await page.getByRole("button", { name: "Varlık Ailesi oluştur" }).click();
		await page.getByLabel("Bağımsız ürün anlamı", { exact: true }).check();
		await page.getByLabel("Varlık Kaydı adı").fill(family.recordName);
		await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
		await page
			.getByRole("button", { name: "Aile kataloğu", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: family.familyName, exact: true })
		).toBeVisible();
	}

	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Each family's list is saved and activated before the next.
		await page
			.getByRole("button", { name: "Tamamlanma ve kanıtlar", exact: true })
			.click();
		await page
			.getByLabel("İnceleme ve tamamlanma için aile")
			.selectOption({ label: family.familyName });
		const readiness = page.getByRole("region", {
			name: "Tamamlanma ve kanıtlar",
		});
		await readiness.getByRole("button", { name: "Öğe ekle" }).click();
		await readiness.getByLabel("Öğe adı").fill(family.itemName);
		await readiness
			.getByRole("combobox", { name: recordSelectName })
			.selectOption({ label: family.recordName });
		await readiness
			.getByRole("button", { name: "Taslak sürümü kaydet" })
			.click();
		await expect(
			readiness.getByText("Yeni liste sürümü taslak olarak kaydedildi.")
		).toBeVisible();
		await readiness
			.getByRole("button", { name: "Bu sürümü etkinleştir" })
			.click();
		await expect(
			readiness.getByText("Gerekli Öğeler Listesi sürümü etkinleştirildi.")
		).toBeVisible();
	}
}

/** Signs up, creates a project with two Asset Families that each have an active Required Items List, and opens Delivery Targets. */
export async function prepareDeliveryPlanningWorkspace(
	page: Page,
	fixture: DeliveryPlanningFixture = deliveryPlanningFixture
) {
	await signUpWithFixture(page, fixture);
	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill(fixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await page
		.getByRole("button", { name: "Görsel Dünyalar ve Temalar", exact: true })
		.click();
	await page.getByLabel("Görsel Dünya adı").fill(fixture.visualWorldName);
	await page.getByRole("button", { name: "Görsel Dünya ekle" }).click();
	await expect(
		page.locator(".scope-record-list").getByText(fixture.visualWorldName)
	).toBeVisible();

	await createFamiliesWithRequiredLists(page, fixture);
	await page.getByRole("link", { name: "Delivery Targets" }).click();
	await expect(
		page.getByRole("heading", { name: "Delivery Targets", level: 1 })
	).toBeVisible();
}
