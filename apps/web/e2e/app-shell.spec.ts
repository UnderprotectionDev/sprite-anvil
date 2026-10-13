import { expect, test } from "@playwright/test";

test("loads the web application shell", async ({ page }) => {
	await page.goto("/");

	await expect(page.getByRole("link", { name: "Sprite Anvil" })).toBeVisible();
	await expect(
		page.getByRole("navigation", { name: "Ana gezinme" })
	).toHaveCount(0);
	await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
	await expect(
		page.getByRole("heading", {
			name: "Oyun görsellerinizi tek yerde yönetin.",
		})
	).toBeVisible();
});

test("offers a usable starting action on the landing page", async ({
	page,
}) => {
	await page.goto("/");
	await expect(
		page.getByRole("heading", {
			name: "Oyun görsellerinizi tek yerde yönetin.",
		})
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Başlamak için giriş yap" })
	).toBeVisible();
});
