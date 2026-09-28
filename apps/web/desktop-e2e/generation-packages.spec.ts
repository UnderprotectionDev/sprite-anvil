import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import { projectContextFixture } from "../e2e/project-context-fixture";

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
		await (await $("h1=Dashboard")).waitForDisplayed();

		await (await $("a=Proje Bağlamı")).click();
		await (await $("h2=İlk projeyi oluşturun")).waitForDisplayed();
		await (await $('//label[span[text()="Proje adı"]]/input')).setValue(
			fixture.projectName
		);
		await (
			await $('//label[span[text()="Genel sanat yaklaşımı"]]/textarea')
		).setValue(fixture.generalArtDirection);
		await (await $("button=Projeyi oluştur")).click();
		await (await $("h2=Bağlam Önerisi hazırlayın")).waitForDisplayed();
		await (await $('//label[span[text()="Görsel Dünya adı"]]/input')).setValue(
			"Sunken coast"
		);
		await (await $("button=Görsel Dünya ekle")).click();
		await (await $("strong=Sunken coast")).waitForDisplayed();
		await (await $('//label[span[text()="Tema adı"]]/input')).setValue(
			"Blue lanterns"
		);
		await (await $("button=Tema ekle")).click();
		await (await $("strong=Blue lanterns")).waitForDisplayed();

		await (
			await $('select[aria-label="Değişiklik 1 kapsamı"]')
		).selectByVisibleText("Tema · Sunken coast / Blue lanterns");
		await (await $('input[maxlength="240"]')).setValue(
			projectContextFixture.summary
		);
		await (
			await $('select[aria-label="Değişiklik 1 kuralı"]')
		).selectByAttribute("value", projectContextFixture.ruleId);
		await (await $('input[aria-label="Değişiklik 1 kural değeri"]')).setValue(
			projectContextFixture.value
		);
		await (await $('textarea[maxlength="2000"]')).setValue(
			projectContextFixture.rationale
		);
		await (await $('//label[span[text()="Kanıt"]]/textarea')).setValue(
			projectContextFixture.evidence
		);
		await (await $("button=Bağlam Önerisini kaydet")).click();
		await $(`h3=${projectContextFixture.summary}`).waitForDisplayed();
		await (await $("button=Öneriyi incele")).click();
		await $("h4=Etkinleştirme özeti · R1").waitForDisplayed();
		await (await $("button=R1 sürümünü etkinleştir")).click();
		await $(
			"p=Bu öneri Etkin Bağlam Sürümü R1 olarak kaydedildi."
		).waitForDisplayed();

		await (await $("a=Projects")).click();

		const projectLink = await $(
			`a[aria-label="${fixture.projectName} varlık kayıtlarını aç"]`
		);
		await projectLink.waitForClickable();
		await projectLink.click();
		await (await $("input#asset-record-name")).setValue(fixture.name);
		await (await $("input[type='checkbox']")).click();
		await (await $("button=Varlık kaydı oluştur")).click();
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
		await $("input#reference-upload-file").setValue(uploadedPath);
		const forbiddenFeatures = await $(
			'//fieldset[legend[normalize-space()="Kaçınılacak özellikler"]]'
		);
		await (
			await forbiddenFeatures.$('.//label[span[normalize-space()="Poz"]]/input')
		).click();
		await (await $("button=Görseli yükle")).click();
		await $("p*=Referans görseli panoya eklendi.").waitForDisplayed();

		const conflictAlert = await $(
			'//div[@role="alert" and .//h4[normalize-space()="Çözülmemiş aktarım çelişkileri"]]'
		);
		await conflictAlert.waitForDisplayed();
		await expect(conflictAlert).toHaveTextContaining("Poz");
		await expect(conflictAlert).toHaveTextContaining("conflicting-pose.png");

		await (await $("h2=Üretim Paketleri")).waitForDisplayed();
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
		const pinPackageButton = await $("button=Üretim Paketini sabitle");
		await pinPackageButton.waitForClickable();
		await pinPackageButton.click();
		await $(
			"p*=Referans aktarım kurallarındaki izin-yasak çelişkileri çözülmeden Üretim Paketi oluşturulamaz."
		).waitForDisplayed();
		await $("p=Bu Varlık Kaydında henüz Üretim Paketi yok.").waitForDisplayed();

		const referenceCard = await $(
			'//article[.//img[@alt="conflicting-pose.png adlı referans görseli"]]'
		);
		await (await referenceCard.$("summary=Kuralları düzenle")).click();
		const forbiddenReferenceFeatures = await referenceCard.$(
			'.//fieldset[legend[normalize-space()="Kaçınılacak özellikler"]]'
		);
		await (
			await forbiddenReferenceFeatures.$(
				'.//label[span[normalize-space()="Poz"]]/input'
			)
		).click();
		await (await referenceCard.$("button=Kuralları kaydet")).click();
		await referenceCard
			.$("p=Referans kuralları ve notu kaydedildi.")
			.waitForDisplayed();
		await conflictAlert.waitForDisplayed({ reverse: true });

		await pinPackageButton.click();
		await $("p=Üretim Paketi oluşturuldu ve kaydedildi.").waitForDisplayed();

		const savedPackage = await $(
			"summary*=Create one four-frame attack animation."
		);
		await savedPackage.waitForDisplayed();
		await savedPackage.click();
		await $("h3=Üretim Bağlamı Kopyası").waitForDisplayed();
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
		const reloadedPackage = await $(
			"summary*=Create one four-frame attack animation."
		);
		await reloadedPackage.waitForDisplayed();
		await reloadedPackage.click();
		await $("h3=Üretim Bağlamı Kopyası").waitForDisplayed();
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
