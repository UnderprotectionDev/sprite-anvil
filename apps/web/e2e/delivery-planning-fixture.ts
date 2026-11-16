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
	await page.getByRole("link", { name: "Asset Families" }).click();
	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Subject Identity name").fill(fixture.identityName);
	await page.getByRole("button", { name: "Create Subject Identity" }).click();

	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each family setup must occur in order.
		await page
			.getByRole("button", {
				name: "Family and representation relationships",
				exact: true,
			})
			.click();
		await page.getByLabel("Asset Family name").fill(family.familyName);
		await page
			.getByLabel("Visual World")
			.selectOption({ label: fixture.visualWorldName });
		await page.getByLabel("Usage context").fill(fixture.useContext);
		await page.getByRole("button", { name: "Create Asset Family" }).click();
		await page
			.getByLabel("Independent product meaning", { exact: true })
			.check();
		await page.getByLabel("Asset Record name").fill(family.recordName);
		await page.getByRole("button", { name: "Add Asset Record" }).click();
		await page
			.getByRole("button", { name: "Family catalog", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: family.familyName, exact: true })
		).toBeVisible();
	}

	for (const family of fixture.families) {
		// biome-ignore lint/performance/noAwaitInLoops: Each family's list is saved and activated before the next.
		await page
			.getByRole("button", { name: "Completion and evidence", exact: true })
			.click();
		await page
			.getByLabel("Family for review and completion")
			.selectOption({ label: family.familyName });
		const readiness = page.getByRole("region", {
			name: "Completion and evidence",
		});
		await readiness.getByRole("button", { name: "Add item" }).click();
		await readiness.getByLabel("Item name").fill(family.itemName);
		await readiness
			.getByRole("combobox", { name: recordSelectName })
			.selectOption({ label: family.recordName });
		await readiness.getByRole("button", { name: "Save draft version" }).click();
		await expect(
			readiness.getByText("New list version saved as a draft.")
		).toBeVisible();
		await readiness
			.getByRole("button", { name: "Activate this version" })
			.click();
		await expect(
			readiness.getByText("Required Set version activated.")
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
		.getByLabel("General art direction")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await page
		.getByRole("button", { name: "Visual Worlds and Themes", exact: true })
		.click();
	await page.getByLabel("Visual World name").fill(fixture.visualWorldName);
	await page.getByRole("button", { name: "Add Visual World" }).click();
	await expect(
		page.locator(".scope-record-list").getByText(fixture.visualWorldName)
	).toBeVisible();

	await createFamiliesWithRequiredLists(page, fixture);
	await page.getByRole("link", { name: "Delivery Targets" }).click();
	await expect(
		page.getByRole("heading", { name: "Delivery Targets", level: 1 })
	).toBeVisible();
}
