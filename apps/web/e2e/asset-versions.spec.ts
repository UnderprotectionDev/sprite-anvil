import { expect, test } from "@playwright/test";
import { assetVersionFixture as fixture } from "./asset-version-fixture";

test("uploads and rereads exact Asset and Composite Version lineage", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);

	await page.goto("/login");
	await page.getByLabel("Name").fill(fixture.userName);
	await page.getByLabel("Email").fill(fixture.email);
	await page.getByLabel("Password").fill(fixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill(fixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: "Bağlam Önerisi hazırlayın" })
	).toBeVisible();
	await page.getByLabel("Görsel Dünya adı").fill(fixture.visualWorldName);
	await page.getByRole("button", { name: "Görsel Dünya ekle" }).click();
	await expect(
		page.locator(".scope-record-list").getByText(fixture.visualWorldName)
	).toBeVisible();

	await page.goto("/projects");
	await page.getByRole("link", { name: "Varlık Aileleri" }).click();
	await page.getByLabel("Varlık Kimliği adı").fill(fixture.identityName);
	await page.getByRole("button", { name: "Varlık Kimliği oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: fixture.identityName })
	).toBeVisible();
	await page.getByLabel("Varlık Ailesi adı").fill(fixture.familyName);
	await page.getByLabel("Görsel Dünya").selectOption({
		label: fixture.visualWorldName,
	});
	await page.getByLabel("Kullanım bağlamı").fill(fixture.useContext);
	await page.getByRole("button", { name: "Varlık Ailesi oluştur" }).click();
	await expect(
		page.getByText(fixture.familyName, { exact: true })
	).toBeVisible();

	await page.getByLabel("Varlık Kaydı adı").fill(fixture.sourceName);
	await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
	await page.getByLabel("Varlık Kaydı adı").fill(fixture.derivativeName);
	await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
	await expect(
		page.getByText(fixture.derivativeName, { exact: true })
	).toBeVisible();

	await page
		.getByLabel(`${fixture.sourceName} için Varlık Sürümü dosyası`)
		.setInputFiles({
			name: "ash-knight.png",
			mimeType: "image/png",
			buffer: fixture.png,
		});
	await expect(page.getByText("Sürüm 1 · Aday")).toBeVisible();
	const reviewRationale = "The silhouette matches the family design.";
	await page.getByLabel("İnceleme gerekçesi").fill(reviewRationale);
	await page.getByRole("button", { name: "Onayla" }).click();
	await expect(page.getByText("Sürüm 1 · Onaylandı")).toBeVisible();
	await expect(page.getByText(`— Gerekçe: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await page.getByRole("button", { name: "Ana Tasarım olarak seç" }).click();
	await expect(
		page.getByText("Ana Tasarım: Ash Knight base · Sürüm 1")
	).toBeVisible();

	await page.getByLabel("İlişki türü").selectOption("derivative");
	await expect(
		page.getByText("Ash Knight base · Ana Tasarım Sürüm 1")
	).toBeVisible();
	await page
		.getByLabel("İlgili Varlık Kaydı")
		.selectOption({ label: fixture.derivativeName });
	await page.getByRole("button", { name: "İlişki ekle" }).click();
	await expect(page.getByText(fixture.visibleLineage)).toBeVisible();

	const sourceRecord = page
		.getByRole("heading", { name: fixture.sourceName })
		.locator("xpath=ancestor::li[1]");
	const unitCorrectionType = sourceRecord.getByLabel("Birim türü");
	const unitCorrectionKey = sourceRecord.getByLabel("Birim adı");
	const unitCorrectionSource = sourceRecord.getByLabel("Kaynak Varlık Sürümü");
	const unitCorrectionFile = sourceRecord.getByLabel(
		"Düzeltilmiş PNG veya WebP"
	);
	await unitCorrectionType.selectOption("frame");
	await unitCorrectionKey.fill("attack/frame-3");
	await unitCorrectionSource.selectOption({ label: "Sürüm 1 · Onaylandı" });
	await unitCorrectionFile.setInputFiles({
		name: "attack-frame-3-v1.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page.getByRole("button", { name: "Birim düzeltmesini kaydet" }).click();
	await expect(
		page.getByText("Kare · attack/frame-3 · Birim Sürümü 1")
	).toBeVisible();

	await unitCorrectionType.selectOption("direction");
	await unitCorrectionKey.fill("north");
	await unitCorrectionSource.selectOption({ label: "Sürüm 1 · Onaylandı" });
	await unitCorrectionFile.setInputFiles({
		name: "north-direction-v1.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page.getByRole("button", { name: "Birim düzeltmesini kaydet" }).click();
	await expect(page.getByText("Yön · north · Birim Sürümü 1")).toBeVisible();

	await sourceRecord.getByLabel("Kare · attack/frame-3").selectOption({
		label: "Birim Sürümü 1 · Varlık Sürümü 2 · Aday",
	});
	await sourceRecord.getByLabel("Yön · north").selectOption({
		label: "Birim Sürümü 1 · Varlık Sürümü 3 · Aday",
	});
	await page
		.getByRole("button", { name: "Yeni Birleşik Sürüm kaydet" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Birleşik Sürüm 1 · Aday" })
	).toBeVisible();

	const firstCompositeHeading = page.getByRole("heading", {
		name: "Birleşik Sürüm 1 · Aday",
	});
	const firstComposite = firstCompositeHeading.locator(
		"xpath=ancestor::article[1]"
	);
	await firstComposite
		.getByLabel("Birleşik Sürüm 1 inceleme gerekçesi")
		.fill("The initial frame and direction were reviewed together.");
	await firstComposite.getByRole("button", { name: "Onayla" }).click();
	await expect(
		page.getByRole("heading", { name: "Birleşik Sürüm 1 · Onaylandı" })
	).toBeVisible();

	await unitCorrectionType.selectOption("frame");
	await unitCorrectionKey.fill("attack/frame-3");
	await unitCorrectionSource.selectOption({ label: "Sürüm 2 · Aday" });
	await unitCorrectionFile.setInputFiles({
		name: "attack-frame-3-v2.png",
		mimeType: "image/png",
		buffer: fixture.png,
	});
	await page.getByRole("button", { name: "Birim düzeltmesini kaydet" }).click();
	await expect(
		page.getByText("Kare · attack/frame-3 · Birim Sürümü 2")
	).toBeVisible();

	const correctedAssetVersion = sourceRecord
		.getByText("Sürüm 4 · Aday", { exact: true })
		.locator("xpath=ancestor::li[1]");
	await correctedAssetVersion
		.getByLabel("İnceleme gerekçesi")
		.fill("The corrected frame is ready for composition.");
	await correctedAssetVersion.getByRole("button", { name: "Onayla" }).click();
	await expect(
		correctedAssetVersion.getByText("Sürüm 4 · Onaylandı", { exact: true })
	).toBeVisible();

	await page;
	sourceRecord
		.getByLabel("Başlangıç Birleşik Sürümü")
		.selectOption({ label: "Birleşik Sürüm 1 · Onaylandı" });
	await sourceRecord.getByLabel("Kare · attack/frame-3").selectOption({
		label: "Birim Sürümü 2 · Varlık Sürümü 4 · Onaylandı",
	});
	await page
		.getByRole("button", { name: "Yeni Birleşik Sürüm kaydet" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Birleşik Sürüm 2 · Aday" })
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Birleşik Sürüm 1 · Onaylandı" })
	).toBeVisible();

	const secondComposite = page
		.getByRole("heading", { name: "Birleşik Sürüm 2 · Aday" })
		.locator("xpath=ancestor::article[1]");
	await expect(
		secondComposite.getByText("Kare · attack/frame-3 · Birim Sürümü 2")
	).toBeVisible();
	await expect(
		secondComposite.getByText("Yön · north · Birim Sürümü 1")
	).toBeVisible();
	await expect(
		secondComposite.getByText("Varlık Sürümü 4 · Onaylandı")
	).toBeVisible();

	await page.reload();
	await expect(page.getByText("Sürüm 1 · Onaylandı")).toBeVisible();
	await expect(page.getByText(`— Gerekçe: ${reviewRationale}`)).toBeVisible();
	await expect(page.locator("time[datetime]").first()).toBeVisible();
	await expect(page.getByText(fixture.visibleLineage)).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Birleşik Sürüm 1 · Onaylandı" })
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Birleşik Sürüm 2 · Aday" })
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Birleşik Sürüm 1 · Onaylandı" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Kare · attack/frame-3 · Birim Sürümü 1")
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Birleşik Sürüm 1 · Onaylandı" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Yön · north · Birim Sürümü 1")
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Birleşik Sürüm 2 · Aday" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Kare · attack/frame-3 · Birim Sürümü 2")
	).toBeVisible();
	await expect(
		page
			.getByRole("heading", { name: "Birleşik Sürüm 2 · Aday" })
			.locator("xpath=ancestor::article[1]")
			.getByText("Varlık Sürümü 4 · Onaylandı")
	).toBeVisible();
});
