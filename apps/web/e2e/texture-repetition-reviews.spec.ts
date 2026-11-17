import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { activateFamilyProfile } from "./asset-family-workspace-fixture";
import { assetVersionE2eEnabled } from "./asset-record-fixture";
import { signUpWithFixture } from "./project-workflow";
import {
	textureRepetitionFixture as fixture,
	readTexturePreviewPresentation,
} from "./texture-repetition-review-fixture";

const profileLabel = "Tilesets, terrain, and seamless textures";

test("reviews exact texture edges and all three arrangements, then rereads metadata after reload", async ({
	page,
}) => {
	test.skip(
		!assetVersionE2eEnabled,
		"A dedicated test database and explicitly selected test R2 bucket are required for texture persistence."
	);
	test.setTimeout(240_000);
	await signUpWithFixture(page, fixture);
	await page.goto("/context-proposals");
	await page.getByLabel("Project name").fill("Texture review project");
	await page.getByLabel("Art direction").fill("Seamless pixel surfaces");
	await page.getByRole("button", { name: "Create project" }).click();
	await page
		.getByRole("button", { name: "Visual Worlds and Themes", exact: true })
		.click();
	await page.getByLabel("Visual World name").fill("Texture world");
	await page.getByRole("button", { name: "Add Visual World" }).click();
	await expect(
		page.locator(".scope-record-list").getByText("Texture world")
	).toBeVisible();
	await page.goto("/projects");
	await page.getByRole("link", { name: "Asset Families" }).click();
	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Subject Identity name").fill("Grass surface");
	await page.getByRole("button", { name: "Create Subject Identity" }).click();
	await page
		.getByRole("button", { name: "Family catalog", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Grass surface" })
	).toBeVisible();
	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Asset Family name").fill("Grass textures");
	await page
		.getByLabel("Visual World")
		.selectOption({ label: "Texture world" });
	await page.getByLabel("Usage context").fill("Repeated terrain surface");
	await page.getByRole("button", { name: "Create Asset Family" }).click();
	await page
		.getByRole("button", { name: "Family catalog", exact: true })
		.click();
	await expect(
		page
			.getByRole("region", { name: "Saved Asset Families" })
			.getByRole("heading", { name: "Grass textures", exact: true })
	).toBeVisible();
	const familyUrl = page.url();
	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Independent product meaning", { exact: true }).check();
	await page.getByLabel("Asset Record name").fill("Grass texture");
	await page.getByRole("button", { name: "Add Asset Record" }).click();
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	await page.getByRole("link", { name: "Upload Asset Version" }).click();
	await page
		.getByRole("button", { name: "Record details", exact: true })
		.click();
	const metadataForm = page.getByRole("region", {
		name: "Asset Record metadata",
	});
	await expect(
		metadataForm.getByLabel("Visual World").locator("option:checked")
	).toHaveText("Texture world");
	await expect(metadataForm.getByLabel("Visual World")).toBeDisabled();
	await page.getByLabel("Asset category").selectOption({ label: profileLabel });
	await page.getByRole("button", { name: "Save metadata" }).click();
	await expect(page.getByText("Asset Record metadata saved.")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Save metadata" })
	).toBeEnabled();
	await expect(page.getByLabel("Asset category")).toHaveValue(
		"tileset_terrain_texture"
	);
	await page
		.getByRole("button", { name: "Versions and files", exact: true })
		.click();
	const file = {
		name: "grass.png",
		mimeType: "image/png",
		buffer: await readFile(
			new URL("./fixtures/texture-repetition.png", import.meta.url)
		),
	};
	await page.getByLabel("PNG or WebP file").setInputFiles(file);
	await page
		.getByLabel("Unknown production history")
		.fill("Browser texture fixture");
	await page
		.getByLabel("Known source", { exact: true })
		.fill("Authored fixture");
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
	await page.getByLabel("Unit type").selectOption("tile");
	await page.getByLabel("Unit name").fill("grass");
	await page
		.getByLabel("Source Asset Version")
		.selectOption({ label: "Version 1 · Candidate" });
	await page.getByLabel("Corrected PNG or WebP").setInputFiles(file);
	await page.getByRole("button", { name: "Save unit correction" }).click();
	await expect(
		page.getByText("grass · Unit Version 1", { exact: false })
	).toBeVisible();
	await page.goto(familyUrl);
	await page
		.getByRole("button", {
			name: "Version and dependency operations",
			exact: true,
		})
		.click();
	await activateFamilyProfile(
		page,
		"Tileset, terrain, and seamless texture",
		familyUrl,
		"1.0.0"
	);
	const review = page
		.getByRole("heading", { name: "Texture repetition · Grass textures" })
		.locator("..");
	await expect(review.getByRole("img")).toHaveCount(3);
	await expect(
		review.getByRole("button", { name: "Save texture review" })
	).toBeEnabled();
	// Use the same exact region, axes and shift on both product surfaces.
	await review
		.getByLabel("Atlas width")
		.fill(String(fixture.atlasRegion.width));
	await review
		.getByLabel("Atlas height")
		.fill(String(fixture.atlasRegion.height));
	await review.getByLabel("Repeat axes").selectOption("xy");
	await review.getByLabel("Shift X").fill(String(fixture.shiftedOffset.x));
	await review.getByLabel("Shift Y").fill(String(fixture.shiftedOffset.y));
	await review.getByLabel("Terrain ID").fill(fixture.terrainId);
	await review.getByLabel("Preview zoom").selectOption("8");
	await review.getByRole("button", { name: "Check exact edges" }).click();
	await expect(review.getByText("X edge: 0 mismatched pixels")).toBeVisible();
	for (const arrangement of ["2x2", "3x3", "shifted"]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser observations must be entered in order.
		await review.getByLabel(`${arrangement} outcome`).selectOption("passed");
		await review.getByLabel(`${arrangement} notes`).fill(fixture.notes);
	}
	const previews = await page.evaluate(readTexturePreviewPresentation);
	expect(previews).toHaveLength(3);
	expect(previews.every((preview) => preview.imageReady)).toBe(true);
	await review.getByRole("button", { name: "Save texture review" }).click();
	await expect(review.getByText("Texture review saved.")).toBeVisible();
	await review.getByRole("img").first().locator("xpath=../../..").screenshot({
		path: "../../.context/texture-repetition-browser.png",
	});
	await page.reload();
	await page
		.getByRole("button", { name: "Profile reviews", exact: true })
		.click();
	await expect(
		review.getByText(
			"shifted: passed — Uniform color repeats without a visible motif."
		)
	).toBeVisible();
	const downloadPromise = page.waitForEvent("download");
	await review
		.getByRole("button", { name: "Download texture metadata" })
		.click();
	const download = await downloadPromise;
	const path = await download.path();
	expect(path).toBeTruthy();
	const metadata = JSON.parse(await readFile(path ?? "", "utf8"));
	expect(metadata.tileset.terrain_id).toBe(fixture.terrainId);
	expect(metadata.tileset.tiles[0].atlas_region).toEqual(fixture.atlasRegion);
	expect(metadata.texture.repeat_axes).toEqual(fixture.repeatAxes);
	expect(metadata.record.shiftedOffset).toEqual(fixture.shiftedOffset);
	if (process.env.TEXTURE_REPETITION_WEB_RESULT) {
		await writeFile(
			process.env.TEXTURE_REPETITION_WEB_RESULT,
			JSON.stringify({
				familyPath: new URL(familyUrl).pathname,
				metadata,
				previews,
			})
		);
	}
});
