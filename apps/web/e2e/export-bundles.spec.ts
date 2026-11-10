import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
	buildFixtureBundleFiles,
	replaceFile,
	writeBundleDirectory,
} from "@sprite-anvil/api/export-bundle-verification-fixture";
import {
	createProjectFromProjectsView,
	signUpWithFixture,
} from "./project-workflow";

const verifiedText = /Bundle verified/;
const corruptedPathText = /images\/hero_idle\.png/;

const fixture = {
	email: `export-bundles-e2e-${crypto.randomUUID()}@example.test`,
	generalArtDirection: "Readable pixel silhouettes for a chapter demo",
	password: "ExportBundlesE2E-Password-1",
	projectName: "Export Bundles Project",
	userName: "Export Bundles E2E",
};

async function openExportBundles(page: Page) {
	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);
	await page.getByRole("link", { name: "Export Bundles" }).click();
	await expect(
		page.getByRole("heading", { name: "Export Bundles", level: 1 })
	).toBeVisible();
}

test("reads a bundle directory offline and shows its manifest and a verified result", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required to sign in."
	);
	const directory = mkdtempSync(join(tmpdir(), "export-bundle-e2e-"));
	writeBundleDirectory(await buildFixtureBundleFiles(), directory);

	await openExportBundles(page);
	await page.getByLabel("Bundle directory").setInputFiles(directory);

	await expect(page.getByText(verifiedText)).toBeVisible();
	await expect(page.getByText("Manifest contract version")).toBeVisible();
	await expect(page.getByText("Profile revision")).toBeVisible();
});

test("rejects a corrupted file with its path", async ({ page }) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required to sign in."
	);
	const directory = mkdtempSync(join(tmpdir(), "export-bundle-e2e-"));
	writeBundleDirectory(
		replaceFile(
			await buildFixtureBundleFiles(),
			"images/hero_idle.png",
			Uint8Array.of(0)
		),
		directory
	);

	await openExportBundles(page);
	await page.getByLabel("Bundle directory").setInputFiles(directory);

	await expect(page.getByText("Integrity check failed.")).toBeVisible();
	await expect(page.getByText(corruptedPathText)).toBeVisible();
	await expect(page.getByText(verifiedText)).toHaveCount(0);
});
