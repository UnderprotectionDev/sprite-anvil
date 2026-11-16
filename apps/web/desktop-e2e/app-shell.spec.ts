import { $, expect } from "@wdio/globals";

describe("Tauri application shell", () => {
	it("opens the application shell", async () => {
		const brandLink = await $("a=Sprite Anvil");
		await brandLink.waitForDisplayed();
		await expect(brandLink).toBeDisplayed();

		const startHeading = await $("h1=Manage your game visuals in one place.");
		await startHeading.waitForDisplayed();
	});
});
