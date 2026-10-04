import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { assetVersionFixture as fixture } from "../e2e/asset-version-fixture";

describe("Directional Review", () => {
	it("saves and reopens a four-direction review in the desktop flow", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-directional-review-")
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

			// Without the character profile activation the character review
			// section must not offer guidance on this family.
			await (
				await $(
					`section[aria-label='${fixture.familyName} kimlik ve yön incelemesi']`
				)
			).waitForDisplayed({ reverse: true, timeout: 20_000 });

			await (await $("input[id='asset-record-name']")).setValue(
				fixture.sourceName
			);
			await (await $("button=Varlık Kaydı ekle")).click();
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
			await (await $("button=Ana Tasarım olarak seç")).click();
			await $("p=Ana Tasarım: Ash Knight base · Sürüm 1").waitForDisplayed();

			const characterProfile = await $(
				"h4=Karakterler, yaratıklar ve animasyonlar"
			).$("xpath=ancestor::li[1]");
			await (
				await characterProfile.$(
					"xpath=.//button[contains(normalize-space(.), 'etkinleştir')]"
				)
			).click();
			await (
				await characterProfile.$("p=Etkin sözleşme v1.0.1")
			).waitForDisplayed();

			let review = await $(
				`section[aria-label='${fixture.familyName} kimlik ve yön incelemesi']`
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			const versionLabel = `${fixture.sourceName} · Sürüm 1`;
			for (const index of [1, 2, 3, 4]) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions must occur in order.
				await (
					await review.$(`select[aria-label='Yön ${index} kare 1 sürümü']`)
				).selectByVisibleText(versionLabel);
			}
			await (await review.$("button=Kare ekle")).click();
			await (
				await review.$("input[aria-label='Yön 1 kare 2 süre (ms)']")
			).setValue("250");
			const playhead = await review.$(
				"input[aria-label='Oynatma konumu (ms)']"
			);
			await playhead.setValue("150");
			await expect(playhead).toHaveValue("150");
			for (const [label, observation] of [
				["Siluet", "Same outline"],
				["Oran", "Same proportions"],
				["Ekipman tarafı", "Right"],
				["Palet", "Gray"],
				["Perspektif", "Side"],
				["Ölçek", "Native pixels"],
				["Zemine temas", "Needs follow-up"],
			] as const) {
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions must occur in order.
				await (await review.$(`textarea[aria-label='${label}']`)).setValue(
					observation
				);
			}
			await (await review.$("textarea[aria-label='Gerekçe']")).setValue(
				"Four directions inspected on the desktop surface"
			);
			await (await review.$("button=İncelemeyi kaydet")).click();
			await (
				await review.$("p=İnceleme kalıcı kayıttan doğrulandı.")
			).waitForDisplayed();

			await browser.refresh();
			review = await $(
				`section[aria-label='${fixture.familyName} kimlik ve yön incelemesi']`
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			await (
				await review.$(
					'xpath=.//button[contains(normalize-space(.), "4 yön · Takip gerekli")]'
				)
			).click();
			await expect(
				await review.$("textarea[aria-label='Gerekçe']")
			).toHaveValue("Four directions inspected on the desktop surface");
			await expect(
				await review.$("input[aria-label='Yön 1 kare 2 süre (ms)']")
			).toHaveValue("250");
			await expect(await review.$("button=İncelemeyi kaydet")).toBeDisabled();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
