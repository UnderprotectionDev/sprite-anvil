import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { assetFamilyWorkspaceFixture as baseFixture } from "../e2e/asset-family-workspace-fixture";
import {
	activateFamilyProfile,
	openWorkspaceTask,
} from "./workspace-navigation";

const fixture = {
	...baseFixture,
	userName: "Background Layout Desktop",
	email: `background-desktop-${crypto.randomUUID()}@example.test`,
	projectName: "Forest Background Desktop",
	identityName: "Forest",
	familyName: "Forest Background",
	visualWorldName: "Forest",
	categoryLabel: "Backgrounds and parallax",
	records: [{ name: "Sky", uploadNote: "Desktop background fixture." }],
};

describe("Background Layer Layout", () => {
	it("saves a safe area and rereads the exact layout on the desktop surface", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-asset-family-comparison-")
		);
		const pngPath = join(directory, "asset-family-comparison.png");
		await writeFile(pngPath, fixture.png);

		try {
			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("button=Need an account? Sign Up")).click();
			await $("h2=Create Account").waitForDisplayed();
			await $("input[name='name']").setValue(fixture.userName);
			await $("input[name='email']").setValue(fixture.email);
			await $("input[name='password']").setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			// The first webview navigation after signup can be slow on a cold start.
			await $("h1=Game projects").waitForDisplayed({ timeout: 30_000 });

			await (await $("a=Context Proposals")).click();
			await $("//label[span[text()='Project name']]/input").setValue(
				fixture.projectName
			);
			await $("//label[span[text()='Art direction']]/textarea").setValue(
				fixture.generalArtDirection
			);
			await (await $("button=Create project")).click();
			await openWorkspaceTask("Visual Worlds and Themes");
			await $("input[placeholder='e.g. High plateaus']").setValue(
				fixture.visualWorldName
			);
			await (await $("button=Add Visual World")).click();
			await $(`strong=${fixture.visualWorldName}`).waitForDisplayed();

			await (await $("a=Projects")).click();
			await (await $("a=Asset Families")).click();
			await openWorkspaceTask("Family and representation relationships");
			await $("input[id='subject-identity-name']").setValue(
				fixture.identityName
			);
			await (await $("button=Create Subject Identity")).click();
			await openWorkspaceTask("Family catalog");
			await $(`h2=${fixture.identityName}`).waitForDisplayed();
			await openWorkspaceTask("Family and representation relationships");
			await $("input[id='asset-family-name']").setValue(fixture.familyName);
			await $("#asset-family-visual-world").selectByVisibleText(
				fixture.visualWorldName
			);
			await $("input[id='asset-family-use-context']").setValue(
				fixture.useContext
			);
			await (await $("button=Create Asset Family")).click();
			await openWorkspaceTask("Family catalog");
			await $(`h3=${fixture.familyName}`).waitForDisplayed();

			for (const record of fixture.records) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions within each record setup must occur in order.
				await openWorkspaceTask("Family and representation relationships");
				await $(
					"//label[contains(normalize-space(.), 'Independent product meaning')]/input"
				).click();
				await $("input[id='asset-record-name']").setValue(record.name);
				await (await $("button=Asset Record ekle")).click();
				await openWorkspaceTask("Version and dependency operations");
				const recordItem = await $(
					`//section[@aria-label='Version and dependency operations']//li[h4[normalize-space(.)='${record.name}']]`
				);
				await recordItem
					.$("p=No versions saved yet.")
					.waitForDisplayed({ timeout: 20_000 });

				await (await recordItem.$("a=Upload Asset Version")).click();
				await openWorkspaceTask("Record details");
				await $("#asset-record-metadata-category").selectByVisibleText(
					fixture.categoryLabel
				);
				await (await $("button=Save metadata")).click();
				await $("p=Asset Record metadata saved.").waitForDisplayed();

				await openWorkspaceTask("Versions and files");
				await $("#asset-version-file").setValue(pngPath);
				await $("#asset-version-missing-history").setValue(record.uploadNote);
				await $("#asset-version-source").setValue(
					"Background layer layout desktop fixture"
				);
				await $("#asset-version-relationship").selectByAttribute(
					"value",
					"created_by_user"
				);
				await (await $("button=Save Candidate Version")).click();
				await $("p=Candidate Version saved.").waitForDisplayed();

				await (await $("a=Asset Families")).click();
				await openWorkspaceTask("Version and dependency operations");
				await (
					await $(
						`//section[@aria-label='Version and dependency operations']//li[h4[normalize-space(.)='${record.name}']]`
					)
				)
					.$("p=Version 1 · Candidate")
					.waitForDisplayed({ timeout: 20_000 });
			}

			await activateFamilyProfile("Background and parallax", "1.0.1");

			const section =
				"//section[h3[normalize-space(.)='Background layer layout · Forest Background']]";
			let layout = await $(section);
			await layout.waitForDisplayed({ timeout: 20_000 });
			await layout
				.$("xpath=.//label[normalize-space(.)='Layer identity']/input")
				.setValue("sky");
			await layout
				.$(
					"xpath=.//label[contains(normalize-space(.), 'Exact version')]/select"
				)
				.selectByVisibleText("Sky · v1");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area X']/input")
				.setValue("24");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area width']/input")
				.setValue("16");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area Y']/input")
				.setValue("8");
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area height']/input")
				.setValue("16");
			await (await layout.$("button=Save layer layout")).click();
			const alert = await layout.$("p[role='alert']");
			await alert.waitForDisplayed();
			await expect(await alert.getText()).toBe(
				"Player safe area must remain inside the crop."
			);
			await layout
				.$("xpath=.//label[normalize-space(.)='Safe area X']/input")
				.setValue("8");
			await (await layout.$("button=Save layer layout")).click();
			await layout
				.$("p=Layer layout saved.")
				.waitForDisplayed({ timeout: 20_000 });
			await browser.refresh();
			await openWorkspaceTask("Profile reviews");
			layout = await $(section);
			await layout.$("p=sky · Sky · v1").waitForDisplayed({ timeout: 20_000 });
			await expect(
				await layout
					.$("p=Crop: 0, 0, 32 × 32 · Safe area: 8, 8, 16 × 16")
					.isDisplayed()
			).toBe(true);
			await expect(
				await layout
					.$("p=Actual scrolling test is still required.")
					.isDisplayed()
			).toBe(true);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
