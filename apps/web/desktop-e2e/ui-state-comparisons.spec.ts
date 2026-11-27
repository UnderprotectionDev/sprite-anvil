import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uiComponentStates } from "@sprite-anvil/api/ui-state-comparisons";
import { $, browser, expect } from "@wdio/globals";
import { uiStateComparisonFixture as fixture } from "../e2e/ui-state-comparison-fixture";
import {
	activateFamilyProfile,
	openWorkspaceTask,
} from "./workspace-navigation";

describe("UI State Comparison", () => {
	it("persists and reopens a UI screen and state comparison on the desktop surface", async function () {
		this.timeout(240_000);
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
				const criterion = await $(
					"//label[contains(normalize-space(.), 'Independent product meaning')]/input"
				);
				if (!(await criterion.isSelected())) {
					await criterion.click();
				}
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

			await activateFamilyProfile("UI screen and component", "1.0.0");
			const comparison = await $(
				`//section[h3[normalize-space(.)='${fixture.familyName} · Compare Screen and Component States']]`
			);
			await comparison.waitForDisplayed();
			await comparison.$("input[id$='-name']").setValue("Inventory controls");
			await comparison
				.$("select[id$='-screen']")
				.selectByVisibleText("Inventory screen · Version 1");
			for (let index = 2; index < 9; index += 1) {
				// biome-ignore lint/performance/noAwaitInLoops: Add native form rows sequentially.
				await comparison.$("button=Add component state").click();
			}
			const components = [
				...uiComponentStates.map((state) => ({
					identity: "inventory-button",
					kind: "button",
					state,
					version: "Inventory button states",
				})),
				{
					identity: "inventory-panel",
					kind: "panel",
					state: "normal",
					version: "Inventory panel",
				},
				{
					identity: "inventory-slot",
					kind: "item_slot",
					state: "normal",
					version: "Inventory item slot",
				},
			];
			const rows = await comparison.$$("fieldset fieldset.min-w-0");
			for (const [index, component] of components.entries()) {
				const row = rows[index];
				if (!row) {
					throw new Error("Missing component state row.");
				}
				// biome-ignore lint/performance/noAwaitInLoops: Native state fields are filled sequentially.
				await row.$("input[id$='-identity']").setValue(component.identity);
				await row
					.$("select[id$='-kind']")
					.selectByAttribute("value", component.kind);
				await row
					.$("select[id$='-version']")
					.selectByVisibleText(`${component.version} · Version 1`);
				await row
					.$("select[id$='-state']")
					.selectByAttribute("value", component.state);
			}
			await comparison
				.$("textarea[id$='-family-notes']")
				.setValue("Consistent inventory borders.");
			await comparison
				.$("textarea[id$='-state-notes']")
				.setValue("All seven button states remain explicitly mapped.");
			await comparison.$("button=Save comparison").click();
			await comparison
				.$("p=Comparison verified from persistent storage.")
				.waitForDisplayed();
			await browser.refresh();
			await openWorkspaceTask("Profile reviews");
			await $("h5=Inventory controls").waitForDisplayed();
			await $("p=Consistent inventory borders.").waitForDisplayed();
			await $("summary=Show comparison details").click();
			await expect(
				await $("img[alt='inventory-button · Button · Disabled']")
			).toBeDisplayed();
			await expect(
				await $("img[alt='inventory-panel · Panel · Normal']")
			).toBeDisplayed();
			await expect(
				await $("img[alt='inventory-slot · Item slot · Normal']")
			).toBeDisplayed();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
