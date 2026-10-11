import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { signUpWithFixture } from "./project-workflow";

const profileActivationButtonName = /Sözleşme v.*etkinleştir/;
const profileLabel = "Karo setleri, arazi ve kesintisiz dokular";

test("reviews exact texture edges and all three arrangements, then rereads metadata after reload", async ({
	page,
}) => {
	test.setTimeout(240_000);
	await signUpWithFixture(page, {
		userName: "Texture review owner",
		email: `texture-review-${crypto.randomUUID()}@example.test`,
		password: "TextureReview-Password-1",
	});
	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill("Texture review project");
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill("Seamless pixel surfaces");
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await page.getByLabel("Görsel Dünya adı").fill("Texture world");
	await page.getByRole("button", { name: "Görsel Dünya ekle" }).click();
	await expect(
		page.locator(".scope-record-list").getByText("Texture world")
	).toBeVisible();
	await page.goto("/projects");
	await page.getByRole("link", { name: "Varlık Aileleri" }).click();
	await page.getByLabel("Varlık Kimliği adı").fill("Grass surface");
	await page.getByRole("button", { name: "Varlık Kimliği oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: "Grass surface" })
	).toBeVisible();
	await page.getByLabel("Varlık Ailesi adı").fill("Grass textures");
	await page
		.getByLabel("Görsel Dünya")
		.selectOption({ label: "Texture world" });
	await page.getByLabel("Kullanım bağlamı").fill("Repeated terrain surface");
	await page.getByRole("button", { name: "Varlık Ailesi oluştur" }).click();
	await expect(
		page
			.getByRole("region", { name: "Kaydedilmiş Varlık Aileleri" })
			.getByRole("heading", { name: "Grass textures", exact: true })
	).toBeVisible();
	const familyUrl = page.url();
	await page.getByLabel("Bağımsız ürün anlamı", { exact: true }).check();
	await page.getByLabel("Varlık Kaydı adı").fill("Grass texture");
	await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
	await page.getByRole("link", { name: "Varlık Sürümü yükle" }).click();
	await page
		.getByLabel("Varlık kategorisi")
		.selectOption({ label: profileLabel });
	await page.getByRole("button", { name: "Metadata’yı kaydet" }).click();
	await expect(
		page.getByText("Varlık kaydı metadata’sı kaydedildi.")
	).toBeVisible();
	const file = {
		name: "grass.png",
		mimeType: "image/png",
		buffer: await readFile(
			new URL("./fixtures/texture-repetition.png", import.meta.url)
		),
	};
	await page.getByLabel("PNG veya WebP dosyası").setInputFiles(file);
	await page
		.getByLabel("Bilinmeyen üretim geçmişi")
		.fill("Browser texture fixture");
	await page
		.getByLabel("Bilinen kaynak", { exact: true })
		.fill("Authored fixture");
	await page.getByLabel("Varlıkla ilişkiniz").selectOption("created_by_user");
	await page
		.getByRole("button", { name: "Aday sürümü kaydet", exact: true })
		.click();
	await expect(
		page.getByText("Aday Sürüm kaydedildi.", { exact: true })
	).toBeVisible();
	await page.goto(familyUrl);
	await page.getByLabel("Birim türü").selectOption("tile");
	await page.getByLabel("Birim adı").fill("grass");
	await page
		.getByLabel("Kaynak Varlık Sürümü")
		.selectOption({ label: "Sürüm 1 · Aday" });
	await page.getByLabel("Düzeltilmiş PNG veya WebP").setInputFiles(file);
	await page.getByRole("button", { name: "Birim düzeltmesini kaydet" }).click();
	await expect(
		page.getByText("grass · Birim Sürümü 1", { exact: false })
	).toBeVisible();
	await page.goto(familyUrl);
	const profile = page
		.getByRole("heading", { name: profileLabel, exact: true })
		.locator("xpath=ancestor::li[1]");
	await profile
		.getByRole("button", { name: profileActivationButtonName })
		.click();
	const review = page
		.getByRole("heading", { name: "Texture repetition · Grass textures" })
		.locator("..");
	await expect(review.getByRole("img")).toHaveCount(3);
	await expect(
		review.getByRole("button", { name: "Save texture review" })
	).toBeEnabled();
	// Crop a uniform 4×4 tile from an 8×8 atlas; default shift is two pixels.
	await review.getByLabel("Atlas width").fill("4");
	await review.getByLabel("Atlas height").fill("4");
	await review.getByLabel("Terrain ID").fill("grass-terrain");
	await review.getByLabel("Preview zoom").selectOption("8");
	await review.getByRole("button", { name: "Check exact edges" }).click();
	await expect(review.getByText("X edge: 0 mismatched pixels")).toBeVisible();
	for (const arrangement of ["2x2", "3x3", "shifted"]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser observations must be entered in order.
		await review.getByLabel(`${arrangement} outcome`).selectOption("passed");
		await review
			.getByLabel(`${arrangement} notes`)
			.fill("Uniform color repeats without a visible motif.");
	}
	await review.getByRole("button", { name: "Save texture review" }).click();
	await expect(review.getByText("Texture review saved.")).toBeVisible();
	await review.getByRole("img").first().locator("xpath=../../..").screenshot({
		path: "../../.context/texture-repetition-browser.png",
	});
	await page.reload();
	await expect(
		review.getByText(
			"shifted: passed — Uniform color repeats without a visible motif."
		)
	).toBeVisible();
	const downloadPromise = page.waitForEvent("download");
	await review
		.getByRole("button", { name: "Download texture metadata" })
		.click();
	const download = await downloadPromise;
	const path = await download.path();
	expect(path).toBeTruthy();
	const metadata = JSON.parse(await readFile(path ?? "", "utf8"));
	expect(metadata.tileset.terrain_id).toBe("grass-terrain");
	expect(metadata.tileset.tiles[0].atlas_region).toEqual({
		x: 0,
		y: 0,
		width: 4,
		height: 4,
	});
	expect(metadata.texture.repeat_axes).toEqual(["x", "y"]);
});
