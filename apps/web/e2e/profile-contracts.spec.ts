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
		"A disposable Neon test branch is required for the persistent flow."
	);
	const fixture = createAssetRecordFixture();
	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);
	await page
		.getByRole("link", {
			name: `${fixture.projectName} özel profil sözleşmelerini yönet`,
		})
		.click();

	await expect(
		page.getByRole("heading", {
			name: `${fixture.projectName} · Özel Profil Sözleşmeleri`,
		})
	).toBeVisible();
	const iconProfile = page.getByRole("article", { name: "İkon" });
	await iconProfile.getByText("Sözleşme ayrıntıları").click();
	await expect(iconProfile.getByText("icon.metadata_roundtrip")).toBeVisible();
	await iconProfile
		.getByRole("button", { name: "Sözleşmeyi etkinleştir" })
		.click();
	await expect(
		page.getByText("İkon 1.0.0 sürümü etkinleştirildi ve yeniden okundu.")
	).toBeVisible();

	await page.reload();
	await expect(iconProfile.getByText("Bu projede etkin · 1.0.0")).toBeVisible();
	await expect(
		iconProfile.getByRole("button", { name: "Etkin" })
	).toBeDisabled();
});
