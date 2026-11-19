import { expect, test } from "@playwright/test";
import { prepareAnimationTimingReviewWorkspace } from "./animation-timing-review-fixture";

const fourDirectionReviewName = /Walk cycle · 4 directions · Needs follow-up/u;
const eightDirectionReviewName = /Run cycle · 8 directions · Consistent/u;

test("compares variable frame timing and persists four- and eight-direction reviews", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);
	test.setTimeout(180_000);

	const { review, versionLabel } =
		await prepareAnimationTimingReviewWorkspace(page);
	const fourDirectionTimings = [
		{
			direction: "south",
			firstMs: 80,
			firstPhase: "Contact",
			secondMs: 220,
			secondPhase: "Recovery",
		},
		{
			direction: "west",
			firstMs: 120,
			firstPhase: "Wind-up",
			secondMs: 280,
			secondPhase: "Impact",
		},
		{
			direction: "north",
			firstMs: 100,
			firstPhase: "Contact",
			secondMs: 200,
			secondPhase: "Recovery",
		},
		{
			direction: "east",
			firstMs: 70,
			firstPhase: "Lift",
			secondMs: 300,
			secondPhase: "",
		},
	];
	await review.getByLabel("Animation name").fill("Walk cycle");
	await review.getByLabel("Playback speed").fill("2");
	for (const [index, timing] of fourDirectionTimings.entries()) {
		const direction = review.getByRole("group", {
			name: `Direction ${index + 1}`,
		});
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each direction must occur in order.
		await direction
			.getByLabel(`Direction ${index + 1} frame 1 ID`, { exact: true })
			.fill(`${timing.direction}-contact`);
		await direction
			.getByLabel(`Direction ${index + 1} frame 1 version`, { exact: true })
			.selectOption({ label: versionLabel });
		await direction
			.getByLabel(`Direction ${index + 1} frame 1 duration (ms)`)
			.fill(String(timing.firstMs));
		await direction
			.getByLabel(`Direction ${index + 1} frame 1 motion phase`)
			.fill(timing.firstPhase);
		await direction.getByRole("button", { name: "Add frame" }).click();
		await direction
			.getByLabel(`Direction ${index + 1} frame 2 ID`, { exact: true })
			.fill(`${timing.direction}-recovery`);
		await direction
			.getByLabel(`Direction ${index + 1} frame 2 version`, { exact: true })
			.selectOption({ label: versionLabel });
		await direction
			.getByLabel(`Direction ${index + 1} frame 2 duration (ms)`)
			.fill(String(timing.secondMs));
		await direction
			.getByLabel(`Direction ${index + 1} frame 2 motion phase`)
			.fill(timing.secondPhase);
	}

	const north = review.getByRole("group", { name: "Direction 3" });
	await north.getByRole("button", { name: "Move frame up" }).nth(1).click();
	const playhead = review.getByLabel("Playback position (ms)");
	await playhead.fill("110");
	await expect(review.getByLabel("Playback position (ms)")).toHaveValue("110");
	await expect(
		review.getByRole("group", { name: "Direction 1" })
	).toContainText("south · Frame 2 · south-recovery · 220 ms · Recovery");
	await expect(
		review.getByRole("group", { name: "Direction 2" })
	).toContainText("west · Frame 1 · west-contact · 120 ms · Wind-up");
	await expect(
		review.getByRole("group", { name: "Direction 3" })
	).toContainText("north · Frame 1 · north-recovery · 200 ms · Recovery");

	await playhead.fill("310");
	await review.getByLabel("Loop playback").uncheck();
	await expect(
		review.getByRole("group", { name: "Direction 1" })
	).toContainText("south · Frame 2 · south-recovery · 220 ms · Recovery");
	await expect(
		review
			.getByRole("group", { name: "Direction 1" })
			.getByText("Loop boundary.")
	).toHaveCount(0);
	await review.getByLabel("Loop playback").check();
	await expect(
		review.getByRole("group", { name: "Direction 1" })
	).toContainText("south · Frame 1 · south-contact · 80 ms · Contact");
	await expect(
		review
			.getByRole("group", { name: "Direction 1" })
			.getByText("Loop boundary.")
	).toBeVisible();
	await expect(
		review.getByRole("group", { name: "Direction 2" })
	).toContainText("west · Frame 2 · west-recovery · 280 ms · Impact");

	await review.getByRole("button", { name: "Restart" }).click();
	await expect(playhead).toHaveValue("0");
	await review.getByRole("button", { name: "Birlikte oynat" }).click();
	await expect(review.getByRole("button", { name: "Duraklat" })).toBeVisible();
	await expect
		.poll(async () => Number(await playhead.inputValue()), { timeout: 3000 })
		.toBeGreaterThan(0);
	await review.getByRole("button", { name: "Duraklat" }).click();
	const pausedAt = await playhead.inputValue();
	await page.waitForTimeout(100);
	await expect(playhead).toHaveValue(pausedAt);
	await review.getByRole("button", { name: "Restart" }).click();

	await review.getByLabel("Review result").selectOption("needs_follow_up");
	await review
		.getByLabel("Rationale", { exact: true })
		.fill("The directions reach their recovery frames at different times.");
	const saveButton = review.getByRole("button", { name: "Save review" });
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await expect(
		review.getByText("Review verified from the saved record.")
	).toBeVisible();

	await page.reload();
	await page
		.getByRole("button", { name: "Profile reviews", exact: true })
		.click();
	const fourDirectionRecord = review.getByRole("button", {
		name: fourDirectionReviewName,
	});
	await fourDirectionRecord.click();
	await expect(review.getByLabel("Playback speed")).toHaveValue("2");
	await expect(review.getByLabel("Loop playback")).toBeChecked();
	await expect(
		review.getByLabel("Direction 1 frame 2 duration (ms)")
	).toHaveValue("220");
	await expect(
		review.getByLabel("Direction 2 frame 1 motion phase")
	).toHaveValue("Wind-up");
	await expect(review.getByLabel("Direction 3 frame 1 ID")).toHaveValue(
		"north-recovery"
	);
	await expect(
		review.getByLabel("Direction 3 frame 1 duration (ms)")
	).toHaveValue("200");
	await expect(
		review.getByLabel("Direction 4 frame 2 motion phase")
	).toHaveValue("");
	await expect(review.getByLabel("Rationale", { exact: true })).toHaveValue(
		"The directions reach their recovery frames at different times."
	);
	await expect(saveButton).toBeDisabled();

	await review.getByRole("button", { name: "New review" }).click();
	await review.getByLabel("Direction count").selectOption("8");
	await review.getByLabel("Animation name").fill("Run cycle");
	const eightDirections = [
		"south",
		"south-west",
		"west",
		"north-west",
		"north",
		"north-east",
		"east",
		"south-east",
	];
	for (const [index, directionName] of eightDirections.entries()) {
		const direction = review.getByRole("group", {
			name: `Direction ${index + 1}`,
		});
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each direction must occur in order.
		await direction
			.getByLabel(`Direction name ${index + 1}`, { exact: true })
			.fill(directionName);
		await direction
			.getByLabel(`Direction ${index + 1} frame 1 ID`, { exact: true })
			.fill(`${directionName}-run`);
		await direction
			.getByLabel(`Direction ${index + 1} frame 1 version`, { exact: true })
			.selectOption({ label: versionLabel });
	}
	await review.getByLabel("Review result").selectOption("consistent");
	await review
		.getByLabel("Rationale", { exact: true })
		.fill("Eight directions reviewed.");
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await expect(
		review.getByText("Review verified from the saved record.")
	).toBeVisible();
	await page.reload();
	await page
		.getByRole("button", { name: "Profile reviews", exact: true })
		.click();
	await review.getByRole("button", { name: eightDirectionReviewName }).click();
	await expect(review.getByLabel("Direction count")).toHaveValue("8");
	await expect(review.getByLabel("Direction 8 frame 1 ID")).toHaveValue(
		"south-east-run"
	);
});
