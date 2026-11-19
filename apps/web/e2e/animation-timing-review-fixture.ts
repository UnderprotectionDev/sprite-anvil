import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { assetVersionFixture } from "./asset-version-fixture";
import { signUpWithFixture } from "./project-workflow";

const profileContractActivationName = /Activate contract v/u;

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
	await page.getByLabel("Project name").fill(fixture.projectName);
	await page.getByLabel("Art direction").fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Create project" }).click();
	await expect(
		page.getByRole("heading", { name: "Prepare a Context Proposal" })
	).toBeVisible();
	await page.getByLabel("Visual World name").fill(fixture.visualWorldName);
	await page.getByRole("button", { name: "Add Visual World" }).click();
	await expect(
		page.locator(".scope-record-list").getByText(fixture.visualWorldName)
	).toBeVisible();

	await page.goto("/projects");
	await page.getByRole("link", { name: "Asset Families" }).click();
	await page.getByLabel("Subject Identity name").fill(fixture.identityName);
	await page.getByRole("button", { name: "Create Subject Identity" }).click();
	await expect(
		page.getByRole("heading", { name: fixture.identityName })
	).toBeVisible();
	await page.getByLabel("Asset Family name").fill(fixture.familyName);
	await page.getByLabel("Visual World").selectOption({
		label: fixture.visualWorldName,
	});
	await page.getByLabel("Usage context").fill(fixture.useContext);
	await page.getByRole("button", { name: "Create Asset Family" }).click();
	await expect(
		page
			.getByRole("region", { name: "Saved Asset Families" })
			.getByRole("heading", { name: fixture.familyName, exact: true })
	).toBeVisible();

	await page.getByLabel("Independent product meaning", { exact: true }).check();
	await page.getByLabel("Asset Record name").fill(fixture.sourceName);
	await page.getByRole("button", { name: "Add Asset Record" }).click();
	const familyUrl = page.url();
	await page
		.getByRole("link", { name: "Upload Asset Version", exact: true })
		.click();
	await page.getByLabel("PNG or WebP file", { exact: true }).setInputFiles({
		name: "animation-timing-sprite.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page
		.getByLabel("Unknown production history")
		.fill("Test image created for the disposable animation timing fixture.");
	await page
		.getByLabel("Known source", { exact: true })
		.fill("Animation timing review browser fixture");
	await page
		.getByLabel("Your relationship to the asset")
		.selectOption("created_by_user");
	await page
		.getByRole("button", { name: "Save Candidate Version", exact: true })
		.click();
	await expect(
		page.getByText("Candidate Version saved.", { exact: true })
	).toBeVisible();
	await page.goto(familyUrl);

	await expect(
		page.getByRole("paragraph").filter({ hasText: "Version 1 · Candidate" })
	).toBeVisible();
	await page
		.getByLabel("Review rationale")
		.fill("The sprite is suitable for timing review.");
	await page.getByRole("button", { name: "Approve" }).click();
	await expect(
		page.getByRole("paragraph").filter({ hasText: "Version 1 · Approved" })
	).toBeVisible();
	await page
		.getByRole("button", { name: "Select as Canonical Design" })
		.click();
	await expect(
		page.getByText(`Canonical Design: ${fixture.sourceName} · Version 1`)
	).toBeVisible();

	const profile = page
		.getByRole("heading", {
			name: "Characters, creatures, and animations",
			exact: true,
		})
		.locator("xpath=ancestor::li[1]");
	await profile
		.getByRole("button", { name: profileContractActivationName })
		.click();
	await expect(
		profile.getByText("Active contract v1.0.1", { exact: true })
	).toBeVisible();

	return {
		familyName: fixture.familyName,
		review: page.getByRole("region", {
			name: `${fixture.familyName} animation timing review`,
		}),
		versionLabel: `${fixture.sourceName} · Version 1`,
	};
}
