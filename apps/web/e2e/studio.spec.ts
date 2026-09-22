import { expect, test } from "@playwright/test";

test("draws and saves a recoverable local draft", async ({ page }) => {
	await page.goto("/studio");
	await expect(
		page.getByRole("heading", { name: "Pixel studio" })
	).toBeVisible();
	await page
		.getByLabel("Pixel drawing canvas")
		.click({ position: { x: 10, y: 10 } });
	const paintedAlpha = await page
		.getByLabel("Pixel drawing canvas")
		.evaluate(
			(canvas) =>
				(canvas as HTMLCanvasElement).getContext("2d")?.getImageData(0, 0, 1, 1)
					.data[3]
		);
	expect(paintedAlpha).toBe(255);
	await page.getByRole("button", { name: "Save local draft" }).click();
	await expect(page.locator("p[role=status]")).toHaveText(
		"Draft saved on this device."
	);
	await expect(
		page.getByRole("button", { name: "Frame 1", exact: true })
	).toHaveCount(2);
	await page.reload();
	await page
		.getByRole("heading", { name: "Local drafts" })
		.locator("..")
		.getByRole("button", { name: "Frame 1" })
		.click();
	const restoredAlpha = await page
		.getByLabel("Pixel drawing canvas")
		.evaluate(
			(canvas) =>
				(canvas as HTMLCanvasElement).getContext("2d")?.getImageData(0, 0, 1, 1)
					.data[3]
		);
	expect(restoredAlpha).toBe(255);
});
