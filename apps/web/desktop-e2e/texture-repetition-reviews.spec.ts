import { access, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { textureRepetitionPackageSchema } from "@sprite-anvil/api/texture-repetition-reviews";
import { $, browser, expect } from "@wdio/globals";
import {
	textureRepetitionFixture as fixture,
	readTexturePreviewPresentation,
} from "../e2e/texture-repetition-review-fixture";

// The embedded macOS driver clicks <option> without dispatching change.
// Drive the native select's standard DOM change event so React receives it.
async function selectOption(selector: string, value: string) {
	await browser.execute(
		(query, selection) => {
			const input = document.querySelector(query);
			if (!(input instanceof HTMLSelectElement)) {
				throw new Error("Native select was not found.");
			}
			input.value = selection;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		},
		selector,
		value
	);
	await expect($(selector)).toHaveValue(value);
}

describe("Texture repetition surface equivalence", () => {
	afterEach(async function () {
		if (this.currentTest?.state === "failed") {
			await browser.saveScreenshot(
				"../../.context/texture-repetition-desktop-failure.png"
			);
		}
	});
	it("reviews the same exact web Unit Version and downloads equivalent metadata on desktop", async function () {
		const resultPath = process.env.TEXTURE_REPETITION_WEB_RESULT;
		if (!(resultPath || process.env.TEXTURE_REPETITION_E2E_EMAIL)) {
			this.skip();
			return;
		}
		if (!(resultPath && process.env.CONTEXT_TEST_DATABASE_URL)) {
			throw new Error(
				"Run bun run test:e2e:texture-repetition to prepare the shared web and desktop fixture."
			);
		}
		const result = JSON.parse(await readFile(resultPath, "utf8"));
		const webMetadata = textureRepetitionPackageSchema.parse(result.metadata);
		const initialUrl = new URL(await browser.getUrl());
		const origin = `${initialUrl.protocol}//${initialUrl.host}`;
		await browser.url(`${origin}/login`);
		await $("h2=Welcome Back").waitForDisplayed();
		await $("input[name='email']").setValue(fixture.email);
		await $("input[name='password']").setValue(fixture.password);
		await $("form button[type='submit']").click();
		await $("h1=Oyun projeleri").waitForDisplayed();
		await browser.url(`${origin}${result.familyPath}`);
		let review = await $("h3=Texture repetition · Grass textures").$("..");
		await review.waitForDisplayed({ timeout: 20_000 });
		await expect(review.$("select[id$='-unit']")).toHaveValue(
			webMetadata.record.unitVersionId
		);
		await review
			.$("input[id$='-width']")
			.setValue(String(fixture.atlasRegion.width));
		await review
			.$("input[id$='-height']")
			.setValue(String(fixture.atlasRegion.height));
		await review.$("input[id$='-terrain']").setValue(fixture.terrainId);
		await selectOption("select[id$='-axes']", "xy");
		await review
			.$("input[id$='-shift-x']")
			.setValue(String(fixture.shiftedOffset.x));
		await review
			.$("input[id$='-shift-y']")
			.setValue(String(fixture.shiftedOffset.y));
		await selectOption("select[id$='-zoom']", "8");
		await expect(review.$$("[role='img']")).toBeElementsArrayOfSize(3);
		await browser.waitUntil(
			async () => await review.$("button=Save texture review").isEnabled(),
			{ timeout: 20_000 }
		);
		await review.$("button=Check exact edges").click();
		await review.$("p=X edge: 0 mismatched pixels").waitForDisplayed();
		await review.$("p=Y edge: 0 mismatched pixels").waitForDisplayed();
		for (const index of [0, 1, 2]) {
			// biome-ignore lint/performance/noAwaitInLoops: Each visible observation must be entered in order.
			await selectOption(`select[id$='-outcome-${index}']`, "passed");
			await review.$(`textarea[id$='-notes-${index}']`).setValue(fixture.notes);
		}
		expect(await browser.execute(readTexturePreviewPresentation)).toEqual(
			result.previews
		);
		await review.$("button=Save texture review").click();
		await review.$("p=Texture review saved.").waitForDisplayed();
		await browser.refresh();
		review = await $("h3=Texture repetition · Grass textures").$("..");
		await browser.waitUntil(
			async () => (await review.$$("article").length) === 2,
			{ timeout: 20_000 }
		);
		const latest = await review.$("article");
		expect(await latest.getText()).toContain(
			`shifted: passed — ${fixture.notes}`
		);
		await latest.scrollIntoView();
		await browser.saveScreenshot(
			"../../.context/texture-repetition-desktop.png"
		);
		// Observe the requested filename while retaining the real native click/download.
		await browser.execute(() => {
			const { click } = HTMLAnchorElement.prototype;
			HTMLAnchorElement.prototype.click = function () {
				Reflect.set(window, "textureDownloadFilename", this.download);
				click.call(this);
				HTMLAnchorElement.prototype.click = click;
			};
		});
		await latest.$("button=Download texture metadata").click();
		const filename = await browser.execute(
			() => Reflect.get(window, "textureDownloadFilename") as string
		);
		if (!filename?.startsWith("texture-repetition-")) {
			throw new Error(
				"The texture download did not request its expected filename."
			);
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
				{
					timeout: 20_000,
					timeoutMsg: "Native texture metadata download did not create a file.",
				}
			);
			const desktopMetadata = textureRepetitionPackageSchema.parse(
				JSON.parse(await readFile(path, "utf8"))
			);
			expect(desktopMetadata.record.id).not.toEqual(webMetadata.record.id);
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
