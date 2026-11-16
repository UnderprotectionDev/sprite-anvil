import { expect, test } from "@playwright/test";
import { activateFamilyProfile } from "./asset-family-workspace-fixture";
import { assetVersionFixture as fixture } from "./asset-version-fixture";
import { signUpWithFixture } from "./project-workflow";

const fourDirectionHistory = /4 directions · Needs follow-up/;
const eightDirectionHistory = /8 directions · Consistent/;

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
	await page.getByLabel("Project name").fill("Direction Review Knight");
	await page.getByLabel("Art direction").fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Create project" }).click();
	await page
		.getByRole("button", { name: "Visual Worlds and Themes", exact: true })
		.click();
	await page.getByLabel("Visual World name").fill(fixture.visualWorldName);
	await page.getByRole("button", { name: "Add Visual World" }).click();
	await expect(
		page.locator(".scope-record-list").getByText(fixture.visualWorldName)
	).toBeVisible();

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
	await page
		.getByRole("button", { name: "Family catalog", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: fixture.identityName })
	).toBeVisible();
	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Asset Family name").fill(fixture.familyName);
	await page.getByLabel("Visual World").selectOption({
		label: fixture.visualWorldName,
	});
	await page.getByLabel("Usage context").fill(fixture.useContext);
	await page.getByRole("button", { name: "Create Asset Family" }).click();
	await page
		.getByRole("button", { name: "Family catalog", exact: true })
		.click();
	await expect(
		page
			.getByRole("region", { name: "Saved Asset Families" })
			.getByRole("heading", { name: fixture.familyName, exact: true })
	).toBeVisible();

	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Independent product meaning", { exact: true }).check();
	await page.getByLabel("Asset Record name").fill(fixture.sourceName);
	await page.getByRole("button", { name: "Add Asset Record" }).click();
	const familyUrl = page.url();
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	await page
		.getByRole("link", { name: "Upload Asset Version", exact: true })
		.click();
	await page.getByLabel("PNG or WebP file", { exact: true }).setInputFiles({
		name: "ash-knight.png",
		mimeType: "image/png",
		buffer: Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVRYhWNgGAVDDeR3zviPD48sBzw9XoGCRx2QP+LSQP5gdEA+rR2UTy8H5JNo0agD8kejoHM0Ec4YzYb/h3dBxECkI8m2EB2MOiB/NAo6R3oiHAUMdAIApRlBiwhnmmsAAAAASUVORK5CYII=",
			"base64"
		),
	});
	await page
		.getByLabel("Unknown production history")
		.fill("Test image created for the disposable browser fixture.");
	await page
		.getByLabel("Bilinen kaynak", { exact: true })
		.fill("Directional review browser fixture");
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
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();

	await expect(
		page.getByRole("paragraph").filter({ hasText: "Sürüm 1 · Aday" })
	).toBeVisible();
	const reviewRationale = "The silhouette matches the family design.";
	await page.getByLabel("Review rationale").fill(reviewRationale);
	await page.getByRole("button", { name: "Approve" }).click();
	await expect(
		page.getByRole("paragraph").filter({ hasText: "Sürüm 1 · Onaylandı" })
	).toBeVisible();
	await expect(page.getByText(`— Gerekçe: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await page
		.getByRole("button", { name: "Select as Canonical Design" })
		.click();
	await expect(
		page.getByText("Ana Tasarım: Ash Knight base · Sürüm 1")
	).toBeVisible();

	await activateFamilyProfile(
		page,
		"Character, creature, and animation",
		familyUrl,
		"1.0.1"
	);
	const review = page.getByRole("region", {
		name: `${fixture.familyName} identity and direction review`,
	});
	const version = { label: `${fixture.sourceName} · Version 1` };
	await review
		.getByLabel("Direction 1 frame 1 version", { exact: true })
		.selectOption(version);
	await review
		.getByLabel("Direction 2 frame 1 version", { exact: true })
		.selectOption(version);
	await review
		.getByLabel("Direction 3 frame 1 version", { exact: true })
		.selectOption(version);
	await review
		.getByLabel("Direction 4 frame 1 version", { exact: true })
		.selectOption(version);
	await review.getByRole("button", { name: "Add frame" }).first().click();
	await review
		.getByLabel("Direction 1 frame 2 version", { exact: true })
		.selectOption(version);
	await review.getByLabel("Direction 1 frame 2 duration (ms)").fill("250");
	await review.getByLabel("Playback position (ms)").fill("150");
	await expect(review.getByText("south · Frame 2")).toBeVisible();
	await expect(review.getByText("west · Frame 1")).toBeVisible();
	await review.getByRole("button", { name: "Play together" }).click();
	await expect(review.getByLabel("Playback position (ms)")).not.toHaveValue(
		"150"
	);
	await review.getByRole("button", { name: "Pause" }).click();
	await review.getByRole("button", { name: "Restart" }).click();
	await expect(review.getByLabel("Zoom")).toHaveValue("1");
	await review.getByLabel("Silhouette", { exact: true }).fill("Same outline");
	await review
		.getByLabel("Proportions", { exact: true })
		.fill("Same proportions");
	await review.getByLabel("Equipment side", { exact: true }).fill("Right");
	await review.getByLabel("Palette", { exact: true }).fill("Gray");
	await review.getByLabel("Perspective", { exact: true }).fill("Side");
	await review.getByLabel("Scale", { exact: true }).fill("Native pixels");
	await review
		.getByLabel("Ground contact", { exact: true })
		.fill("Needs follow-up");
	await review
		.getByLabel("Rationale", { exact: true })
		.fill("Four directions inspected by a human");
	await review.getByRole("button", { name: "Save review" }).click();
	await expect(
		review.getByText("Review verified from the saved record.")
	).toBeVisible();
	await page.reload();
	await page
		.getByRole("button", { name: "Profile reviews", exact: true })
		.click();
	await review.getByRole("button", { name: fourDirectionHistory }).click();
	await expect(review.getByLabel("Rationale", { exact: true })).toHaveValue(
		"Four directions inspected by a human"
	);
	await expect(
		review.getByLabel("Direction 1 frame 2 duration (ms)")
	).toHaveValue("250");
	await expect(
		review.getByRole("button", { name: "Save review" })
	).toBeDisabled();
	await page.setViewportSize({ width: 1440, height: 2400 });
	await review.screenshot({
		path: "../../.context/directional-review-browser.png",
	});
	await review.getByRole("button", { name: "New review" }).click();
	await review.getByLabel("Direction count").selectOption("8");
	for (const index of [1, 2, 3, 4, 5, 6, 7, 8]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions must occur in order.
		await review
			.getByLabel(`Direction ${index} frame 1 version`, { exact: true })
			.selectOption(version);
	}
	for (const label of [
		"Silhouette",
		"Proportions",
		"Equipment side",
		"Palette",
		"Perspective",
		"Scale",
		"Ground contact",
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions must occur in order.
		await review.getByLabel(label, { exact: true }).fill("Reviewed");
	}
	await review
		.getByLabel("Rationale", { exact: true })
		.fill("Eight directions inspected");
	await review.getByLabel("User result").selectOption("consistent");
	await review.getByRole("button", { name: "Save review" }).click();
	await expect(
		review.getByText("Review verified from the saved record.")
	).toBeVisible();
	await page.reload();
	await page
		.getByRole("button", { name: "Profile reviews", exact: true })
		.click();
	await review.getByRole("button", { name: eightDirectionHistory }).click();
	await expect(review.getByLabel("Rationale", { exact: true })).toHaveValue(
		"Eight directions inspected"
	);
	await expect(review.getByRole("img")).toHaveCount(9);
});
