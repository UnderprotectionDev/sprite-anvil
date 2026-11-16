import { $, browser, expect } from "@wdio/globals";
import { projectContextFixture } from "../e2e/project-context-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Project Context proposals", () => {
	it("persists the same structured proposal from the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const signInLink = await $("a=Sign In");
		await signInLink.waitForClickable();
		await signInLink.click();
		await (await $("input[name='name']")).setValue(
			projectContextFixture.userName
		);
		await (await $("input[name='email']")).setValue(
			projectContextFixture.email
		);
		await (await $("input[name='password']")).setValue(
			projectContextFixture.password
		);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Game projects")).waitForDisplayed();

		await (await $("a=Context Proposals")).click();
		await (await $("h2=Create your first project")).waitForDisplayed();
		await (await $('//label[span[text()="Project name"]]/input')).setValue(
			projectContextFixture.projectName
		);
		await (await $('//label[span[text()="Art direction"]]/textarea')).setValue(
			projectContextFixture.generalArtDirection
		);
		await (await $("button=Create project")).click();
		await openWorkspaceTask("Visual Worlds and Themes");
		await (await $('//label[span[text()="Visual World name"]]/input')).setValue(
			"Sunken coast"
		);
		await (await $("button=Add Visual World")).click();
		await (await $("strong=Sunken coast")).waitForDisplayed();
		await (await $('//label[span[text()="Theme name"]]/input')).setValue(
			"Blue lanterns"
		);
		await (await $("button=Add Theme")).click();
		await (await $("strong=Blue lanterns")).waitForDisplayed();

		await openWorkspaceTask("Propose a rule change");
		const operation = await $('select[aria-label="Change 1 operation"]');
		await expect(await operation.$('option[value="replace"]')).toBeDisabled();
		await expect(await operation.$('option[value="remove"]')).toBeDisabled();
		await openWorkspaceTask("Propose a rule change");
		await (await $('select[aria-label="Change 1 scope"]')).selectByVisibleText(
			"Theme · Sunken coast / Blue lanterns"
		);

		await (await $('input[maxlength="240"]')).setValue(
			projectContextFixture.summary
		);
		await (await $('select[aria-label="Change 1 rule"]')).selectByAttribute(
			"value",
			projectContextFixture.ruleId
		);
		await (await $('input[aria-label="Change 1 rule value"]')).setValue(
			projectContextFixture.value
		);
		await (await $('textarea[maxlength="2000"]')).setValue(
			projectContextFixture.rationale
		);
		await (await $('//label[span[text()="Evidence"]]/textarea')).setValue(
			projectContextFixture.evidence
		);
		await (await $("button=Save Context Proposal")).click();
		await openWorkspaceTask("Review proposals");

		const savedProposal = await $(`h3=${projectContextFixture.summary}`);
		await savedProposal.waitForDisplayed();
		await expect(await $("p=Proposed value: 1.5")).toBeDisplayed();
		await (await $("button=Review proposal")).click();
		await $("h4=Activation summary · R1").waitForDisplayed();
		await expect(
			await $(
				"p=Precedence: Theme · Sunken coast / Blue lanterns → Visual World · Sunken coast → Project · " +
					projectContextFixture.projectName
			)
		).toBeDisplayed();
		await expect(await $("span=Ready to activate")).toBeDisplayed();
		await (await $("button=Activate R1")).click();
		await $(
			"p=This proposal was saved as Active Context Revision R1."
		).waitForDisplayed();
		await $("h4=Active revision · R1").waitForDisplayed();
		await expect(await $("button=Activate R1")).not.toBeDisplayed();
		await browser.refresh();
		await $(`h3=${projectContextFixture.summary}`).waitForDisplayed();
		await expect(await $("p=Proposed value: 1.5")).toBeDisplayed();
		await expect(await $("span=Active")).toBeDisplayed();
	});
});
