import { expect, test } from "@playwright/test";

test("loads the web application shell", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "API Status" })).toBeVisible();
});
