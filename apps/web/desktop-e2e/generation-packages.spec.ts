import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import { projectContextFixture } from "../e2e/project-context-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Generation Packages", () => {
	it("blocks conflicting reference rules before pinning and rereading a resolved package in the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const fixture = createAssetRecordFixture();
		await (await $("a=Sign In")).waitForClickable();
		await (await $("a=Sign In")).click();
		await (await $("input[name='name']")).setValue(fixture.userName);
		await (await $("input[name='email']")).setValue(fixture.email);
		await (await $("input[name='password']")).setValue(fixture.password);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Game projects")).waitForDisplayed();

		await (await $("a=Context Proposals")).click();
		await (await $("h2=Create your first project")).waitForDisplayed();
		await (await $('//label[span[text()="Project name"]]/input')).setValue(
			fixture.projectName
		);
		await (await $('//label[span[text()="Art direction"]]/textarea')).setValue(
			fixture.generalArtDirection
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
		await $(`h3=${projectContextFixture.summary}`).waitForDisplayed();
		await (await $("button=Review proposal")).click();
		await $("h4=Activation summary · R1").waitForDisplayed();
		await (await $("button=Activate R1")).click();
		await $(
			"p=This proposal was saved as Active Context Revision R1."
		).waitForDisplayed();

		await (await $("a=Projeler")).click();

		const projectLink = await $(
			`a[aria-label="${fixture.projectName} varlık kayıtlarını aç"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();
		await openWorkspaceTask("New Asset Record");
		await (await $("input#asset-record-name")).setValue(fixture.name);
		await (await $("input[type='checkbox']")).click();
		await (await $("button=Create Asset Record")).click();
		await (await $(`h1=${fixture.name}`)).waitForDisplayed();

		const directory = mkdtempSync(
			join(tmpdir(), "generation-package-reference-e2e-")
		);
		const imagePath = join(directory, "conflicting-pose.png");
		writeFileSync(
			imagePath,
			Buffer.from(fixture.assetVersionPngBase64, "base64")
		);
		let uploadedPath = "";
		try {
			uploadedPath = await browser.uploadFile(imagePath);
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
		await openWorkspaceTask("Production and import");
		await $("input#reference-upload-file").setValue(uploadedPath);
		const forbiddenFeatures = await $(
			'//fieldset[legend[normalize-space()="Kaçınılacak özellikler"]]'
		);
		await (
			await forbiddenFeatures.$('.//label[span[normalize-space()="Poz"]]/input')
		).click();
		await (await $("button=Upload image")).click();
		await $("p*=Referans görseli panoya eklendi.").waitForDisplayed();

		const conflictAlert = await $(
			'//div[@role="alert" and .//h4[normalize-space()="Unresolved transfer conflicts"]]'
		);
		await conflictAlert.waitForDisplayed();
		await expect(conflictAlert).toHaveTextContaining("Poz");
		await expect(conflictAlert).toHaveTextContaining("conflicting-pose.png");

		await (await $("h2=Generation Packages")).waitForDisplayed();
		await expect(await $("input#generation-target-width")).toHaveValue("");
		await expect(await $("input#generation-target-height")).toHaveValue("");
		await (await $("textarea#generation-target-task")).setValue(
			"Create one four-frame attack animation."
		);
		await (await $("input#generation-target-width")).setValue("72");
		await (await $("input#generation-target-height")).setValue("80");
		await (await $("textarea#generation-expected-output")).setValue(
			"A four-frame PNG sprite sheet."
		);
		const pinPackageButton = await $("button=Pin Generation Package");
		await pinPackageButton.waitForClickable();
		await pinPackageButton.click();
		await $(
			"p*=Resolve allow and prohibit conflicts in the reference carryover rules before creating a Generation Package."
		).waitForDisplayed();
		await $(
			"p=This Asset Record has no Generation Packages yet."
		).waitForDisplayed();

		const referenceCard = await $(
			'//article[.//img[@alt="conflicting-pose.png adlı referans görseli"]]'
		);
		await (await referenceCard.$("summary=Edit rules")).click();
		const forbiddenReferenceFeatures = await referenceCard.$(
			'.//fieldset[legend[normalize-space()="Kaçınılacak özellikler"]]'
		);
		await (
			await forbiddenReferenceFeatures.$(
				'.//label[span[normalize-space()="Poz"]]/input'
			)
		).click();
		await (await referenceCard.$("button=Save rules")).click();
		await referenceCard
			.$("p=Reference rules and note saved.")
			.waitForDisplayed();
		await conflictAlert.waitForDisplayed({ reverse: true });

		await pinPackageButton.click();
		await $("p=Generation Package created and saved.").waitForDisplayed();

		const savedPackage = await $(
			"summary*=Create one four-frame attack animation."
		);
		await savedPackage.waitForDisplayed();
		await savedPackage.click();
		await $("h3=Production Context Snapshot").waitForDisplayed();
		await $(
			"p*=Readable silhouettes with restrained highlights"
		).waitForDisplayed();
		await $("p*=72 × 80 px").waitForDisplayed();
		await $("p=A four-frame PNG sprite sheet.").waitForDisplayed();
		const savedReferenceRule = await $("li*=conflicting-pose.png");
		await expect(await savedReferenceRule.getText()).toContain(
			"Aktarılabilir: Poz"
		);
		await expect(await savedReferenceRule.getText()).not.toContain(
			"Kaçınılacak: Poz"
		);

		await browser.refresh();
		await openWorkspaceTask("Production and import");
		const reloadedPackage = await $(
			"summary*=Create one four-frame attack animation."
		);
		await reloadedPackage.waitForDisplayed();
		await reloadedPackage.click();
		await $("h3=Production Context Snapshot").waitForDisplayed();
		await $(
			"p*=Readable silhouettes with restrained highlights"
		).waitForDisplayed();
		await $("p*=72 × 80 px").waitForDisplayed();
		await $("p=A four-frame PNG sprite sheet.").waitForDisplayed();
		const reloadedReferenceRule = await $("li*=conflicting-pose.png");
		await expect(await reloadedReferenceRule.getText()).toContain(
			"Aktarılabilir: Poz"
		);
		await expect(await reloadedReferenceRule.getText()).not.toContain(
			"Kaçınılacak: Poz"
		);
	});
});
