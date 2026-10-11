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

test("keeps looping playback running across subsequent owner events and stops a one-shot effect alone", async ({
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
	await page
		.getByRole("group", { name: "Owner frame 1", exact: true })
		.getByLabel("Duration (ms)")
		.fill("400");
	const play = page.getByRole("button", { name: "Play", exact: true });
	await expect(play).toBeEnabled();
	await play.click();
	await expect
		.poll(async () =>
			Number(await page.getByLabel("Timeline (ms)").inputValue())
		)
		.toBeGreaterThan(800);
	await page.getByRole("button", { name: "Pause", exact: true }).click();
	const paused = await page.getByLabel("Timeline (ms)").inputValue();
	await page.waitForTimeout(80);
	await expect(page.getByLabel("Timeline (ms)")).toHaveValue(paused);
	await page.getByLabel("Playback mode").selectOption("alone");
	await play.click();
	await expect(play).toBeVisible();
	await expect(page.getByLabel("Timeline (ms)")).toHaveValue("300");
	await page
		.getByRole("group", { name: "Effect", exact: true })
		.getByLabel("Loop", { exact: true })
		.check();
	await expect(play).toBeEnabled();
	await play.click();
	await expect
		.poll(async () =>
			Number(await page.getByLabel("Timeline (ms)").inputValue())
		)
		.toBeGreaterThan(600);
	await page.getByRole("button", { name: "Pause", exact: true }).click();
});

test("shows all corners of a large effect on every background without clipping", async ({
	page,
}) => {
	await page.goto("about:blank");
	const png = await page.evaluate(() => {
		const canvas = document.createElement("canvas");
		canvas.width = 512;
		canvas.height = 512;
		const context = canvas.getContext("2d");
		if (!context) {
			throw new Error("Canvas unavailable");
		}
		context.fillStyle = "#ff0000";
		context.fillRect(0, 0, 16, 16);
		context.fillStyle = "#00ff00";
		context.fillRect(496, 0, 16, 16);
		context.fillStyle = "#0000ff";
		context.fillRect(0, 496, 16, 16);
		context.fillStyle = "#ffff00";
		context.fillRect(496, 496, 16, 16);
		return canvas.toDataURL("image/png").split(",")[1];
	});
	if (!png) {
		throw new Error("Large frame fixture unavailable");
	}
	await page.route("**/vfx-fixture/*.png", (route) =>
		route.fulfill({
			status: 200,
			contentType: "image/png",
			headers: {
				"Access-Control-Allow-Origin": new URL(page.url()).origin,
				"Access-Control-Allow-Credentials": "true",
			},
			body: Buffer.from(png, "base64"),
		})
	);
	await page.goto("/e2e/fixtures/vfx-synchronization.html");
	const frame = page.getByRole("group", {
		name: "Effect frame 1",
		exact: true,
	});
	await frame.getByLabel("Region width").fill("512");
	await frame.getByLabel("Region height").fill("512");
	await frame.getByLabel("Origin x").fill("256");
	await frame.getByLabel("Origin y").fill("256");
	await expect(
		page.getByRole("button", { name: "Play", exact: true })
	).toBeEnabled();
	await page.getByLabel("Playback mode").selectOption("alone");
	await page.getByLabel("Zoom", { exact: true }).selectOption("1");
	const canvas = page.getByRole("img", {
		name: "VFX synchronized pixel preview",
	});
	await expect
		.poll(async () =>
			canvas.evaluate((node) => ({
				width: (node as HTMLCanvasElement).width,
				height: (node as HTMLCanvasElement).height,
			}))
		)
		.toEqual({ width: 528, height: 528 });
	for (const background of ["transparent", "light", "dark", "scene"]) {
		// biome-ignore lint/performance/noAwaitInLoops: Verify each user-selected background separately.
		await page
			.getByLabel("Background", { exact: true })
			.selectOption(background);
		const screenshot = await canvas.screenshot();
		const pixels = await page.evaluate(async (encoded) => {
			const image = new Image();
			image.src = `data:image/png;base64,${encoded}`;
			await image.decode();
			const copy = document.createElement("canvas");
			copy.width = image.width;
			copy.height = image.height;
			const context = copy.getContext("2d");
			if (!context) {
				throw new Error("Canvas unavailable");
			}
			context.drawImage(image, 0, 0);
			const scale = image.width / 528;
			// A screenshot preserves rendered pixels after WebGL clears its drawing buffer.
			return (
				[
					[12, 12],
					[516, 12],
					[12, 516],
					[516, 516],
				] as const
			).map(([x, y]) =>
				Array.from(
					context.getImageData(
						Math.round(x * scale),
						Math.round(y * scale),
						1,
						1
					).data
				)
			);
		}, screenshot.toString("base64"));
		expect(pixels).toEqual([
			[255, 0, 0, 255],
			[0, 255, 0, 255],
			[0, 0, 255, 255],
			[255, 255, 0, 255],
		]);
	}
});
