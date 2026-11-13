import { expect, test } from "@playwright/test";

const startLink = "Başlamak için giriş yap";

async function transitionSeconds(
	page: import("@playwright/test").Page,
	name: string
) {
	return await page.getByRole("link", { name }).evaluate((element) => {
		const [first = "0s"] =
			getComputedStyle(element).transitionDuration.split(",");
		return Number.parseFloat(first);
	});
}

test.describe("with reduced motion requested", () => {
	test.use({ reducedMotion: "reduce" });

	test("interface transitions are effectively removed", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByRole("link", { name: startLink })).toBeVisible();
		expect(await transitionSeconds(page, startLink)).toBeLessThanOrEqual(0.01);
	});
});

test.describe("without a reduced motion request", () => {
	test.use({ reducedMotion: "no-preference" });

	test("interface transitions keep their normal duration", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByRole("link", { name: startLink })).toBeVisible();
		expect(await transitionSeconds(page, startLink)).toBeGreaterThan(0.01);
	});
});
