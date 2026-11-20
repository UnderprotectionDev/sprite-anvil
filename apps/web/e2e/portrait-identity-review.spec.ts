import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
	activateFamilyProfile,
	assetFamilyWorkspaceFixture,
	prepareAssetFamilyWorkspace,
} from "./asset-family-workspace-fixture";

test("reviews portrait expressions in dialogue and rereads exact crop and user judgments", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL &&
			process.env.PORTRAIT_REVIEW_LIVE !== "true",
		"Requires disposable PostgreSQL"
	);
	test.setTimeout(180_000);
	page.setDefaultTimeout(15_000);
	const email = `portrait-${crypto.randomUUID()}@example.test`;
	const { familyUrl } = await prepareAssetFamilyWorkspace(
		page,
		{
			...assetFamilyWorkspaceFixture,
			userName: "Portrait Reviewer",
			email,
			projectName: "Hero Portrait Review",
			identityName: "Hero",
			familyName: "Hero portraits",
			visualWorldName: "Illustrated portraits",
			useContext: "Dialogue",
			categoryLabel: "Portraits, logos, and marketing images",
			records: [
				{ name: "Neutral portrait", uploadNote: "Neutral portrait source." },
				{ name: "Happy portrait", uploadNote: "Happy portrait source." },
			],
		},
		"1.0.0",
		false
	);
	await page
		.getByRole("tab", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	const neutral = page.getByRole("listitem").filter({
		has: page.getByRole("heading", { name: "Neutral portrait", exact: true }),
	});
	await neutral
		.getByLabel("Review rationale")
		.fill("Approved portrait identity.");
	const approvalResponse = page.waitForResponse((response) =>
		response.url().includes("assetVersions/review")
	);
	await neutral.getByRole("button", { name: "Approve", exact: true }).click();
	const approval = await approvalResponse;
	expect(approval.ok(), await approval.text()).toBe(true);
	await expect(
		neutral.getByRole("paragraph").filter({ hasText: "Version 1 · Approved" })
	).toBeVisible();
	await neutral
		.getByRole("button", { name: "Select as Canonical Design" })
		.click();
	await expect(
		page.getByText("Canonical Design selected.", { exact: true })
	).toBeVisible();
	await page
		.getByRole("tab", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Relationship type").selectOption("derivative");
	await page
		.getByLabel("Related Asset Record")
		.selectOption({ label: "Happy portrait" });
	await page
		.getByRole("button", { name: "Add relationship", exact: true })
		.click();
	await expect(
		page.getByText("Relationship saved.", { exact: true })
	).toBeVisible();
	await activateFamilyProfile(
		page,
		"Portrait, logo, and marketing image",
		familyUrl,
		"1.0.0"
	);
	await page.getByRole("tab", { name: "Profile reviews", exact: true }).click();
	const review = page.getByRole("region", {
		name: "Review Portrait Identity and Crop",
	});
	await review
		.getByLabel("Portrait version")
		.nth(0)
		.selectOption({ label: "Neutral portrait · Version 1" });
	await review
		.getByLabel("Portrait version")
		.nth(1)
		.selectOption({ label: "Happy portrait · Version 1" });
	await review.getByLabel("Expression name").nth(0).fill("Neutral");
	await review.getByLabel("Expression name").nth(1).fill("Happy");
	await review.getByLabel("Crop X").nth(0).fill("8");
	await expect(
		review.getByRole("button", { name: "Save portrait review" })
	).toBeDisabled();
	await review.getByLabel("Crop width").nth(0).fill("24");
	await review.getByLabel("Usage width").nth(0).fill("137");
	await review.getByLabel("Usage height").nth(0).fill("181");
	await review
		.getByLabel("Identity consistency", { exact: true })
		.selectOption("passed");
	await review
		.getByLabel("Expression consistency", { exact: true })
		.selectOption("passed");
	await review
		.getByLabel("Crop and face visibility", { exact: true })
		.selectOption("failed");
	await review
		.getByLabel("Identity consistency notes")
		.fill("Same Hero identity.");
	await review
		.getByLabel("Expression consistency notes")
		.fill("Neutral and Happy remain distinct.");
	await review
		.getByLabel("Crop and face visibility notes")
		.fill("Face is clipped in dialogue.");
	await review
		.getByLabel("Review rationale")
		.fill("Dialogue crop needs follow-up.");
	await expect(
		review.getByRole("img", { name: "Neutral portrait Neutral" })
	).toBeVisible();
	await expect(
		review.getByRole("button", { name: "Save portrait review" })
	).toBeEnabled();
	await review.getByRole("button", { name: "Save portrait review" }).click();
	await expect(
		review.getByText("Portrait review saved.", { exact: true })
	).toBeVisible();
	await review.screenshot({ path: "../../.context/portrait-review.png" });
	if (process.env.PORTRAIT_REVIEW_RESULT_PATH) {
		await writeFile(
			process.env.PORTRAIT_REVIEW_RESULT_PATH,
			JSON.stringify({
				email,
				password: assetFamilyWorkspaceFixture.password,
				familyPath: new URL(familyUrl).pathname,
			}),
			{ mode: 0o600 }
		);
	}
	await page.reload();
	await page.getByRole("tab", { name: "Profile reviews", exact: true }).click();
	await expect(
		review.getByText("Dialogue crop needs follow-up.", { exact: true })
	).toBeVisible();
	await review.getByText("Show review details", { exact: true }).click();
	await expect(
		review.getByText(
			"Crop and face visibility: Fail · Face is clipped in dialogue.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		review.getByText(
			"Neutral portrait · Neutral · Dialogue · 137 × 181 px · Crop: 8, 0, 24 × 32 · Light",
			{ exact: true }
		)
	).toBeVisible();
});
