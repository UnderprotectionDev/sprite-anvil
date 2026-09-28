import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser } from "@wdio/globals";
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
			await $("dd=source-metadata-mapping/1.0.0").waitForDisplayed();
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

			await browser.refresh();
			const rereadProposal = await $("summary*=Kaynak Metadata Eşleme Önerisi");
			await rereadProposal.waitForDisplayed();
			await rereadProposal.click();
			await $(
				"p*=alan çakışması var; öneri henüz kesinleşmedi."
			).waitForDisplayed();
			await $(
				"p=Oyun İçi Bilgiler: Bilinmiyor · proje bağlamı gerekli."
			).waitForDisplayed();
			await $("p=Pivot · walk-0").waitForDisplayed();
		} finally {
			rmSync(directory, { force: true, recursive: true });
		}
	});
});
