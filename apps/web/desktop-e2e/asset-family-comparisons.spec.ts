import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { assetFamilyComparisonFixture as fixture } from "../e2e/asset-family-comparison-fixture";

describe("Asset Family Comparison", () => {
	it("persists and reopens a state and direction comparison on the desktop surface", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-asset-family-comparison-")
		);
		const pngPath = join(directory, "asset-family-comparison.png");
		await writeFile(pngPath, fixture.png);

		try {
			await (await $("a=Sign In")).waitForClickable();
			await (await $("a=Sign In")).click();
			await (await $("button=Need an account? Sign Up")).click();
			await $("h2=Create Account").waitForDisplayed();
			await $("input[name='name']").setValue(fixture.userName);
			await $("input[name='email']").setValue(fixture.email);
			await $("input[name='password']").setValue(fixture.password);
			await (await $("button=Sign Up")).click();
			// The first webview navigation after signup can be slow on a cold start.
			await $("h1=Oyun projeleri").waitForDisplayed({ timeout: 30_000 });

			await (await $("a=Proje Bağlamı")).click();
			await $("//label[span[text()='Proje adı']]/input").setValue(
				fixture.projectName
			);
			await $(
				"//label[span[text()='Genel sanat yaklaşımı']]/textarea"
			).setValue(fixture.generalArtDirection);
			await (await $("button=Projeyi oluştur")).click();
			await $("h2=Bağlam Önerisi hazırlayın").waitForDisplayed();
			await $("input[placeholder='Örn. Yüksek yaylalar']").setValue(
				fixture.visualWorldName
			);
			await (await $("button=Görsel Dünya ekle")).click();
			await $(`strong=${fixture.visualWorldName}`).waitForDisplayed();

			await (await $("a=Projects")).click();
			await (await $("a=Varlık Aileleri")).click();
			await $("input[id='subject-identity-name']").setValue(
				fixture.identityName
			);
			await (await $("button=Varlık Kimliği oluştur")).click();
			await $(`h2=${fixture.identityName}`).waitForDisplayed();
			await $("input[id='asset-family-name']").setValue(fixture.familyName);
			await $("#asset-family-visual-world").selectByVisibleText(
				fixture.visualWorldName
			);
			await $("input[id='asset-family-use-context']").setValue(
				fixture.useContext
			);
			await (await $("button=Varlık Ailesi oluştur")).click();
			await $(`h3=${fixture.familyName}`).waitForDisplayed();

			for (const record of fixture.records) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions within each record setup must occur in order.
				await $("input[id='asset-record-name']").setValue(record.name);
				await (await $("button=Varlık Kaydı ekle")).click();
				const recordItem = await $(
					`//li[h4[normalize-space(.)='${record.name}']]`
				);
				await recordItem
					.$("p=Henüz sürüm kaydedilmedi.")
					.waitForDisplayed({ timeout: 20_000 });

				await (await recordItem.$("a=Varlık Sürümü yükle")).click();
				await $("#asset-record-metadata-category").selectByVisibleText(
					fixture.categoryLabel
				);
				await (await $("button=Metadata’yı kaydet")).click();
				await $("p=Varlık kaydı metadata’sı kaydedildi.").waitForDisplayed();

				await $("#asset-version-file").setValue(pngPath);
				await $("#asset-version-missing-history").setValue(record.uploadNote);
				await $("#asset-version-source").setValue(
					"Asset family comparison desktop fixture"
				);
				await $("#asset-version-relationship").selectByAttribute(
					"value",
					"created_by_user"
				);
				await (await $("button=Aday sürümü kaydet")).click();
				await $("p=Aday Sürüm kaydedildi.").waitForDisplayed();

				await (await $("a=Varlık Aileleri")).click();
				await $(`h3=${fixture.familyName}`).waitForDisplayed();
				await (await $(`//li[h4[normalize-space(.)='${record.name}']]`))
					.$("p=Sürüm 1 · Aday")
					.waitForDisplayed({ timeout: 20_000 });
			}

			const objectProfile = await $(
				"h4=Objeler, silahlar, ekipmanlar ve durum aileleri"
			).$("xpath=ancestor::li[1]");
			await (
				await objectProfile.$(
					"xpath=.//button[contains(normalize-space(.), 'etkinleştir')]"
				)
			).click();
			await objectProfile
				.$("p=Etkin sözleşme v1.0.0")
				.waitForDisplayed({ timeout: 20_000 });

			const section = `section[aria-label='${fixture.familyName} durum ve yön ailesi karşılaştırması']`;
			let comparison = await $(section);
			await comparison.waitForDisplayed({ timeout: 20_000 });
			await (
				await comparison.$(
					"xpath=.//label[contains(normalize-space(.), 'Kapalı sandık')]//input[@type='checkbox']"
				)
			).click();
			await (
				await comparison.$(
					"xpath=.//label[contains(normalize-space(.), 'Açık sandık')]//input[@type='checkbox']"
				)
			).click();
			await comparison
				.$("textarea[aria-label='Ölçek gözlemi']")
				.setValue("Her iki sandık aynı ızgara ölçeğini kullanıyor.");
			await comparison
				.$("textarea[aria-label='Perspektif gözlemi']")
				.setValue("Perspektif tutarlı.");
			await comparison
				.$("textarea[aria-label='Malzeme dili gözlemi']")
				.setValue("Malzeme dili aynı ahşap.");
			await comparison
				.$("textarea[aria-label='Durum ve yön ayrışması gözlemi']")
				.setValue("Kapalı ve açık durumlar net ayrışıyor.");
			await (await comparison.$("button=Karşılaştırmayı kaydet")).click();
			await comparison
				.$("p=Karşılaştırma kalıcı kayıttan doğrulandı.")
				.waitForDisplayed({ timeout: 20_000 });

			await browser.refresh();
			comparison = await $(section);
			await comparison.waitForDisplayed({ timeout: 20_000 });
			await (
				await comparison.$(
					"xpath=.//button[contains(normalize-space(.), '2 Varlık Sürümü')]"
				)
			).click();
			await comparison
				.$("h4=Kapalı sandık · Varlık Sürümü 1")
				.waitForDisplayed({ timeout: 20_000 });
			await comparison
				.$("h4=Açık sandık · Varlık Sürümü 1")
				.waitForDisplayed({ timeout: 20_000 });
			await expect(
				await comparison
					.$("dd=Her iki sandık aynı ızgara ölçeğini kullanıyor.")
					.isDisplayed()
			).toBe(true);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
