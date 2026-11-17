import { expect, test } from "@playwright/test";
import { assetVersionFixture as fixture } from "./asset-version-fixture";
import { signUpWithFixture } from "./project-workflow";

test("uploads and rereads exact Asset and Composite Version lineage", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);

	await signUpWithFixture(page, fixture);

	await page.goto("/context-proposals");
	await page.getByLabel("Project name").fill(fixture.projectName);
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
		page.getByText(fixture.familyName, { exact: true })
	).toBeVisible();

	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Asset Record name").fill(fixture.sourceName);
	await page.getByRole("button", { name: "Add Asset Record" }).click();
	await page.getByLabel("Asset Record name").fill(fixture.derivativeName);
	await page.getByRole("button", { name: "Add Asset Record" }).click();
	await page
		.getByRole("button", { name: "Family catalog", exact: true })
		.click();
	await expect(
		page.getByText(fixture.derivativeName, { exact: true })
	).toBeVisible();

	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	const familyUrl = page.url();
	await page
		.locator("li", {
			has: page.getByRole("heading", { name: fixture.sourceName, exact: true }),
		})
		.getByRole("link", { name: "Upload Asset Version" })
		.click();
	await page.getByLabel("PNG or WebP file").setInputFiles({
		name: "ash-knight.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page
		.getByLabel("Unknown production history")
		.fill("Test image created for the disposable review fixture.");
	await page.getByLabel("Known source").fill("Asset version browser fixture");
	await page
		.getByLabel("Your relationship to the asset")
		.selectOption("created_by_user");
	await page.getByRole("button", { name: "Save Candidate Version" }).click();
	await expect(page.getByText("Candidate Version saved.")).toBeVisible();
	await page.goto(familyUrl);
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	await expect(page.getByText("Version 1 · Candidate")).toBeVisible();
	const reviewRationale = "The silhouette matches the family design.";
	await page.getByLabel("Review rationale").fill(reviewRationale);
	await page.getByRole("button", { name: "Approve" }).click();
	await expect(page.getByText("Version 1 · Approved")).toBeVisible();
	await expect(page.getByText(`— Rationale: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await page
		.getByRole("button", { name: "Select as Canonical Design" })
		.click();
	await expect(
		page.getByText("Canonical Design: Ash Knight base · Version 1")
	).toBeVisible();

	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Relationship type").selectOption("derivative");
	await expect(
		page.getByText("Ash Knight base · Canonical Design Version 1")
	).toBeVisible();
	await page
		.getByLabel("Related Asset Record")
		.selectOption({ label: fixture.derivativeName });
	await page.getByRole("button", { name: "Add relationship" }).click();
	await page
		.getByRole("button", { name: "Family catalog", exact: true })
		.click();
	await expect(page.getByText(fixture.visibleLineage)).toBeVisible();
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();

	const sourceRecord = page
		.getByRole("heading", { name: fixture.sourceName })
		.locator("xpath=ancestor::li[1]");
	const unitCorrectionType = sourceRecord.getByLabel("Unit type");
	const unitCorrectionKey = sourceRecord.getByLabel("Unit name");
	const unitCorrectionSource = sourceRecord.getByLabel("Source Asset Version");
	const unitCorrectionFile = sourceRecord.getByLabel("Corrected PNG or WebP");
	await unitCorrectionType.selectOption("frame");
	await unitCorrectionKey.fill("attack/frame-3");
	await unitCorrectionSource.selectOption({ label: "Version 1 · Approved" });
	await unitCorrectionFile.setInputFiles({
		name: "attack-frame-3-v1.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page.getByRole("button", { name: "Save unit correction" }).click();
	await expect(
		page.getByText("Frame · attack/frame-3 · Unit Version 1")
	).toBeVisible();

	await unitCorrectionType.selectOption("direction");
	await unitCorrectionKey.fill("north");
	await unitCorrectionSource.selectOption({ label: "Version 1 · Approved" });
	await unitCorrectionFile.setInputFiles({
		name: "north-direction-v1.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page.getByRole("button", { name: "Save unit correction" }).click();
	await expect(
		page.getByText("Direction · north · Unit Version 1")
	).toBeVisible();

	await sourceRecord.getByLabel("Frame · attack/frame-3").selectOption({
		label: "Unit Version 1 · Asset Version 2 · Candidate",
	});
	await sourceRecord.getByLabel("Direction · north").selectOption({
		label: "Unit Version 1 · Asset Version 3 · Candidate",
	});
	await page
		.getByRole("button", { name: "Save new Composite Version" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Composite Version 1 · Candidate" })
	).toBeVisible();

	const firstCompositeHeading = page.getByRole("heading", {
		name: "Composite Version 1 · Candidate",
	});
	const firstComposite = firstCompositeHeading.locator(
		"xpath=ancestor::article[1]"
	);
	await firstComposite
		.getByLabel("Composite Version 1 review rationale")
		.fill("The initial frame and direction were reviewed together.");
	await firstComposite.getByRole("button", { name: "Approve" }).click();
	await expect(
		page.getByRole("heading", { name: "Composite Version 1 · Approved" })
	).toBeVisible();

	await unitCorrectionType.selectOption("frame");
	await unitCorrectionKey.fill("attack/frame-3");
	await unitCorrectionSource.selectOption({ label: "Version 2 · Candidate" });
	await unitCorrectionFile.setInputFiles({
		name: "attack-frame-3-v2.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page.getByRole("button", { name: "Save unit correction" }).click();
	await expect(
		page.getByText("Frame · attack/frame-3 · Unit Version 2")
	).toBeVisible();

	const correctedAssetVersion = sourceRecord
		.getByText("Version 4 · Candidate", { exact: true })
		.locator("xpath=ancestor::li[1]");
	await correctedAssetVersion
		.getByLabel("Review rationale")
		.fill("The corrected frame is ready for composition.");
	await correctedAssetVersion.getByRole("button", { name: "Approve" }).click();
	await expect(
		correctedAssetVersion.getByText("Version 4 · Approved", { exact: true })
	).toBeVisible();

	await page;
	sourceRecord
		.getByLabel("Starting Composite Version")
		.selectOption({ label: "Composite Version 1 · Approved" });
	await sourceRecord.getByLabel("Frame · attack/frame-3").selectOption({
		label: "Unit Version 2 · Asset Version 4 · Approved",
	});
	await page
		.getByRole("button", { name: "Save new Composite Version" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Composite Version 2 · Candidate" })
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Composite Version 1 · Approved" })
	).toBeVisible();

	const secondComposite = page
		.getByRole("heading", { name: "Composite Version 2 · Candidate" })
		.locator("xpath=ancestor::article[1]");
	await expect(
		secondComposite.getByText("Frame · attack/frame-3 · Unit Version 2")
	).toBeVisible();
	await expect(
		secondComposite.getByText("Direction · north · Unit Version 1")
	).toBeVisible();
	await expect(
		secondComposite.getByText("Asset Version 4 · Approved")
	).toBeVisible();

	await page.reload();
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	await expect(page.getByText("Version 1 · Approved")).toBeVisible();
	await expect(page.getByText(`— Rationale: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await page
		.getByRole("button", { name: "Family catalog", exact: true })
		.click();
	await expect(page.getByText(fixture.visibleLineage)).toBeVisible();
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	await expect(
		page.getByRole("heading", { name: "Composite Version 1 · Approved" })
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Composite Version 2 · Candidate" })
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Composite Version 1 · Approved" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Frame · attack/frame-3 · Unit Version 1")
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Composite Version 1 · Approved" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Direction · north · Unit Version 1")
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Composite Version 2 · Candidate" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Frame · attack/frame-3 · Unit Version 2")
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Composite Version 2 · Candidate" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Asset Version 4 · Approved")
	).toBeVisible();
});
