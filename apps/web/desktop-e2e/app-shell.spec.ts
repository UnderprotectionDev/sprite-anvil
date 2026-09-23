import { $, expect } from "@wdio/globals";

describe("Tauri application shell", () => {
	it("opens the home screen", async () => {
		const homeLink = await $("a=Home");
		await homeLink.waitForDisplayed();
		await expect(homeLink).toBeDisplayed();

		const apiStatusHeading = await $("h2=API Status");
		await apiStatusHeading.waitForDisplayed();
	});
});
