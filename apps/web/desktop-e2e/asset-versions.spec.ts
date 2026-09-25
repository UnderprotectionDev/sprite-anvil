import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser } from "@wdio/globals";
import { assetVersionFixture as fixture } from "../e2e/asset-version-fixture";

describe("Asset Version lineage", () => {
	it("persists the same reviewed lineage in the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-asset-version-")
		);
		const pngPath = join(directory, "ash-knight.png");
		await writeFile(pngPath, fixture.png);

		try {
			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("input[name='name']")).setValue(fixture.userName);
			await (await $("input[name='email']")).setValue(fixture.email);
			await (await $("input[name='password']")).setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			await (await $("h1=Dashboard")).waitForDisplayed();

			await (await $("a=Proje Bağlamı")).click();
			await (await $('//label[span[text()="Proje adı"]]/input')).setValue(
				fixture.projectName
			);
			await (
				await $('//label[span[text()="Genel sanat yaklaşımı"]]/textarea')
			).setValue(fixture.generalArtDirection);
			await (await $("button=Projeyi oluştur")).click();
			await (await $("h2=Bağlam Önerisi hazırlayın")).waitForDisplayed();
			await (await $("input[placeholder='Örn. Yüksek yaylalar']")).setValue(
				fixture.visualWorldName
			);
			await (await $("button=Görsel Dünya ekle")).click();
			await (await $(`strong=${fixture.visualWorldName}`)).waitForDisplayed();

			await (await $("a=Projects")).click();
			await (await $("a=Varlık Aileleri")).click();
			await (await $("input[id='subject-identity-name']")).setValue(
				fixture.identityName
			);
			await (await $("button=Varlık Kimliği oluştur")).click();
			await (await $(`h2=${fixture.identityName}`)).waitForDisplayed();
			await (await $("input[id='asset-family-name']")).setValue(
				fixture.familyName
			);
			await (await $("#asset-family-visual-world")).selectByVisibleText(
				fixture.visualWorldName
			);
			await (await $("input[id='asset-family-use-context']")).setValue(
				fixture.useContext
			);
			await (await $("button=Varlık Ailesi oluştur")).click();
			await (await $(`h3=${fixture.familyName}`)).waitForDisplayed();

			await (await $("input[id='asset-record-name']")).setValue(
				fixture.sourceName
			);
			await (await $("button=Varlık Kaydı ekle")).click();
			await (await $("input[id='asset-record-name']")).setValue(
				fixture.derivativeName
			);
			await (await $("button=Varlık Kaydı ekle")).click();
			await (await $(`h4=${fixture.derivativeName}`)).waitForDisplayed();

			await (
				await $(
					`input[aria-label='${fixture.sourceName} için Varlık Sürümü dosyası']`
				)
			).setValue(pngPath);
			await (await $("p=Sürüm 1 · Aday")).waitForDisplayed();
			const reviewRationale = "The silhouette matches the family design.";
			await (await $("textarea[id^='review-rationale-']")).setValue(
				reviewRationale
			);
			await (await $("button=Onayla")).click();
			await (await $("p=Sürüm 1 · Onaylandı")).waitForDisplayed();
			await $(`li*=— Gerekçe: ${reviewRationale}`).waitForDisplayed();
			await (await $("time[datetime]")).waitForDisplayed();
			await (await $("button=Ana Tasarım olarak seç")).click();
			await $("p=Ana Tasarım: Ash Knight base · Sürüm 1").waitForDisplayed();

			await (await $("#relationship-type")).selectByAttribute(
				"value",
				"derivative"
			);
			await $("p=Ash Knight base · Ana Tasarım Sürüm 1").waitForDisplayed();
			await (await $("#relationship-target")).selectByVisibleText(
				fixture.derivativeName
			);
			await (await $("button=İlişki ekle")).click();
			const lineage = await $(`li*=${fixture.visibleLineage}`);
			await lineage.waitForDisplayed();
			await browser.refresh();
			await (await $("p=Sürüm 1 · Onaylandı")).waitForDisplayed();
			await $(`li*=— Gerekçe: ${reviewRationale}`).waitForDisplayed();
			await (await $("time[datetime]")).waitForDisplayed();
			await (await $(`li*=${fixture.visibleLineage}`)).waitForDisplayed();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
