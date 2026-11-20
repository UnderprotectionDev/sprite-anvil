import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
	activateFamilyProfile,
	prepareAssetFamilyWorkspace,
} from "./asset-family-workspace-fixture";
import { assetVersionFixture } from "./asset-version-fixture";

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
	const { familyUrl } = await prepareAssetFamilyWorkspace(
		page,
		{
			...fixture,
			categoryLabel: "Characters, creatures, and animations",
			records: [
				{
					name: fixture.sourceName,
					uploadNote: "Disposable animation timing fixture.",
				},
			],
		},
		"1.0.1",
		false
	);

	await expect(
		page.getByRole("paragraph").filter({ hasText: "Version 1 · Candidate" })
	).toBeVisible();
	await page
		.locator('textarea[id^="review-rationale-"]')
		.fill("The sprite is suitable for timing review.");
	await page.getByRole("button", { name: "Approve" }).click();
	await expect(
		page.getByRole("paragraph").filter({ hasText: "Version 1 · Approved" })
	).toBeVisible();
	await page
		.getByRole("button", { name: "Select as Canonical Design" })
		.click();
	await page.getByRole("tab", { name: "Family catalog" }).click();
	await expect(
		page
			.getByRole("tabpanel", { name: "Family catalog" })
			.getByText(`Canonical Design: ${fixture.sourceName} · Version 1`)
	).toBeVisible();

	await activateFamilyProfile(
		page,
		"Character, creature, and animation",
		familyUrl,
		"1.0.1"
	);

	return {
		familyName: fixture.familyName,
		review: page.getByRole("region", {
			name: `${fixture.familyName} animation timing review`,
		}),
		versionLabel: `${fixture.sourceName} · Version 1`,
	};
}
