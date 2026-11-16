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
	userName: "UI Stretch Desktop",
	email: `ui-stretch-desktop-${crypto.randomUUID()}@example.test`,
	projectName: "Inventory UI Desktop",
	identityName: "Inventory panel",
	familyName: "Inventory panels",
	visualWorldName: "Forest",
	categoryLabel: "UI screens and components",
	records: [
		{ name: "Normal panel", uploadNote: "Desktop background fixture." },
	],
};

describe("UI Stretch Test", () => {
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
			await $(
				"//label[span[text()='General art direction']]/textarea"
			).setValue(fixture.generalArtDirection);
			await (await $("button=Create project")).click();
			await openWorkspaceTask("Visual Worldlar ve Temalar");
			await $("input[placeholder='e.g. High plateaus']").setValue(
				fixture.visualWorldName
			);
			await (await $("button=Visual World ekle")).click();
			await $(`strong=${fixture.visualWorldName}`).waitForDisplayed();

			await (await $("a=Projeler")).click();
			await (await $("a=Asset Families")).click();
			await openWorkspaceTask("Family and representation relationships");
			await $("input[id='subject-identity-name']").setValue(
				fixture.identityName
			);
			await (await $("button=Asset Identity oluştur")).click();
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

				await (await recordItem.$("a=Asset Version yükle")).click();
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

			await activateFamilyProfile("UI screen and component", "1.0.0");

			const section =
				"//section[h3[normalize-space(.)='UI stretch and text test · Inventory panels']]";
			let manager = await $(section);
			await manager.waitForDisplayed({ timeout: 20_000 });
			await manager
				.$("xpath=.//label[normalize-space(.)='Component identity']/input")
				.setValue("panel");
			await manager
				.$("xpath=.//label[normalize-space(.)='State identity']/input")
				.setValue("normal");
			await manager
				.$(
					"xpath=.//label[contains(normalize-space(.), 'Exact version')]/select"
				)
				.selectByVisibleText("Normal panel · v1");
			for (const [label, value] of [
				["Left margin", "4"],
				["Right margin", "6"],
				["Top margin", "3"],
				["Bottom margin", "5"],
				["Text area X", "6"],
				["Text area Y", "5"],
				["Text area width", "18"],
				["Text area height", "12"],
				["Target width", "64"],
				["Target height", "40"],
			] as const) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop form edits must occur sequentially.
				await manager
					.$(`xpath=.//label[normalize-space(.)='${label}']/input`)
					.setValue(value);
			}
			await manager
				.$("svg[aria-label='panel normal at 64 × 40 px']")
				.waitForDisplayed();
			await manager
				.$("xpath=.//label[contains(normalize-space(.),'Test result')]/select")
				.selectByAttribute("value", "passed");
			await manager
				.$("xpath=.//label[normalize-space(.)='Observation']/textarea")
				.setValue("Corners and text inspected on desktop.");
			await manager.$("button=Save stretch test").click();
			await manager
				.$("p=Stretch test saved.")
				.waitForDisplayed({ timeout: 20_000 });
			await browser.refresh();
			await openWorkspaceTask("Profile reviews");
			manager = await $(section);
			await manager
				.$("p=panel · normal · 64 × 40 px · passed · geometry passed")
				.waitForDisplayed({ timeout: 20_000 });
			await manager.$("summary=View saved test").click();
			await expect(
				await manager
					.$(
						"p=Margins: left 4, right 6, top 3, bottom 5 · Text area: 6, 5, 18 × 12 px"
					)
					.isDisplayed()
			).toBe(true);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
