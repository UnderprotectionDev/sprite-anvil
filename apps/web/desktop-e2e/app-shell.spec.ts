import { $, expect } from "@wdio/globals";

describe("Tauri application shell", () => {
	it("opens the application shell", async () => {
		const brandLink = await $("a=Sprite Anvil");
		await brandLink.waitForDisplayed();
		await expect(brandLink).toBeDisplayed();

		const apiStatusHeading = await $("h2=API Status");
		await apiStatusHeading.waitForDisplayed();
	});
});
