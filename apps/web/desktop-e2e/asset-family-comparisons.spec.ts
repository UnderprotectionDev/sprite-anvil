import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { assetFamilyComparisonFixture as fixture } from "../e2e/asset-family-comparison-fixture";
import {
	activateFamilyProfile,
	openWorkspaceTask,
} from "./workspace-navigation";

describe("Asset Family Comparison", () => {
	it("persists and reopens a state and direction comparison on the desktop surface", async function () {
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
			await $("h1=Projects").waitForDisplayed({ timeout: 30_000 });

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
				await $("input[id='asset-record-name']").setValue(record.name);
				await (await $("button=Add Asset Record")).click();
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
					"Asset family comparison desktop fixture"
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

			await activateFamilyProfile(
				"Object, weapon, equipment, and state",
				"1.0.0"
			);

			const section = `section[aria-label='${fixture.familyName} state and direction family comparison']`;
			let comparison = await $(section);
			await comparison.waitForDisplayed({ timeout: 20_000 });
			await (
				await comparison.$(
					"xpath=.//label[contains(normalize-space(.), 'Kapalı sandık')]//input[@type='checkbox']"
				)
			).click();
			await (
				await comparison.$(
					"xpath=.//label[contains(normalize-space(.), 'Açık sandık')]//input[@type='checkbox']"
				)
			).click();
			await comparison
				.$("textarea[aria-label='Scale observation']")
				.setValue("Her iki sandık aynı ızgara ölçeğini kullanıyor.");
			await comparison
				.$("textarea[aria-label='Perspective observation']")
				.setValue("Perspektif tutarlı.");
			await comparison
				.$("textarea[aria-label='Material language observation']")
				.setValue("Malzeme dili aynı ahşap.");
			await comparison
				.$("textarea[aria-label='State and direction distinction observation']")
				.setValue("Kapalı ve açık durumlar net ayrışıyor.");
			await (await comparison.$("button=Save comparison")).click();
			await comparison
				.$("p=Comparison verified from the saved record.")
				.waitForDisplayed({ timeout: 20_000 });

			await browser.refresh();
			await openWorkspaceTask("Profile reviews");
			comparison = await $(section);
			await comparison.waitForDisplayed({ timeout: 20_000 });
			await (
				await comparison.$(
					"xpath=.//button[contains(normalize-space(.), '2 Asset Version')]"
				)
			).click();
			await comparison
				.$("h4=Kapalı sandık · Asset Version 1")
				.waitForDisplayed({ timeout: 20_000 });
			await comparison
				.$("h4=Açık sandık · Asset Version 1")
				.waitForDisplayed({ timeout: 20_000 });
			await expect(
				await comparison
					.$("dd=Her iki sandık aynı ızgara ölçeğini kullanıyor.")
					.isDisplayed()
			).toBe(true);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
