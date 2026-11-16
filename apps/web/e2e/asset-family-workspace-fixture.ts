import { expect, type Page } from "@playwright/test";
import { signUpWithFixture } from "./project-workflow";

const objectProfileHeading = "Objects, weapons, equipment, and state families";
const candidateVersionText = "Version 1 · Candidate";

export const assetFamilyWorkspaceFixture = {
	userName: "Asset Family Comparison E2E",
	email: `asset-family-comparison-e2e-${crypto.randomUUID()}@example.test`,
	password: "AssetFamilyComparisonE2E-Password-1",
	projectName: "Asset Family Comparison Project",
	generalArtDirection: "Readable states and directions for props",
	visualWorldName: "Comparison Gameplay",
	identityName: "Crate",
	familyName: "Crate States and Directions",
	useContext: "world props",
	records: [
		{ name: "Kapalı sandık", uploadNote: "Closed crate browser fixture." },
		{ name: "Açık sandık", uploadNote: "Open crate browser fixture." },
	],
	categoryLabel: objectProfileHeading,
	// A 32×32 PNG that passes the server's strict sharp decode; the shared
	// 1×1 asset-version fixture PNG trips the warning-failing libpng read.
	png: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVRYhWNgGAVDDeR3zviPD48sBzw9XoGCRx2QP+LSQP5gdEA+rR2UTy8H5JNo0agD8kejoHM0Ec4YzYb/h3dBxECkI8m2EB2MOiB/NAo6R3oiHAUMdAIApRlBiwhnmmsAAAAASUVORK5CYII=",
		"base64"
	),
};

export async function prepareAssetFamilyWorkspace(
	page: Page,
	fixture: Omit<typeof assetFamilyWorkspaceFixture, "records"> & {
		records: {
			name: string;
			uploadNote: string;
			categoryLabel?: string;
			png?: Buffer;
		}[];
	} = assetFamilyWorkspaceFixture,
	contractVersion = "1.0.0",
	activateProfile = true
) {
	await signUpWithFixture(page, fixture);

	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill(fixture.projectName);
	await page
		.getByLabel("General art direction")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
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

	const familyUrl = page.url();
	for (const record of fixture.records) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each record setup must occur in order.
		await page
			.getByRole("button", {
				name: "Family and representation relationships",
				exact: true,
			})
			.click();
		await page
			.getByLabel("Independent product meaning", { exact: true })
			.check();
		await page.getByLabel("Asset Record name").fill(record.name);
		await page.getByRole("button", { name: "Add Asset Record" }).click();
		await page
			.getByRole("button", {
				name: "Version and dependency operations",
				exact: true,
			})
			.click();
		await expect(
			page
				.getByRole("listitem")
				.filter({ has: page.getByRole("heading", { name: record.name }) })
				.getByText("No versions saved yet.")
		).toBeVisible();

		await page
			.getByRole("listitem")
			.filter({ has: page.getByRole("heading", { name: record.name }) })
			.getByRole("link", { name: "Upload Asset Version" })
			.click();

		await page
			.getByRole("button", { name: "Record details", exact: true })
			.click();
		// Scope hydration can reset the form's initial metadata. Select only once
		// the record and its family world have finished loading.
		await expect(
			page.getByRole("heading", {
				name: "Asset Record metadata",
				exact: true,
			})
		).toBeVisible();
		await expect(page.locator("#asset-record-metadata-world")).toBeDisabled();
		await expect(
			page.getByRole("button", { name: "Save metadata" })
		).toBeEnabled();
		await page
			.getByLabel("Asset category")
			.selectOption({ label: record.categoryLabel ?? fixture.categoryLabel });
		await page.getByRole("button", { name: "Save metadata" }).click();
		await expect(page.getByText("Asset Record metadata saved.")).toBeVisible();

		await page
			.getByRole("button", { name: "Versions and files", exact: true })
			.click();
		await page.getByLabel("PNG or WebP file").setInputFiles({
			name: `${record.name}.png`,
			mimeType: "image/png",
			buffer: record.png ?? fixture.png,
		});
		await page.getByLabel("Unknown production history").fill(record.uploadNote);
		await page
			.getByLabel("Bilinen kaynak", { exact: true })
			.fill("Asset family comparison browser fixture");
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
			page
				.getByRole("listitem")
				.filter({ has: page.getByRole("heading", { name: record.name }) })
				.getByRole("paragraph")
				.filter({ hasText: candidateVersionText })
		).toBeVisible();
	}

	const contractNames: Record<string, string> = {
		"UI screens and components": "UI screen and component",
		"Objects, weapons, equipment, and state families":
			"Object, weapon, equipment, and state",
		"Characters, creatures, and animations":
			"Character, creature, and animation",
		"Backgrounds and parallax": "Background and parallax",
		"Portraits, logos, and marketing images":
			"Portrait, logo, and marketing image",
	};
	const contractName = contractNames[fixture.categoryLabel];
	if (!contractName) {
		throw new Error(`Unknown fixture profile: ${fixture.categoryLabel}`);
	}
	if (activateProfile) {
		await activateFamilyProfile(page, contractName, familyUrl, contractVersion);
	}

	return { familyName: fixture.familyName, familyUrl };
}

export async function activateFamilyProfile(
	page: Page,
	contractName: string,
	familyUrl: string,
	contractVersion: string
) {
	await page
		.getByRole("link", { name: "Specialized Profile Contracts", exact: true })
		.click();
	await page.getByRole("button", { name: contractName, exact: true }).click();
	const profile = page.getByRole("article", {
		name: contractName,
		exact: true,
	});
	await profile.getByRole("button", { name: "Activate contract" }).click();
	await expect(
		profile.getByText(`Active in this project · ${contractVersion}`)
	).toBeVisible();
	await page.goto(familyUrl);
	await page
		.getByRole("button", { name: "Profile reviews", exact: true })
		.click();
}
