import { expect, test } from "@playwright/test";
import { createAssetRecordFixture } from "./asset-record-fixture";
import {
	createProjectFromProjectsView,
	signUpWithFixture,
} from "./project-workflow";

test("persists a Specialized Profile Contract activation through the web flow", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A dedicated test database is required for the persistent flow."
	);
	const fixture = createAssetRecordFixture();
	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);
	await page
		.getByRole("link", {
			name: `${fixture.projectName} manage Specialized Profile Contracts`,
		})
		.click();

	await expect(
		page.getByRole("heading", {
			name: `${fixture.projectName} · Specialized Profile Contracts`,
		})
	).toBeVisible();
	await page.getByRole("tab", { name: "Icon", exact: true }).click();
	const iconProfile = page.getByRole("article", { name: "Icon" });
	await iconProfile.getByText("Contract details").click();
	await expect(iconProfile.getByText("icon.metadata_roundtrip")).toBeVisible();
	await iconProfile.getByRole("button", { name: "Activate contract" }).click();
	await expect(
		page.getByText("Icon 1.0.0 version activated and reread.")
	).toBeVisible();

	await page.reload();
	await page.getByRole("tab", { name: "Icon", exact: true }).click();
	await expect(
		iconProfile.getByText("Active in this project · 1.0.0")
	).toBeVisible();
	await expect(
		iconProfile.getByRole("button", { name: "Active" })
	).toBeDisabled();
});
