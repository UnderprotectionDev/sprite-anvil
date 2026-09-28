import { $, browser, expect } from "@wdio/globals";
import { createAssetRecordFixture } from "../e2e/asset-record-fixture";
import { projectContextFixture } from "../e2e/project-context-fixture";

describe("Generation Packages", () => {
	it("pins and rereads a Production Context Snapshot through the desktop flow", async function () {
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
	});
});
