import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import {
	assetRecordFixture,
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "../e2e/asset-record-fixture";

describe("Asset Records", () => {
	it("persists an Asset Record created through the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const signInLink = await $("a=Sign In");
		await signInLink.waitForClickable();
		await signInLink.click();
		await (await $("input[name='name']")).setValue(assetRecordFixture.userName);
		await (await $("input[name='email']")).setValue(assetRecordFixture.email);
		await (await $("input[name='password']")).setValue(
			assetRecordFixture.password
		);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Dashboard")).waitForDisplayed();

		await (await $("a=Projects")).click();
		await (await $("input#project-name")).setValue(
			assetRecordFixture.projectName
		);
		await (await $("textarea#project-art-direction")).setValue(
			assetRecordFixture.generalArtDirection
		);
		await (await $("button=Proje oluştur")).click();

		const projectLink = await $(
			`a[aria-label="${assetRecordFixture.projectName} varlık kayıtlarını aç"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();
		await (await $("input#asset-record-name")).setValue(
			assetRecordFixture.name
		);
		await (await $("input[type='checkbox']")).click();
		await (await $("button=Varlık kaydı oluştur")).click();

		const recordHeading = await $(`h1=${assetRecordFixture.name}`);
		await recordHeading.waitForDisplayed();
		await (await $("input#sourceImageDimensions-proposal-width")).setValue(
			"512"
		);
		await (await $("input#sourceImageDimensions-proposal-height")).setValue(
			"256"
		);
		await (await $("input#logicalResolution-confirmed-width")).setValue("72");
		await (await $("input#logicalResolution-confirmed-height")).setValue("80");
		await (await $("button=Ölçüleri kaydet")).click();
		await expect(await $("p=Ölçüler kaydedildi.")).toBeDisplayed();
		await expect(await $("p*=Kayıt oluşturuldu")).toBeDisplayed();
		await browser.refresh();
		await (await $(`h1=${assetRecordFixture.name}`)).waitForDisplayed();
		await expect(await $("p*=Kayıt oluşturuldu")).toBeDisplayed();
		await expect(
			await $("input#sourceImageDimensions-proposal-width")
		).toHaveValue("512");
		await expect(
			await $("input#logicalResolution-confirmed-width")
		).toHaveValue("72");
	});

	it("persists an Asset Version, review, quality result, and legacy history", async function () {
		const versionFixture = createAssetRecordFixture();
		if (!assetVersionE2eEnabled) {
			this.skip();
		}

		const signInLink = await $("a=Sign In");
		await signInLink.waitForClickable();
		await signInLink.click();
		await (await $("input[name='name']")).setValue(versionFixture.userName);
		await (await $("input[name='email']")).setValue(versionFixture.email);
		await (await $("input[name='password']")).setValue(versionFixture.password);
		await (await $("button=Sign Up")).click();
		await (await $("h1=Dashboard")).waitForDisplayed();
		await (await $("a=Projects")).click();
		await (await $("input#project-name")).setValue(versionFixture.projectName);
		await (await $("textarea#project-art-direction")).setValue(
			versionFixture.generalArtDirection
		);
		await (await $("button=Proje oluştur")).click();

		const projectLink = await $(
			`a[aria-label="${versionFixture.projectName} varlık kayıtlarını aç"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();
		await (await $("input#asset-record-name")).setValue(versionFixture.name);
		await (await $("input[type='checkbox']")).click();
		await (await $("button=Varlık kaydı oluştur")).click();
		await (await $(`h1=${versionFixture.name}`)).waitForDisplayed();

		const tempDirectory = mkdtempSync(
			join(tmpdir(), "asset-record-version-e2e-")
		);
		try {
			const imagePath = join(tempDirectory, "ash-knight.png");
			writeFileSync(
				imagePath,
				Buffer.from(versionFixture.assetVersionPngBase64, "base64")
			);
			const uploadedPath = await browser.uploadFile(imagePath);
			await (await $("input#asset-version-file")).setValue(uploadedPath);
			await (await $("input#asset-version-source")).setValue(
				"Created for version tracking"
			);
			await (await $("select#asset-version-relationship")).selectByAttribute(
				"value",
				"created_by_user"
			);
			await (await $("textarea#asset-version-evidence")).setValue(
				"Owner attested to the source and relationship."
			);
			await (await $("button=Aday sürümü kaydet")).click();
			await (await $("p*=Aday Sürüm kaydedildi.")).waitForDisplayed();
			await (
				await $("p*=Dosya biçim imzası eşleşti (1 sürüm).")
			).waitForDisplayed();

			await (await $("textarea#review-rationale")).setValue(
				"Reviewed through the desktop flow."
			);
			await (await $("button=Onayla")).click();
			await (await $("p*=Onaylı Sürüm kaydedildi.")).waitForDisplayed();
			await (await $("p*=ash-knight.png · Sürüm 1")).waitForDisplayed();
			await (await $("p*=Created for version tracking")).waitForDisplayed();
			await (
				await $("p*=Owner attested to the source and relationship.")
			).waitForDisplayed();
			await (await $("p*=Kullanıcı oluşturdu")).waitForDisplayed();
			await (
				await $("p*=Reviewed through the desktop flow.")
			).waitForDisplayed();

			const alternativeImagePath = join(tempDirectory, "ash-knight-alt.png");
			writeFileSync(
				alternativeImagePath,
				Buffer.from(versionFixture.assetVersionPngBase64, "base64")
			);
			const uploadedAlternativePath =
				await browser.uploadFile(alternativeImagePath);
			await (await $("input#asset-version-file")).setValue(
				uploadedAlternativePath
			);
			await (await $("input#asset-version-source")).setValue(
				"Alternative sketch"
			);
			await (await $("select#asset-version-relationship")).selectByAttribute(
				"value",
				"received_from_team"
			);
			await (await $("textarea#asset-version-evidence")).setValue(
				"Team handoff note."
			);
			await (await $("button=Aday sürümü kaydet")).click();
			await (await $("p*=Aday Sürüm kaydedildi.")).waitForDisplayed();
			await (
				await $("p*=ash-knight-alt.png · Sürüm 2 · Aday")
			).waitForDisplayed();
			await (
				await $("p*=Dosya biçim imzası eşleşti (2 sürüm).")
			).waitForDisplayed();

			await browser.refresh();
			await (await $("p*=ash-knight.png · Sürüm 1")).waitForDisplayed();
			await (
				await $("p*=ash-knight-alt.png · Sürüm 2 · Aday")
			).waitForDisplayed();
			await (
				await $("p*=Dosya biçim imzası eşleşti (2 sürüm).")
			).waitForDisplayed();
			await (await $("p*=Created for version tracking")).waitForDisplayed();
			await (await $("p*=Alternative sketch")).waitForDisplayed();
			await (await $("p*=Team handoff note.")).waitForDisplayed();
			await (await $("p*=Ekipten alındı")).waitForDisplayed();
			await (
				await $("p*=Owner attested to the source and relationship.")
			).waitForDisplayed();
			await (await $("p*=Kullanıcı oluşturdu")).waitForDisplayed();
			await (
				await $("p*=Reviewed through the desktop flow.")
			).waitForDisplayed();
		} finally {
			rmSync(tempDirectory, { force: true, recursive: true });
		}
	});
});
