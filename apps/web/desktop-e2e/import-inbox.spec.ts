import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import {
	sourceMetadataMappingFixture,
	sourceMetadataMappingFixtureHash,
} from "../e2e/source-metadata-mapping-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Source Metadata Mapping Proposals", () => {
	it("creates and rereads the same source-backed proposal through the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const fixture = createAssetRecordFixture();
		const directory = mkdtempSync(
			join(tmpdir(), "source-metadata-mapping-desktop-")
		);
		const sourcePath = join(
			directory,
			sourceMetadataMappingFixture.source.fileName
		);
		const asepritePath = join(
			directory,
			sourceMetadataMappingFixture.aseprite.fileName
		);
		const texturePackerPath = join(
			directory,
			sourceMetadataMappingFixture.texturePacker.fileName
		);
		writeFileSync(sourcePath, sourceMetadataMappingFixture.source.bytes);
		writeFileSync(asepritePath, sourceMetadataMappingFixture.aseprite.bytes);
		writeFileSync(
			texturePackerPath,
			sourceMetadataMappingFixture.texturePacker.bytes
		);

		try {
			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("input[name='name']")).setValue(fixture.userName);
			await (await $("input[name='email']")).setValue(fixture.email);
			await (await $("input[name='password']")).setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			await (await $("h1=Game projects")).waitForDisplayed();

			const visualWorldName = `${fixture.name} world`;
			const identityName = `${fixture.name} identity`;
			const familyName = `${fixture.name} family`;
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
				visualWorldName
			);
			await (await $("button=Add Visual World")).click();
			await (await $(`strong=${visualWorldName}`)).waitForDisplayed();
			await (await $("a=Projects")).click();
			await (await $("a=Asset Families")).click();
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='subject-identity-name']")).setValue(
				identityName
			);
			await (await $("button=Create Subject Identity")).click();
			await openWorkspaceTask("Family catalog");
			await (await $(`h2=${identityName}`)).waitForDisplayed();
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='asset-family-name']")).setValue(familyName);
			await (await $("#asset-family-visual-world")).selectByVisibleText(
				visualWorldName
			);
			await (await $("input[id='asset-family-use-context']")).setValue(
				"Walking animation"
			);
			await (await $("button=Create Asset Family")).click();
			await openWorkspaceTask("Family catalog");
			await (await $(`h3=${familyName}`)).waitForDisplayed();
			await openWorkspaceTask("Family and representation relationships");
			await (await $("input[id='asset-record-name']")).setValue(fixture.name);
			await (await $("button=Add Asset Record")).click();
			await openWorkspaceTask("Version and dependency operations");
			await (await $("a=Projects")).click();
			const projectLink = await $(
				`a[aria-label="${fixture.projectName} open Asset Records"]`
			);
			await projectLink.waitForClickable();
			await projectLink.click();
			await (await $("a=Import Inbox")).click();

			const uploadedPaths = await Promise.all(
				[sourcePath, asepritePath, texturePackerPath].map((path) =>
					browser.uploadFile(path)
				)
			);
			await (await $("input#import-inbox-files")).setValue(
				uploadedPaths.join("\n")
			);
			await (await $("button=Add files to Import Inbox")).click();
			await openWorkspaceTask("Bekleyen dosyalar");

			const sourcePanel = await $(
				`section[aria-label="Source Metadata Mapping Proposal for ${sourceMetadataMappingFixture.source.fileName}"]`
			);
			await sourcePanel.waitForDisplayed();
			await (
				await sourcePanel.$(
					`label*=${sourceMetadataMappingFixture.aseprite.fileName}`
				)
			).click();
			await (
				await sourcePanel.$(
					`label*=${sourceMetadataMappingFixture.texturePacker.fileName}`
				)
			).click();
			await (
				await sourcePanel.$("button*=Create Source Metadata Mapping Proposal")
			).click();

			const proposal = await $("summary*=Source Metadata Mapping Proposal");
			await proposal.waitForDisplayed();
			await proposal.click();
			await $(
				"p*=field conflicts; the proposal is not finalized."
			).waitForDisplayed();
			await $("dd=source-metadata-mapping/1.1.0").waitForDisplayed();
			await $(
				`dd=${sourceMetadataMappingFixtureHash(sourceMetadataMappingFixture.source.bytes)}`
			).waitForDisplayed();
			await $(
				`dd=${sourceMetadataMappingFixtureHash(sourceMetadataMappingFixture.aseprite.bytes)}`
			).waitForDisplayed();
			await $(
				`dd=${sourceMetadataMappingFixtureHash(sourceMetadataMappingFixture.texturePacker.bytes)}`
			).waitForDisplayed();
			await $(
				"li=Asset Family link: Unknown · no source evidence."
			).waitForDisplayed();
			await $(
				"li=Required Set link: Unknown · no source evidence."
			).waitForDisplayed();
			await $(
				"p=Gameplay Metadata: Unknown · project context required."
			).waitForDisplayed();
			await $("p=Pivot · walk-0").waitForDisplayed();
			await $("p=Tag · walk").waitForDisplayed();
			await $("p=Duration · walk-0").waitForDisplayed();
			const finalization = await $('section[aria-label="Finalize mapping"]');
			await finalization.waitForDisplayed();
			const selects = await finalization.$$("label select");
			await selects[0]?.selectByVisibleText(fixture.name);
			const finalizeButton = await finalization.$(
				"button*=Finalize mapping and create Candidate Version"
			);
			expect(await finalizeButton.isEnabled()).toBe(false);
			await selects[1]?.selectByIndex(1);
			await finalizeButton.click();
			await $(
				"p=Confirmed link · Candidate Version created"
			).waitForDisplayed();
			await $("li=Pivot · walk-0: Bilinmiyor").waitForDisplayed();

			await browser.refresh();
			await openWorkspaceTask("Bekleyen dosyalar");
			const rereadProposal = await $(
				"summary*=Source Metadata Mapping Proposal"
			);
			await rereadProposal.waitForDisplayed();
			await rereadProposal.click();
			await $(
				"p=Confirmed link · Candidate Version created"
			).waitForDisplayed();
			await $(
				"p=Gameplay Metadata: Unknown · project context required."
			).waitForDisplayed();
			await $("p=Pivot · walk-0").waitForDisplayed();
			await $("p=Duration · walk-0").waitForDisplayed();
			await (await $("a=Open Candidate Version")).click();
			await $(
				`p=${sourceMetadataMappingFixture.source.fileName} · Version 1 · Candidate`
			).waitForDisplayed();
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
