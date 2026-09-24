import { $, browser, expect } from "@wdio/globals";
import { projectContextFixture } from "../e2e/project-context-fixture";

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
		await (await $("h1=Dashboard")).waitForDisplayed();

		await (await $("a=Proje Bağlamı")).click();
		await (await $("h2=İlk projeyi oluşturun")).waitForDisplayed();
		await (await $('//label[span[text()="Proje adı"]]/input')).setValue(
			projectContextFixture.projectName
		);
		await (
			await $('//label[span[text()="Genel sanat yaklaşımı"]]/textarea')
		).setValue(projectContextFixture.generalArtDirection);
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

		const operation = await $('select[aria-label="Değişiklik 1 işlemi"]');
		await expect(await operation.$('option[value="replace"]')).toBeDisabled();
		await expect(await operation.$('option[value="remove"]')).toBeDisabled();
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

		const savedProposal = await $(`h3=${projectContextFixture.summary}`);
		await savedProposal.waitForDisplayed();
		await expect(await $("p=Önerilen değer: 1.5")).toBeDisplayed();
		await (await $("button=Öneriyi incele")).click();
		await $("h4=Etkinleştirme özeti · R1").waitForDisplayed();
		await expect(
			await $(
				"p=Öncelik: Tema · Sunken coast / Blue lanterns → Görsel Dünya · Sunken coast → Proje · " +
					projectContextFixture.projectName
			)
		).toBeDisplayed();
		await expect(await $("span=Etkinleştirilebilir")).toBeDisplayed();
		await (await $("button=R1 sürümünü etkinleştir")).click();
		await $(
			"p=Bu öneri Etkin Bağlam Sürümü R1 olarak kaydedildi."
		).waitForDisplayed();
		await $("h4=Etkin sürüm · R1").waitForDisplayed();
		await expect(await $("button=R1 sürümünü etkinleştir")).not.toBeDisplayed();
		await browser.refresh();
		await $(`h3=${projectContextFixture.summary}`).waitForDisplayed();
		await expect(await $("p=Önerilen değer: 1.5")).toBeDisplayed();
		await expect(await $("span=Etkin")).toBeDisplayed();
	});
});
