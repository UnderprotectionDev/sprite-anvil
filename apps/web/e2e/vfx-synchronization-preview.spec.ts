import { expect, test } from "@playwright/test";
import { animationTimingFixture } from "./animation-timing-review-fixture";

test.setTimeout(120_000);

test("renders the owner event on four backgrounds and submits exact user review values", async ({
	page,
}) => {
	await page.route("**/vfx-fixture/*.png", (route) =>
		route.fulfill({
			status: 200,
			contentType: "image/png",
			headers: {
				"Access-Control-Allow-Origin": new URL(page.url()).origin,
				"Access-Control-Allow-Credentials": "true",
			},
			body: animationTimingFixture.png,
		})
	);
	await page.goto("/e2e/fixtures/vfx-synchronization.html");
	const play = page.getByRole("button", { name: "Play", exact: true });
	await expect(play)
		.toBeEnabled({ timeout: 60_000 })
		.catch(async (error) => {
			console.log(await page.locator("body").innerText());
			throw error;
		});
	const canvas = page.getByRole("img", {
		name: "VFX synchronized pixel preview",
	});
	const before = await canvas.screenshot();
	await page.getByLabel("Timeline (ms)").fill("150");
	expect(await canvas.screenshot()).not.toEqual(before);
	await page.getByLabel("Background", { exact: true }).selectOption("scene");
	expect(await canvas.screenshot()).not.toEqual(before);
	await page.getByLabel("Background", { exact: true }).selectOption("light");
	await page.getByLabel("Background", { exact: true }).selectOption("dark");
	await page.getByLabel("Playback mode").selectOption("alone");
	await expect(page.getByLabel("Timeline (ms)")).toHaveValue("0");
	await play.click();
	await expect
		.poll(async () =>
			Number(await page.getByLabel("Timeline (ms)").inputValue())
		)
		.toBeGreaterThan(0);
	await page.getByRole("button", { name: "Pause", exact: true }).click();
	const paused = await page.getByLabel("Timeline (ms)").inputValue();
	await page.waitForTimeout(80);
	await expect(page.getByLabel("Timeline (ms)")).toHaveValue(paused);
	await page.getByRole("button", { name: "Restart" }).click();
	await expect(page.getByLabel("Timeline (ms)")).toHaveValue("0");
	await page.getByLabel("Zoom", { exact: true }).selectOption("4");
	const save = page.getByRole("button", {
		name: "Save synchronization review",
	});
	await expect(save).toBeDisabled();
	for (const background of ["transparent", "light", "dark", "scene"]) {
		const group = page.getByRole("group", { name: background, exact: true });
		// biome-ignore lint/performance/noAwaitInLoops: Each human evidence field is filled in visible order.
		await group.getByLabel("Effect alone result").selectOption("passed");
		await group.getByLabel("With owner result").selectOption("passed");
		await group
			.getByLabel("Playback notes")
			.fill("Origin, layer and timing reviewed.");
	}
	await page.getByLabel("Review rationale").fill("Release occurs at 150 ms.");
	await expect(save).toBeEnabled();
	await page
		.getByRole("group", { name: "Effect frame 1", exact: true })
		.getByLabel("Duration (ms)")
		.fill("0");
	await expect(save).toBeDisabled();
	await page
		.getByRole("group", { name: "Effect frame 1", exact: true })
		.getByLabel("Duration (ms)")
		.fill("80");
	await expect(save).toBeEnabled();
	await save.click();
	const submitted = JSON.parse(
		await page.getByLabel("Submitted review").innerText()
	);
	expect(submitted.event).toEqual({ id: "spell-release", timeMs: 150 });
	expect(
		submitted.effect.frames.map((f: { durationMs: number }) => f.durationMs)
	).toEqual([80, 220]);
	if (process.env.VFX_SCREENSHOT_PATH) {
		await page.screenshot({
			path: process.env.VFX_SCREENSHOT_PATH,
			fullPage: true,
		});
	}
});
