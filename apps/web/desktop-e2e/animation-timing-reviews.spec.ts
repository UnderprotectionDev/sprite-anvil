import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { animationTimingFixture as fixture } from "../e2e/animation-timing-review-fixture";
import {
	activateFamilyProfile,
	openWorkspaceTask,
	uploadFamilyCandidate,
} from "./workspace-navigation";

describe("Animation Timing and Transition Review", () => {
	it("compares and reopens variable timing on the desktop surface", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-animation-timing-review-")
		);
		const pngPath = join(directory, "animation-timing-sprite.png");
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
			await $("h1=Projects").waitForDisplayed();

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

			await openWorkspaceTask("Family and representation relationships");
			await $("input[id='asset-record-name']").setValue(fixture.sourceName);
			await (await $("button=Add Asset Record")).click();
			await openWorkspaceTask("Version and dependency operations");
			await uploadFamilyCandidate(fixture.sourceName, pngPath);
			await $("p=Version 1 · Candidate").waitForDisplayed();
			await $("textarea[id^='review-rationale-']").setValue(
				"The sprite is suitable for timing review."
			);
			await (await $("button=Approve")).click();
			await $("p=Version 1 · Approved").waitForDisplayed();
			await (await $("button=Select as Canonical Design")).click();
			await $(
				`p=Canonical Design: ${fixture.sourceName} · Version 1`
			).waitForDisplayed();

			await activateFamilyProfile(
				"Character, creature, and animation",
				"1.0.1"
			);

			let review = await $(
				"section[aria-label='" +
					fixture.familyName +
					" animation timing review']"
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			const directionNames = ["south", "west", "north", "east"];
			const firstDurations = [80, 120, 100, 70];
			const firstPhases = ["Contact", "Wind-up", "Contact", "Lift"];
			const secondDurations = [220, 280, 200, 300];
			const secondPhases = ["Recovery", "Impact", "Recovery", ""];
			const directions = await review.$$("fieldset");
			for (let index = 0; index < directionNames.length; index += 1) {
				const direction = directions[index];
				if (!direction) {
					throw new Error("Expected four direction editors.");
				}
				const number = index + 1;
				const firstKey = `Direction ${number} frame 1`;
				const secondKey = `Direction ${number} frame 2`;
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions within each direction must occur in order.
				await direction
					.$(`input[aria-label='${firstKey} ID']`)
					.setValue(`${directionNames[index]}-contact`);
				await direction
					.$(`select[aria-label='${firstKey} version']`)
					.selectByVisibleText(`${fixture.sourceName} · Version 1`);
				await direction
					.$(`input[aria-label='${firstKey} duration (ms)']`)
					.setValue(String(firstDurations[index]));
				await direction
					.$(`input[aria-label='${firstKey} motion phase']`)
					.setValue(firstPhases[index] ?? "");
				await (await direction.$("button=Add frame")).click();
				await direction
					.$(`input[aria-label='${secondKey} ID']`)
					.setValue(`${directionNames[index]}-recovery`);
				await direction
					.$(`select[aria-label='${secondKey} version']`)
					.selectByVisibleText(`${fixture.sourceName} · Version 1`);
				await direction
					.$(`input[aria-label='${secondKey} duration (ms)']`)
					.setValue(String(secondDurations[index]));
				await direction
					.$(`input[aria-label='${secondKey} motion phase']`)
					.setValue(secondPhases[index] ?? "");
			}

			const [, , north] = directions;
			if (!north) {
				throw new Error("Expected the north direction editor.");
			}
			const moveUpButtons = await north.$$("button=Move frame up");
			const [, moveSecondFrameUp] = moveUpButtons;
			if (!moveSecondFrameUp) {
				throw new Error("Expected the second-frame reorder control.");
			}
			await moveSecondFrameUp.click();
			await review.$("input[aria-label='Playback speed']").setValue("2");
			const playhead = await review.$(
				"input[aria-label='Playback position (ms)']"
			);
			await playhead.setValue("110");
			await expect(await playhead.getValue()).toBe("110");
			await expect(await directions[0]?.$("figure").getText()).toContain(
				"south · Frame 2 · south-recovery · 220 ms · Recovery"
			);
			await expect(await directions[1]?.$("figure").getText()).toContain(
				"west · Frame 1 · west-contact · 120 ms · Wind-up"
			);
			await expect(await directions[2]?.$("figure").getText()).toContain(
				"north · Frame 1 · north-recovery · 200 ms · Recovery"
			);

			await playhead.setValue("310");
			const looping = await review.$("input[aria-label='Loop playback']");
			await looping.click();
			await expect(await looping.isSelected()).toBe(false);
			await expect(await directions[0]?.$("figure").getText()).toContain(
				"south · Frame 2 · south-recovery · 220 ms · Recovery"
			);
			await expect(await directions[0]?.getText()).not.toContain(
				"Loop boundary."
			);
			await looping.click();
			await expect(await looping.isSelected()).toBe(true);
			await expect(await directions[0]?.$("figure").getText()).toContain(
				"south · Frame 1 · south-contact · 80 ms · Contact"
			);
			await expect(await directions[0]?.getText()).toContain("Loop boundary.");

			await (await review.$("button=Restart")).click();
			await expect(await playhead.getValue()).toBe("0");
			await review
				.$("input[aria-label='Animation name']")
				.setValue("Walk cycle");
			await (
				await review.$("input[aria-label='Review result']")
			).selectByAttribute("value", "needs_follow_up");
			await review
				.$("textarea[aria-label='Rationale']")
				.setValue(
					"The directions reach their recovery frames at different times."
				);
			await (await review.$("button=Save review")).click();
			await review
				.$("p=Review verified from the saved record.")
				.waitForDisplayed();

			await browser.refresh();
			await openWorkspaceTask("Profile reviews");
			review = await $(
				"section[aria-label='" +
					fixture.familyName +
					" animation timing review']"
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			await (
				await review.$(
					"xpath=.//button[contains(normalize-space(.), 'Walk cycle · 4 directions · Needs follow-up')]"
				)
			).click();
			await expect(
				await review
					.$("input[aria-label='Direction 1 frame 2 duration (ms)']")
					.getValue()
			).toBe("220");
			await expect(
				await review.$("input[aria-label='Direction 3 frame 1 ID']").getValue()
			).toBe("north-recovery");
			await expect(
				await review
					.$("input[aria-label='Direction 4 frame 2 motion phase']")
					.getValue()
			).toBe("");
			await expect(
				await review.$("textarea[aria-label='Rationale']").getValue()
			).toBe("The directions reach their recovery frames at different times.");
			await expect(
				await review.$("input[aria-label='Playback speed']").getValue()
			).toBe("2");
			await expect(await review.$("button=Save review").isEnabled()).toBe(
				false
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
