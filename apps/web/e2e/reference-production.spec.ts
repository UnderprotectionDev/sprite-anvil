import { expect, test } from "@playwright/test";
import {
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "./asset-record-fixture";
import {
	createProjectFromProjectsView,
	signUpWithFixture,
} from "./project-workflow";

const identityCheckboxName = /Bağımsız ürün anlamı/;

test("persists reference transfer constraints through the web flow", async ({
	page,
}) => {
	const fixture = createAssetRecordFixture();
	test.skip(
		!assetVersionE2eEnabled,
		"A dedicated test database and explicitly selected test R2 bucket are required for reference persistence."
	);

	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);
	await page
		.getByRole("link", {
			name: `${fixture.projectName} varlık kayıtlarını aç`,
		})
		.click();
	await page
		.getByRole("button", { name: "New Asset Record", exact: true })
		.click();
	await page.getByLabel("Asset name").fill(fixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Create Asset Record" }).click();
	await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();

	await page
		.getByRole("button", { name: "Production and import", exact: true })
		.click();
	await page.locator("#reference-upload-file").setInputFiles({
		name: "walking-pose.png",
		mimeType: "image/png",
		buffer: Buffer.from(fixture.assetVersionPngBase64, "base64"),
	});
	await page
		.getByRole("group", { name: "Features to avoid" })
		.getByRole("checkbox", { name: "Identity" })
		.check();
	await page.getByLabel("Referans notu").fill("Use the pose only.");
	await page.getByRole("button", { name: "Upload image" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Reference image added to the board."
	);

	let card = page.getByRole("article").filter({
		has: page.getByRole("img", {
			name: "walking-pose.png adlı referans görseli",
		}),
	});
	await expect(card.getByText("Use the pose only.")).toBeVisible();
	await card.getByText("Edit rules").click();
	await card.getByLabel("Reference usage purpose").selectOption("custom");
	await card.getByLabel("Custom usage purpose").fill("Animation timing cue");
	await card.getByLabel("Referans notu").fill("Timing cue only.");
	await card.getByRole("button", { name: "Save rules" }).click();
	await expect(card.getByRole("status")).toContainText(
		"Reference rules and note saved."
	);
	await card.getByText("Rule history").click();
	await expect(card.getByText("Revizyon 1 ·", { exact: false })).toBeVisible();
	await expect(card.getByText("Revizyon 2 ·", { exact: false })).toBeVisible();

	await page.reload();
	await page
		.getByRole("button", { name: "Production and import", exact: true })
		.click();
	card = page.getByRole("article").filter({
		has: page.getByRole("img", {
			name: "walking-pose.png adlı referans görseli",
		}),
	});
	await expect(card.getByText("Animation timing cue")).toBeVisible();
	await expect(card.getByText("Timing cue only.")).toBeVisible();
	await card.getByText("Rule history").click();
	await expect(card.getByText("Revizyon 1 ·", { exact: false })).toBeVisible();
	await expect(card.getByText("Revizyon 2 ·", { exact: false })).toBeVisible();
});
