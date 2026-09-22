import { $, browser, expect } from "@wdio/globals";

describe("Tauri pixel studio", () => {
	it("opens the desktop canvas and saves a local draft", async () => {
		const studioLink = await $("a=Studio");
		await studioLink.waitForDisplayed();
		await studioLink.click();
		const heading = await $("h1=Pixel studio");
		await heading.waitForDisplayed();
		const save = await $("button=Save local draft");
		await save.click();
		const status = await $("p[role=status]");
		await expect(status).toHaveText("Draft saved on this device.");
		const dataUrl = await browser.execute(() => {
			const canvas = document.querySelector(
				"canvas[aria-label='Pixel drawing canvas']"
			);
			return canvas instanceof HTMLCanvasElement
				? canvas.toDataURL("image/png")
				: "missing canvas";
		});
		await expect(dataUrl).toContain("data:image/png;base64,");
		const exportButton = await $("button=Export PNG");
		await exportButton.click();
		await expect(status).toHaveText("PNG saved in the app data folder.");
	});
});
