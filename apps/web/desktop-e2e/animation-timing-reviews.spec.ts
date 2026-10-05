import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $, browser, expect } from "@wdio/globals";
import { animationTimingFixture as fixture } from "../e2e/animation-timing-review-fixture";

describe("Animation Timing and Transition Review", () => {
	it("compares and reopens variable timing on the desktop surface", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		const directory = await mkdtemp(
			join(tmpdir(), "sprite-anvil-animation-timing-review-")
		);
		const pngPath = join(directory, "animation-timing-sprite.png");
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
			await $("h1=Oyun projeleri").waitForDisplayed();

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

			await $("input[id='asset-record-name']").setValue(fixture.sourceName);
			await (await $("button=Varlık Kaydı ekle")).click();
			await $(
				"input[aria-label='" +
					fixture.sourceName +
					" için Varlık Sürümü dosyası']"
			).setValue(pngPath);
			await $("p=Sürüm 1 · Aday").waitForDisplayed();
			await $("textarea[id^='review-rationale-']").setValue(
				"The sprite is suitable for timing review."
			);
			await (await $("button=Onayla")).click();
			await $("p=Sürüm 1 · Onaylandı").waitForDisplayed();
			await (await $("button=Ana Tasarım olarak seç")).click();
			await $(
				`p=Ana Tasarım: ${fixture.sourceName} · Sürüm 1`
			).waitForDisplayed();

			const characterProfile = await $(
				"h4=Karakterler, yaratıklar ve animasyonlar"
			).$("xpath=ancestor::li[1]");
			await (
				await characterProfile.$(
					"xpath=.//button[contains(normalize-space(.), 'etkinleştir')]"
				)
			).click();
			await characterProfile.$("p=Etkin sözleşme v1.0.1").waitForDisplayed();

			let review = await $(
				"section[aria-label='" +
					fixture.familyName +
					" animasyon zamanlaması incelemesi']"
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			const directionNames = ["south", "west", "north", "east"];
			const firstDurations = [80, 120, 100, 70];
			const firstPhases = ["Contact", "Wind-up", "Contact", "Lift"];
			const secondDurations = [220, 280, 200, 300];
			const secondPhases = ["Recovery", "Impact", "Recovery", ""];
			const directions = await review.$$("fieldset");
			for (let index = 0; index < directionNames.length; index += 1) {
				const direction = directions[index];
				if (!direction) {
					throw new Error("Expected four direction editors.");
				}
				const number = index + 1;
				const firstKey = `Yön ${number} kare 1`;
				const secondKey = `Yön ${number} kare 2`;
				// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions within each direction must occur in order.
				await direction
					.$(`input[aria-label='${firstKey} kimliği']`)
					.setValue(`${directionNames[index]}-contact`);
				await direction
					.$(`select[aria-label='${firstKey} sürümü']`)
					.selectByVisibleText(`${fixture.sourceName} · Sürüm 1`);
				await direction
					.$(`input[aria-label='${firstKey} süre (ms)']`)
					.setValue(String(firstDurations[index]));
				await direction
					.$(`input[aria-label='${firstKey} hareket evresi']`)
					.setValue(firstPhases[index] ?? "");
				await (await direction.$("button=Kare ekle")).click();
				await direction
					.$(`input[aria-label='${secondKey} kimliği']`)
					.setValue(`${directionNames[index]}-recovery`);
				await direction
					.$(`select[aria-label='${secondKey} sürümü']`)
					.selectByVisibleText(`${fixture.sourceName} · Sürüm 1`);
				await direction
					.$(`input[aria-label='${secondKey} süre (ms)']`)
					.setValue(String(secondDurations[index]));
				await direction
					.$(`input[aria-label='${secondKey} hareket evresi']`)
					.setValue(secondPhases[index] ?? "");
			}

			const [, , north] = directions;
			if (!north) {
				throw new Error("Expected the north direction editor.");
			}
			const moveUpButtons = await north.$$("button=Kareyi yukarı taşı");
			const [, moveSecondFrameUp] = moveUpButtons;
			if (!moveSecondFrameUp) {
				throw new Error("Expected the second-frame reorder control.");
			}
			await moveSecondFrameUp.click();
			await review.$("input[aria-label='Oynatma hızı']").setValue("2");
			const playhead = await review.$(
				"input[aria-label='Oynatma konumu (ms)']"
			);
			await playhead.setValue("110");
			await expect(await playhead.getValue()).toBe("110");
			await expect(await directions[0]?.$("figure").getText()).toContain(
				"south · Kare 2 · south-recovery · 220 ms · Recovery"
			);
			await expect(await directions[1]?.$("figure").getText()).toContain(
				"west · Kare 1 · west-contact · 120 ms · Wind-up"
			);
			await expect(await directions[2]?.$("figure").getText()).toContain(
				"north · Kare 1 · north-recovery · 200 ms · Recovery"
			);

			await playhead.setValue("310");
			const looping = await review.$("input[aria-label='Döngüde oynat']");
			await looping.click();
			await expect(await looping.isSelected()).toBe(false);
			await expect(await directions[0]?.$("figure").getText()).toContain(
				"south · Kare 2 · south-recovery · 220 ms · Recovery"
			);
			await expect(await directions[0]?.getText()).not.toContain(
				"Döngü sınırı · son kare → ilk kare"
			);
			await looping.click();
			await expect(await looping.isSelected()).toBe(true);
			await expect(await directions[0]?.$("figure").getText()).toContain(
				"south · Kare 1 · south-contact · 80 ms · Contact"
			);
			await expect(await directions[0]?.getText()).toContain(
				"Döngü sınırı · son kare → ilk kare"
			);

			await (await review.$("button=Başa dön")).click();
			await expect(await playhead.getValue()).toBe("0");
			await review
				.$("input[aria-label='Animasyon adı']")
				.setValue("Walk cycle");
			await (
				await review.$("input[aria-label='İnceleme sonucu']")
			).selectByAttribute("value", "needs_follow_up");
			await review
				.$("textarea[aria-label='Gerekçe']")
				.setValue(
					"The directions reach their recovery frames at different times."
				);
			await (await review.$("button=İncelemeyi kaydet")).click();
			await review
				.$("p=İnceleme kalıcı kayıttan doğrulandı.")
				.waitForDisplayed();

			await browser.refresh();
			review = await $(
				"section[aria-label='" +
					fixture.familyName +
					" animasyon zamanlaması incelemesi']"
			);
			await review.waitForDisplayed({ timeout: 20_000 });
			await (
				await review.$(
					"xpath=.//button[contains(normalize-space(.), 'Walk cycle · 4 yön · Takip gerekli')]"
				)
			).click();
			await expect(
				await review.$("input[aria-label='Yön 1 kare 2 süre (ms)']").getValue()
			).toBe("220");
			await expect(
				await review.$("input[aria-label='Yön 3 kare 1 kimliği']").getValue()
			).toBe("north-recovery");
			await expect(
				await review
					.$("input[aria-label='Yön 4 kare 2 hareket evresi']")
					.getValue()
			).toBe("");
			await expect(
				await review.$("textarea[aria-label='Gerekçe']").getValue()
			).toBe("The directions reach their recovery frames at different times.");
			await expect(
				await review.$("input[aria-label='Oynatma hızı']").getValue()
			).toBe("2");
			await expect(await review.$("button=İncelemeyi kaydet").isEnabled()).toBe(
				false
			);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
