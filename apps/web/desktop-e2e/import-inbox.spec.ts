import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import {
	sourceMetadataMappingFixture,
	sourceMetadataMappingFixtureHash,
} from "../e2e/source-metadata-mapping-fixture";

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
			await (await $("h1=Dashboard")).waitForDisplayed();

			const visualWorldName = `${fixture.name} world`;
			const identityName = `${fixture.name} identity`;
			const familyName = `${fixture.name} family`;
			await (await $("a=Proje Bağlamı")).click();
			await (await $('//label[span[text()="Proje adı"]]/input')).setValue(
				fixture.projectName
			);
			await (
				await $('//label[span[text()="Genel sanat yaklaşımı"]]/textarea')
			).setValue(fixture.generalArtDirection);
			await (await $("button=Projeyi oluştur")).click();
			await (await $("input[placeholder='Örn. Yüksek yaylalar']")).setValue(
				visualWorldName
			);
			await (await $("button=Görsel Dünya ekle")).click();
			await (await $(`strong=${visualWorldName}`)).waitForDisplayed();
			await (await $("a=Projects")).click();
			await (await $("a=Varlık Aileleri")).click();
			await (await $("input[id='subject-identity-name']")).setValue(
				identityName
			);
			await (await $("button=Varlık Kimliği oluştur")).click();
			await (await $(`h2=${identityName}`)).waitForDisplayed();
			await (await $("input[id='asset-family-name']")).setValue(familyName);
			await (await $("#asset-family-visual-world")).selectByVisibleText(
				visualWorldName
			);
			await (await $("input[id='asset-family-use-context']")).setValue(
				"Walking animation"
			);
			await (await $("button=Varlık Ailesi oluştur")).click();
			await (await $(`h3=${familyName}`)).waitForDisplayed();
			await (await $("input[id='asset-record-name']")).setValue(fixture.name);
			await (await $("button=Varlık Kaydı ekle")).click();
			await (await $("a=Projects")).click();
			const projectLink = await $(
				`a[aria-label="${fixture.projectName} varlık kayıtlarını aç"]`
			);
			await projectLink.waitForClickable();
			await projectLink.click();
			await (await $("a=İçe Aktarma Gelen Kutusu")).click();

			const uploadedPaths = await Promise.all(
				[sourcePath, asepritePath, texturePackerPath].map((path) =>
					browser.uploadFile(path)
				)
			);
			await (await $("input#import-inbox-files")).setValue(
				uploadedPaths.join("\n")
			);
			await (await $("button=Dosyaları Gelen Kutusuna Al")).click();

			const sourcePanel = await $(
				`section[aria-label="${sourceMetadataMappingFixture.source.fileName} için Kaynak Metadata Eşleme Önerisi"]`
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
				await sourcePanel.$("button*=Kaynak Metadata Eşleme Önerisi oluştur")
			).click();

			const proposal = await $("summary*=Kaynak Metadata Eşleme Önerisi");
			await proposal.waitForDisplayed();
			await proposal.click();
			await $(
				"p*=alan çakışması var; öneri henüz kesinleşmedi."
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
				"li=Varlık Ailesi bağlantısı: Bilinmiyor · kaynak kanıtı yok."
			).waitForDisplayed();
			await $(
				"li=Gerekli Öğeler Listesi bağlantısı: Bilinmiyor · kaynak kanıtı yok."
			).waitForDisplayed();
			await $(
				"p=Oyun İçi Bilgiler: Bilinmiyor · proje bağlamı gerekli."
			).waitForDisplayed();
			await $("p=Pivot · walk-0").waitForDisplayed();
			await $("p=Tag · walk").waitForDisplayed();
			await $("p=Süre · walk-0").waitForDisplayed();
			const finalization = await $(
				'section[aria-label="Eşlemeyi kesinleştir"]'
			);
			await finalization.waitForDisplayed();
			const selects = await finalization.$$("label select");
			await selects[0]?.selectByVisibleText(fixture.name);
			const finalizeButton = await finalization.$(
				"button*=Eşlemeyi kesinleştir ve Aday Sürüm oluştur"
			);
			expect(await finalizeButton.isEnabled()).toBe(false);
			await selects[1]?.selectByIndex(1);
			await finalizeButton.click();
			await $("p=Kesin ilişki · Aday Sürüm oluşturuldu").waitForDisplayed();
			await $("li=Pivot · walk-0: Bilinmiyor").waitForDisplayed();

			await browser.refresh();
			const rereadProposal = await $("summary*=Kaynak Metadata Eşleme Önerisi");
			await rereadProposal.waitForDisplayed();
			await rereadProposal.click();
			await $("p=Kesin ilişki · Aday Sürüm oluşturuldu").waitForDisplayed();
			await $(
				"p=Oyun İçi Bilgiler: Bilinmiyor · proje bağlamı gerekli."
			).waitForDisplayed();
			await $("p=Pivot · walk-0").waitForDisplayed();
			await $("p=Süre · walk-0").waitForDisplayed();
			await (await $("a=Aday Sürümü aç")).click();
			await $(
				`p=${sourceMetadataMappingFixture.source.fileName} · Sürüm 1 · Aday`
			).waitForDisplayed();
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
