import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser } from "@wdio/globals";
import {
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "../e2e/asset-record-fixture";

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
			await (await $("h1=Dashboard")).waitForDisplayed();
			await (await $("a=Projects")).click();
			await (await $("input#project-name")).setValue(fixture.projectName);
			await (await $("textarea#project-art-direction")).setValue(
				fixture.generalArtDirection
			);
			await (await $("button=Proje oluştur")).click();

			const projectLink = await $(
				`a[aria-label="${fixture.projectName} varlık kayıtlarını aç"]`
			);
			await projectLink.waitForClickable();
			await projectLink.click();
			await (await $("input#asset-record-name")).setValue(fixture.name);
			await (await $("input[type='checkbox']")).click();
			await (await $("button=Varlık kaydı oluştur")).click();
			await (await $(`h1=${fixture.name}`)).waitForDisplayed();

			const uploadedPath = await browser.uploadFile(imagePath);
			await (await $("input#reference-upload-file")).setValue(uploadedPath);
			const forbiddenFeatures = await $(
				'//fieldset[legend[normalize-space()="Kaçınılacak özellikler"]]'
			);
			await (
				await forbiddenFeatures.$(
					'.//label[span[normalize-space()="Kimlik"]]/input'
				)
			).click();
			await (
				await $('//label[span[normalize-space()="Referans notu"]]/textarea')
			).setValue("Use the pose only.");
			await (await $("button=Görseli yükle")).click();
			await $("p*=Referans görseli panoya eklendi.").waitForDisplayed();

			let card = await $(
				'//article[.//img[@alt="walking-pose.png adlı referans görseli"]]'
			);
			await card.$("p*=Use the pose only.").waitForDisplayed();
			await (await card.$("summary=Kuralları düzenle")).click();
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
			await (await card.$("button=Kuralları kaydet")).click();
			await card
				.$("p*=Referans kuralları ve notu kaydedildi.")
				.waitForDisplayed();
			await (await card.$("summary=Kural geçmişi")).click();
			await card.$("p*=Revizyon 1").waitForDisplayed();
			await card.$("p*=Revizyon 2").waitForDisplayed();

			await browser.refresh();
			card = await $(
				'//article[.//img[@alt="walking-pose.png adlı referans görseli"]]'
			);
			await card.$("p*=Animation timing cue · Revizyon 2").waitForDisplayed();
			await card.$("summary=Kural geçmişi").click();
			await card.$("p*=Revizyon 1").waitForDisplayed();
			await card.$("p*=Revizyon 2").waitForDisplayed();
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
