import { access, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { marketingUsageReviewPackageSchema } from "@sprite-anvil/api/marketing-usage-reviews";
import { $, browser, expect } from "@wdio/globals";
import {
	marketingUsageFixture as fixture,
	readMarketingPreviewPresentation,
} from "../e2e/marketing-usage-review-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

async function selectOption(label: string, value: string) {
	await browser.execute(
		(text, selection) => {
			const container = Array.from(document.querySelectorAll("label")).find(
				(node) => node.firstChild?.textContent?.trim() === text
			);
			const input = container?.querySelector("select");
			if (!input) {
				throw new Error(`Select ${text} was not found.`);
			}
			input.value = selection;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		},
		label,
		value
	);
}

async function selectObservation(selector: string, value: string) {
	await browser.execute(
		(query, selection) => {
			const input = document.querySelector(query);
			if (!(input instanceof HTMLSelectElement)) {
				throw new Error("Observation select was not found.");
			}
			input.value = selection;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		},
		selector,
		value
	);
}

describe("Marketing usage surface equivalence", () => {
	it("persists and downloads equivalent exact-version evidence on desktop", async function () {
		const resultPath = process.env.MARKETING_USAGE_WEB_RESULT;
		if (!resultPath) {
			this.skip();
			return;
		}
		const result = JSON.parse(await readFile(resultPath, "utf8"));
		const webMetadata = marketingUsageReviewPackageSchema.parse(
			result.metadata
		);
		const initialUrl = new URL(await browser.getUrl());
		const origin = `${initialUrl.protocol}//${initialUrl.host}`;
		await browser.url(`${origin}/login`);
		await $("h2=Welcome Back").waitForDisplayed();
		await $("input[name='email']").setValue(fixture.email);
		await $("input[name='password']").setValue(fixture.password);
		await $("form button[type='submit']").click();
		await $("h1=Oyun projeleri").waitForDisplayed();
		await browser.url(`${origin}${result.familyPath}`);
		await openWorkspaceTask("Profil incelemeleri");
		const review = await $(
			"h3=Logo ve Tanıtım Kullanımlarını Sınama · Anvil marketing"
		).$("..");
		await review.waitForDisplayed({ timeout: 20_000 });
		await review.$("input[aria-label='displaySize width']").setValue("77");
		await review.$("input[aria-label='displaySize height']").setValue("51");
		await review.$("input[aria-label='safeArea x']").setValue("20");
		await review.$("input[aria-label='safeArea y']").setValue("20");
		await review.$("input[aria-label='safeArea width']").setValue("260");
		await review.$("input[aria-label='safeArea height']").setValue("150");
		await review.$("input[aria-label='crop x']").setValue("10");
		await review.$("input[aria-label='crop y']").setValue("5");
		await review.$("input[aria-label='crop width']").setValue("281");
		await review.$("input[aria-label='crop height']").setValue("189");
		await selectOption("Kullanım amacı", "store");
		await selectOption("Sunum", "opaque");
		await browser.execute(() => {
			const input = document.querySelector("input[type='color']");
			if (!(input instanceof HTMLInputElement)) {
				throw new Error("Color input was not found.");
			}
			const setter = Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value"
			)?.set;
			setter?.call(input, "#ffcc00");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await selectObservation("select[id$='-0-safeArea']", "failed");
		await selectObservation("select[id$='-1-readability']", "passed");
		const notes = await review.$$("textarea");
		await notes[0]?.setValue(
			"Lettering crosses the safe area on light background."
		);
		await notes[1]?.setValue("Small logo remains legible on dark background.");
		await browser.waitUntil(
			async () =>
				await review.$("button=Kullanım incelemesini kaydet").isEnabled(),
			{ timeout: 20_000 }
		);
		expect(await browser.execute(readMarketingPreviewPresentation)).toEqual(
			result.previews
		);
		await review.$("button=Kullanım incelemesini kaydet").click();
		await review.$("p=İnceleme kalıcı kayıttan doğrulandı.").waitForDisplayed();
		await browser.refresh();
		await openWorkspaceTask("Profil incelemeleri");
		const refreshed = await $(
			"h3=Logo ve Tanıtım Kullanımlarını Sınama · Anvil marketing"
		).$("..");
		await browser.waitUntil(
			async () =>
				(await refreshed.$$("button=Kullanım kanıtını indir")).length === 3,
			{ timeout: 20_000 }
		);
		await refreshed.scrollIntoView();
		await browser.saveScreenshot("../../.context/marketing-usage-desktop.png");
		await browser.execute(() => {
			const { click } = HTMLAnchorElement.prototype;
			HTMLAnchorElement.prototype.click = function () {
				Reflect.set(window, "marketingDownloadFilename", this.download);
				click.call(this);
				HTMLAnchorElement.prototype.click = click;
			};
		});
		await refreshed.$("button=Kullanım kanıtını indir").click();
		const filename = await browser.execute(
			() => Reflect.get(window, "marketingDownloadFilename") as string
		);
		if (!filename?.startsWith("marketing-usage-")) {
			throw new Error("Unexpected download filename.");
		}
		const path = join(homedir(), "Downloads", filename);
		try {
			await browser.waitUntil(
				async () => {
					try {
						await access(path);
						return true;
					} catch {
						return false;
					}
				},
				{ timeout: 20_000 }
			);
			const desktopMetadata = marketingUsageReviewPackageSchema.parse(
				JSON.parse(await readFile(path, "utf8"))
			);
			expect({
				...desktopMetadata,
				record: {
					...desktopMetadata.record,
					id: webMetadata.record.id,
					createdAt: webMetadata.record.createdAt,
				},
			}).toEqual(webMetadata);
		} finally {
			await rm(path, { force: true });
		}
	});
});
