import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { marketingUsageReviewPackageSchema } from "@sprite-anvil/api/marketing-usage-reviews";
import { prepareAssetFamilyWorkspace } from "./asset-family-workspace-fixture";
import {
	marketingUsageFixture as fixture,
	readMarketingPreviewPresentation,
} from "./marketing-usage-review-fixture";

test("persists separate logo/store evidence with crop, safe area, background modes and small noninteger scale", async ({
	page,
}) => {
	test.skip(
		!(
			process.env.CONTEXT_TEST_DATABASE_URL &&
			process.env.CONTEXT_TEST_R2_MODE === "memory"
		),
		"An isolated database and test image storage are required."
	);
	test.setTimeout(240_000);
	page.setDefaultTimeout(20_000);
	const png = await readFile(
		new URL("./fixtures/marketing-usage.png", import.meta.url)
	);
	const { familyUrl } = await prepareAssetFamilyWorkspace(page, {
		...fixture,
		png,
	});
	const review = page
		.getByRole("heading", {
			name: "Logo ve Tanıtım Kullanımlarını Sınama · Anvil marketing",
		})
		.locator("..");
	await expect(review.getByRole("img")).toHaveCount(2);
	await review.getByLabel("displaySize width").fill("77");
	await review.getByLabel("displaySize height").fill("51");
	await review.getByLabel("safeArea x").fill("20");
	await review.getByLabel("safeArea y").fill("20");
	await review.getByLabel("safeArea width").fill("260");
	await review.getByLabel("safeArea height").fill("150");
	await review.getByLabel("crop x").fill("10");
	await review.getByLabel("crop y").fill("5");
	await review.getByLabel("crop width").fill("281");
	await review.getByLabel("crop height").fill("189");
	await review
		.getByLabel("Gözlem")
		.nth(0)
		.fill("Lettering crosses the safe area on light background.");
	await review
		.getByLabel("Gözlem")
		.nth(1)
		.fill("Small logo remains legible on dark background.");
	await review.getByLabel("Güvenli alan sonucu").nth(0).selectOption("failed");
	await review
		.getByLabel("Küçük boyutta okunurluk")
		.nth(1)
		.selectOption("passed");
	await expect(
		review.getByRole("button", { name: "Kullanım incelemesini kaydet" })
	).toBeEnabled();
	await review
		.getByRole("button", { name: "Kullanım incelemesini kaydet" })
		.click();
	await expect(
		review.getByText("İnceleme kalıcı kayıttan doğrulandı.")
	).toBeVisible();
	await review.getByLabel("Kullanım amacı").selectOption("store");
	await review.getByLabel("Sunum", { exact: true }).selectOption("opaque");
	await review.getByLabel("Opak zemin rengi").fill("#ffcc00");
	await expect(
		review.getByRole("button", { name: "Kullanım incelemesini kaydet" })
	).toBeEnabled();
	const previews = await page.evaluate(readMarketingPreviewPresentation);
	expect(
		previews.every((preview) => preview.ready && preview.rendering === "auto")
	).toBe(true);
	await review
		.getByRole("button", { name: "Kullanım incelemesini kaydet" })
		.click();
	await expect(
		review.getByRole("button", { name: "Kullanım kanıtını indir" })
	).toHaveCount(2);
	await review.screenshot({
		path: "../../.context/marketing-usage-browser.png",
	});
	await page.reload();
	await page
		.getByRole("button", { name: "Profil incelemeleri", exact: true })
		.click();
	await expect(
		review.getByRole("button", { name: "Kullanım kanıtını indir" })
	).toHaveCount(2);
	const downloadPromise = page.waitForEvent("download");
	await review
		.getByRole("button", { name: "Kullanım kanıtını indir" })
		.first()
		.click();
	const download = await downloadPromise;
	const metadata = marketingUsageReviewPackageSchema.parse(
		JSON.parse(await readFile((await download.path()) ?? "", "utf8"))
	);
	expect(metadata.record.items[0]).toMatchObject({
		usePurpose: "store",
		presentation: "opaque",
		opaqueColor: "#ffcc00",
		naturalSize: { width: 301, height: 199 },
		displaySize: { width: 77, height: 51 },
		crop: { x: 10, y: 5, width: 281, height: 189 },
		safeArea: { x: 20, y: 20, width: 260, height: 150 },
	});
	if (process.env.MARKETING_USAGE_WEB_RESULT) {
		await writeFile(
			process.env.MARKETING_USAGE_WEB_RESULT,
			JSON.stringify({
				familyPath: new URL(familyUrl).pathname,
				metadata,
				previews,
			})
		);
	}
});
