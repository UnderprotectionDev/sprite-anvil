import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser } from "@wdio/globals";
import {
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "../e2e/asset-record-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Reference Transfer Constraints", () => {
	it("persists the same reference rules and history in the desktop flow", async function () {
		const fixture = createAssetRecordFixture();
		if (!assetVersionE2eEnabled) {
			this.skip();
		}

		const directory = mkdtempSync(join(tmpdir(), "reference-production-e2e-"));
		const imagePath = join(directory, "walking-pose.png");
		writeFileSync(
			imagePath,
			Buffer.from(fixture.assetVersionPngBase64, "base64")
		);

		try {
			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("input[name='name']")).setValue(fixture.userName);
			await (await $("input[name='email']")).setValue(fixture.email);
			await (await $("input[name='password']")).setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			await (await $("h1=Projects")).waitForDisplayed();
			await (await $("a=Projects")).click();
			await openWorkspaceTask("New project");
			await (await $("input#project-name")).setValue(fixture.projectName);
			await (await $("textarea#project-art-direction")).setValue(
				fixture.generalArtDirection
			);
			await (await $("button=Create project")).click();

			const projectLink = await $(
				`a[aria-label="${fixture.projectName} open project"]`
			);
			await projectLink.waitForClickable();
			await projectLink.click();
			await openWorkspaceTask("New Asset Record");
			await (await $("input#asset-record-name")).setValue(fixture.name);
			await (await $("input[type='checkbox']")).click();
			await (await $("button=Create Asset Record")).click();
			await (await $(`h1=${fixture.name}`)).waitForDisplayed();

			const uploadedPath = await browser.uploadFile(imagePath);
			await openWorkspaceTask("Production and import");
			await (await $("input#reference-upload-file")).setValue(uploadedPath);
			const forbiddenFeatures = await $(
				'//fieldset[legend[normalize-space()="Avoided features"]]'
			);
			await (
				await forbiddenFeatures.$(
					'.//label[span[normalize-space()="Kimlik"]]/input'
				)
			).click();
			await (
				await $('//label[span[normalize-space()="Reference note"]]/textarea')
			).setValue("Use the pose only.");
			await (await $("button=Upload image")).click();
			await $("p*=Reference image added to the board.").waitForDisplayed();

			let card = await $(
				'//article[.//img[@alt="walking-pose.png reference"]]'
			);
			await card.$("p*=Use the pose only.").waitForDisplayed();
			await (await card.$("summary=Edit rules")).click();
			await (await card.$("select[id$='-role']")).selectByAttribute(
				"value",
				"custom"
			);
			await (await card.$("input[id$='-custom-purpose']")).setValue(
				"Animation timing cue"
			);
			await (await card.$("textarea[id$='-notes']")).setValue(
				"Timing cue only."
			);
			await (await card.$("button=Save rules")).click();
			await card.$("p*=Reference rules and note saved.").waitForDisplayed();
			await (await card.$("summary=Rule history")).click();
			await card.$("p*=Revision 1").waitForDisplayed();
			await card.$("p*=Revision 2").waitForDisplayed();

			await browser.refresh();
			await openWorkspaceTask("Production and import");
			card = await $('//article[.//img[@alt="walking-pose.png reference"]]');
			await card.$("p*=Animation timing cue · Revision 2").waitForDisplayed();
			await card.$("summary=Rule history").click();
			await card.$("p*=Revision 1").waitForDisplayed();
			await card.$("p*=Revision 2").waitForDisplayed();
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
