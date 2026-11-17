import { expect, test } from "@playwright/test";
import { createAssetRecordFixture } from "./asset-record-fixture";
import {
	createProjectFromProjectsView,
	signUpWithFixture,
} from "./project-workflow";

const identityCheckboxName = /Independent product meaning/;

test("persists Collection membership changes through the web flow", async ({
	page,
}) => {
	const fixture = createAssetRecordFixture();
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A dedicated test database is required for the persistent flow."
	);

	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);
	await page
		.getByRole("link", {
			name: `${fixture.projectName} open Asset Records`,
		})
		.click();
	await page
		.getByRole("button", { name: "New Asset Record", exact: true })
		.click();
	await page.getByLabel("Asset name").fill(fixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Create Asset Record" }).click();
	await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();

	await page.getByRole("link", { name: "Projects" }).click();
	await page
		.getByRole("link", {
			name: `${fixture.projectName} manage Collections`,
		})
		.click();
	const collectionName = `Planning ${fixture.name}`;
	await page.getByLabel("Collection name").fill(collectionName);
	await page.getByRole("button", { name: "Create Collection" }).click();
	await expect(
		page.getByRole("heading", { name: collectionName, level: 2 })
	).toBeVisible();

	await page
		.getByLabel("Asset Record")
		.selectOption({ label: `${fixture.name} · No Asset Family assigned` });
	await page.getByRole("button", { name: "Add to Collection" }).click();
	await expect(
		page.getByRole("heading", { name: fixture.name, level: 3 })
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: fixture.name, level: 3 })
	).toBeVisible();

	await page
		.getByRole("button", {
			name: `${fixture.name} Remove Asset Record from Collection`,
		})
		.click();
	await expect(
		page.getByText("This Collection has no Asset Records yet.", {
			exact: true,
		})
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByRole("heading", { name: collectionName, level: 2 })
	).toBeVisible();
	await expect(
		page.getByText("This Collection has no Asset Records yet.", {
			exact: true,
		})
	).toBeVisible();
});
