import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { assetVersionFixture as fixture } from "../e2e/asset-version-fixture";
import {
	activateFamilyProfile,
	openWorkspaceTask,
	uploadFamilyCandidate,
} from "./workspace-navigation";

describe("Directional Review", () => {
	it("saves and reopens a four-direction review in the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-directional-review-")
		);
		const pngPath = join(directory, "ash-knight.png");
		await writeFile(pngPath, fixture.png);

		try {
			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("button=Need an account? Sign Up")).click();
			await (await $("h2=Create Account")).waitForDisplayed();
			await (await $("input[name='name']")).setValue(fixture.userName);
			await (await $("input[name='email']")).setValue(fixture.email);
			await (await $("input[name='password']")).setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			await (await $("h1=Game projects")).waitForDisplayed();

			await (await $("a=Context Proposals")).click();
			await (await $('//label[span[text()="Project name"]]/input')).setValue(
				fixture.projectName
			);
			await (
				await $('//label[span[text()="Art direction"]]/textarea')
			).setValue(fixture.generalArtDirection);
			await (await $("button=Create project")).click();
			await openWorkspaceTask("Visual Worlds and Themes");
			await (await $("input[placeholder='e.g. High plateaus']")).setValue(
				fixture.visualWorldName
			);
			await (await $("button=Add Visual World")).click();
			await (await $(`strong=${fixture.visualWorldName}`)).waitForDisplayed();

			await (await $("a=Projects")).click();
			await (await $("a=Asset Families")).click();
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='subject-identity-name']")).setValue(
				fixture.identityName
			);
			await (await $("button=Create Subject Identity")).click();
			await openWorkspaceTask("Family catalog");
			await (await $(`h2=${fixture.identityName}`)).waitForDisplayed();
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='asset-family-name']")).setValue(
				fixture.familyName
			);
			await (await $("#asset-family-visual-world")).selectByVisibleText(
				fixture.visualWorldName
			);
			await (await $("input[id='asset-family-use-context']")).setValue(
				fixture.useContext
			);
			await (await $("button=Create Asset Family")).click();
			await openWorkspaceTask("Family catalog");
			await (await $(`h3=${fixture.familyName}`)).waitForDisplayed();

			// Without the character profile activation the character review
			// section must not offer guidance on this family.
			await (
				await $(
					`section[aria-label='${fixture.familyName} identity and direction review']`
				)
			).waitForDisplayed({ reverse: true, timeout: 20_000 });

			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='asset-record-name']")).setValue(
				fixture.sourceName
			);
			await (await $("button=Add Asset Record")).click();
			await openWorkspaceTask("Version and dependency operations");
			await uploadFamilyCandidate(fixture.sourceName, pngPath);
			await (await $("p=Version 1 · Candidate")).waitForDisplayed();
			const reviewRationale = "The silhouette matches the family design.";
			await (await $("textarea[id^='review-rationale-']")).setValue(
				reviewRationale
			);
			await (await $("button=Approve")).click();
			await (await $("p=Version 1 · Approved")).waitForDisplayed();
			await (await $("button=Select as Canonical Design")).click();
			await $(
				"p=Canonical Design: Ash Knight base · Version 1"
			).waitForDisplayed();

			await activateFamilyProfile(
				"Character, creature, and animation",
				"1.0.1"
			);

			let review = await $(
				`section[aria-label='${fixture.familyName} identity and direction review']`
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			const versionLabel = `${fixture.sourceName} · Version 1`;
			for (const index of [1, 2, 3, 4]) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions must occur in order.
				await (
					await review.$(
						`select[aria-label='Direction ${index} frame 1 version']`
					)
				).selectByVisibleText(versionLabel);
			}
			await (await review.$("button=Add frame")).click();
			await (
				await review.$("input[aria-label='Direction 1 frame 2 duration (ms)']")
			).setValue("250");
			const playhead = await review.$(
				"input[aria-label='Playback position (ms)']"
			);
			await playhead.setValue("150");
			await expect(playhead).toHaveValue("150");
			for (const [label, observation] of [
				["Silhouette", "Same outline"],
				["Proportions", "Same proportions"],
				["Equipment side", "Right"],
				["Palette", "Gray"],
				["Perspective", "Side"],
				["Scale", "Native pixels"],
				["Ground contact", "Needs follow-up"],
			] as const) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions must occur in order.
				await (await review.$(`textarea[aria-label='${label}']`)).setValue(
					observation
				);
			}
			await (await review.$("textarea[aria-label='Rationale']")).setValue(
				"Four directions inspected on the desktop surface"
			);
			await (await review.$("button=Save review")).click();
			await (
				await review.$("p=Review verified from the saved record.")
			).waitForDisplayed();

			await browser.refresh();
			await openWorkspaceTask("Profile reviews");
			review = await $(
				`section[aria-label='${fixture.familyName} identity and direction review']`
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			await (
				await review.$(
					'xpath=.//button[contains(normalize-space(.), "4 directions · Needs follow-up")]'
				)
			).click();
			await expect(
				await review.$("textarea[aria-label='Rationale']")
			).toHaveValue("Four directions inspected on the desktop surface");
			await expect(
				await review.$("input[aria-label='Direction 1 frame 2 duration (ms)']")
			).toHaveValue("250");
			await expect(await review.$("button=Save review")).toBeDisabled();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
