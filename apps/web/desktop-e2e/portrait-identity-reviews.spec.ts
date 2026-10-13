import { readFile } from "node:fs/promises";
import { $, browser, expect } from "@wdio/globals";
import { openWorkspaceTask } from "./workspace-navigation";

describe("Portrait identity surface equivalence", () => {
	it("reopens the web review and saves equivalent crop observations on desktop", async function () {
		const resultPath = process.env.PORTRAIT_REVIEW_RESULT_PATH;
		if (!resultPath) {
			this.skip();
			return;
		}
		const result = JSON.parse(await readFile(resultPath, "utf8"));
		const initialUrl = new URL(
			process.env.PORTRAIT_DESKTOP_START_URL ?? (await browser.getUrl())
		);
		const origin = `${initialUrl.protocol}//${initialUrl.host}`;
		await browser.url(`${origin}/login`);
		await $("h2=Welcome Back").waitForDisplayed();
		await $("input[name='email']").setValue(result.email);
		await $("input[name='password']").setValue(result.password);
		await $("form button[type='submit']").click();
		await $("h1=Oyun projeleri").waitForDisplayed({ timeout: 30_000 });
		await browser.url(`${origin}${result.familyPath}`);
		await openWorkspaceTask("Profil incelemeleri");
		const review = await $(
			"section[aria-label='Portre Kimliğini ve Kırpmayı İnceleme']"
		);
		await review.waitForDisplayed({ timeout: 20_000 });
		await review.$("summary=İnceleme ayrıntılarını göster").click();
		await expect(
			await review.$(
				"p=Neutral portrait · Neutral · Diyalog · 137 × 181 px · Kırpma: 8, 0, 24 × 32 · Açık"
			)
		).toBeDisplayed();
		await expect(
			await review.$(
				"p=Kırpma ve yüz görünürlüğü: Başarısız · Face is clipped in dialogue."
			)
		).toBeDisplayed();
		const expressions = await review.$$("input[maxlength='100']");
		await expressions[0]?.setValue("Neutral");
		await expressions[1]?.setValue("Happy");
		const firstExpression = await review.$("fieldset fieldset");
		await firstExpression
			.$(".//label[contains(text(), 'Kırpma X')]/input")
			.setValue("8");
		await firstExpression
			.$(".//label[contains(text(), 'Kırpma genişliği')]/input")
			.setValue("24");
		await firstExpression
			.$(".//label[contains(text(), 'Kullanım genişliği')]/input")
			.setValue("137");
		await firstExpression
			.$(".//label[contains(text(), 'Kullanım yüksekliği')]/input")
			.setValue("181");
		await review
			.$("select[id$='-identity']")
			.selectByAttribute("value", "passed");
		await review
			.$("select[id$='-expression']")
			.selectByAttribute("value", "passed");
		await review.$("select[id$='-crop']").selectByAttribute("value", "failed");
		const notes = await review.$$("textarea");
		await notes[0]?.setValue("Same Hero identity on desktop.");
		await notes[1]?.setValue("Neutral and Happy remain distinct on desktop.");
		await notes[2]?.setValue("Face visibility needs follow-up on desktop.");
		await notes[3]?.setValue("Desktop portrait crop review.");
		const save = await review.$("button=Portre incelemesini kaydet");
		await browser.waitUntil(async () => await save.isEnabled(), {
			timeout: 20_000,
		});
		await save.click();
		await review.$("p=Portre incelemesi kaydedildi.").waitForDisplayed();
		await browser.refresh();
		await openWorkspaceTask("Profil incelemeleri");
		await expect(
			await review.$("p=Desktop portrait crop review.")
		).toBeDisplayed();
		await browser.saveScreenshot("../../.context/portrait-review-desktop.png");
	});
});
