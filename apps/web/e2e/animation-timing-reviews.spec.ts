import { expect, test } from "@playwright/test";
import { prepareAnimationTimingReviewWorkspace } from "./animation-timing-review-fixture";

const fourDirectionReviewName = /Walk cycle · 4 yön · Takip gerekli/;
const eightDirectionReviewName = /Run cycle · 8 yön · Tutarlı/;

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
	await review.getByLabel("Animasyon adı").fill("Walk cycle");
	await review.getByLabel("Oynatma hızı").fill("2");
	for (const [index, timing] of fourDirectionTimings.entries()) {
		const direction = review.getByRole("group", { name: `Yön ${index + 1}` });
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each direction must occur in order.
		await direction
			.getByLabel(`Yön ${index + 1} kare 1 kimliği`, { exact: true })
			.fill(`${timing.direction}-contact`);
		await direction
			.getByLabel(`Yön ${index + 1} kare 1 sürümü`, { exact: true })
			.selectOption({ label: versionLabel });
		await direction
			.getByLabel(`Yön ${index + 1} kare 1 süre (ms)`)
			.fill(String(timing.firstMs));
		await direction
			.getByLabel(`Yön ${index + 1} kare 1 hareket evresi`)
			.fill(timing.firstPhase);
		await direction.getByRole("button", { name: "Kare ekle" }).click();
		await direction
			.getByLabel(`Yön ${index + 1} kare 2 kimliği`, { exact: true })
			.fill(`${timing.direction}-recovery`);
		await direction
			.getByLabel(`Yön ${index + 1} kare 2 sürümü`, { exact: true })
			.selectOption({ label: versionLabel });
		await direction
			.getByLabel(`Yön ${index + 1} kare 2 süre (ms)`)
			.fill(String(timing.secondMs));
		await direction
			.getByLabel(`Yön ${index + 1} kare 2 hareket evresi`)
			.fill(timing.secondPhase);
	}

	const north = review.getByRole("group", { name: "Yön 3" });
	await north
		.getByRole("button", { name: "Kareyi yukarı taşı" })
		.nth(1)
		.click();
	const playhead = review.getByLabel("Oynatma konumu (ms)");
	await playhead.fill("110");
	await expect(review.getByLabel("Oynatma konumu (ms)")).toHaveValue("110");
	await expect(review.getByRole("group", { name: "Yön 1" })).toContainText(
		"south · Kare 2 · south-recovery · 220 ms · Recovery"
	);
	await expect(review.getByRole("group", { name: "Yön 2" })).toContainText(
		"west · Kare 1 · west-contact · 120 ms · Wind-up"
	);
	await expect(review.getByRole("group", { name: "Yön 3" })).toContainText(
		"north · Kare 1 · north-recovery · 200 ms · Recovery"
	);

	await playhead.fill("310");
	await review.getByLabel("Döngüde oynat").uncheck();
	await expect(review.getByRole("group", { name: "Yön 1" })).toContainText(
		"south · Kare 2 · south-recovery · 220 ms · Recovery"
	);
	await expect(
		review
			.getByRole("group", { name: "Yön 1" })
			.getByText("Döngü sınırı · son kare → ilk kare")
	).toHaveCount(0);
	await review.getByLabel("Döngüde oynat").check();
	await expect(review.getByRole("group", { name: "Yön 1" })).toContainText(
		"south · Kare 1 · south-contact · 80 ms · Contact"
	);
	await expect(
		review
			.getByRole("group", { name: "Yön 1" })
			.getByText("Döngü sınırı · son kare → ilk kare")
	).toBeVisible();
	await expect(review.getByRole("group", { name: "Yön 2" })).toContainText(
		"west · Kare 2 · west-recovery · 280 ms · Impact"
	);

	await review.getByRole("button", { name: "Başa dön" }).click();
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
	await review.getByRole("button", { name: "Başa dön" }).click();

	await review.getByLabel("İnceleme sonucu").selectOption("needs_follow_up");
	await review
		.getByLabel("Gerekçe", { exact: true })
		.fill("The directions reach their recovery frames at different times.");
	const saveButton = review.getByRole("button", { name: "İncelemeyi kaydet" });
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await expect(
		review.getByText("İnceleme kalıcı kayıttan doğrulandı.")
	).toBeVisible();

	await page.reload();
	const fourDirectionRecord = review.getByRole("button", {
		name: fourDirectionReviewName,
	});
	await fourDirectionRecord.click();
	await expect(review.getByLabel("Oynatma hızı")).toHaveValue("2");
	await expect(review.getByLabel("Döngüde oynat")).toBeChecked();
	await expect(review.getByLabel("Yön 1 kare 2 süre (ms)")).toHaveValue("220");
	await expect(review.getByLabel("Yön 2 kare 1 hareket evresi")).toHaveValue(
		"Wind-up"
	);
	await expect(review.getByLabel("Yön 3 kare 1 kimliği")).toHaveValue(
		"north-recovery"
	);
	await expect(review.getByLabel("Yön 3 kare 1 süre (ms)")).toHaveValue("200");
	await expect(review.getByLabel("Yön 4 kare 2 hareket evresi")).toHaveValue(
		""
	);
	await expect(review.getByLabel("Gerekçe", { exact: true })).toHaveValue(
		"The directions reach their recovery frames at different times."
	);
	await expect(saveButton).toBeDisabled();

	await review.getByRole("button", { name: "Yeni inceleme" }).click();
	await review.getByLabel("Yön sayısı").selectOption("8");
	await review.getByLabel("Animasyon adı").fill("Run cycle");
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
		const direction = review.getByRole("group", { name: `Yön ${index + 1}` });
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each direction must occur in order.
		await direction
			.getByLabel(`Yön adı ${index + 1}`, { exact: true })
			.fill(directionName);
		await direction
			.getByLabel(`Yön ${index + 1} kare 1 kimliği`, { exact: true })
			.fill(`${directionName}-run`);
		await direction
			.getByLabel(`Yön ${index + 1} kare 1 sürümü`, { exact: true })
			.selectOption({ label: versionLabel });
	}
	await review.getByLabel("İnceleme sonucu").selectOption("consistent");
	await review
		.getByLabel("Gerekçe", { exact: true })
		.fill("Eight directions reviewed.");
	await expect(saveButton).toBeEnabled();
	await saveButton.click();
	await expect(
		review.getByText("İnceleme kalıcı kayıttan doğrulandı.")
	).toBeVisible();
	await page.reload();
	await review.getByRole("button", { name: eightDirectionReviewName }).click();
	await expect(review.getByLabel("Yön sayısı")).toHaveValue("8");
	await expect(review.getByLabel("Yön 8 kare 1 kimliği")).toHaveValue(
		"south-east-run"
	);
});
