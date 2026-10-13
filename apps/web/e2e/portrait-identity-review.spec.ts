import { expect, test } from "@playwright/test";
import {
	activateFamilyProfile,
	assetFamilyWorkspaceFixture,
	prepareAssetFamilyWorkspace,
} from "./asset-family-workspace-fixture";

test("reviews portrait expressions in dialogue and rereads exact crop and user judgments", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"Requires disposable PostgreSQL"
	);
	test.setTimeout(180_000);
	page.setDefaultTimeout(15_000);
	const { familyUrl } = await prepareAssetFamilyWorkspace(
		page,
		{
			...assetFamilyWorkspaceFixture,
			userName: "Portrait Reviewer",
			email: `portrait-${crypto.randomUUID()}@example.test`,
			projectName: "Hero Portrait Review",
			identityName: "Hero",
			familyName: "Hero portraits",
			visualWorldName: "Illustrated portraits",
			useContext: "Dialogue",
			categoryLabel: "Portreler, logolar ve tanıtım görselleri",
			records: [
				{ name: "Neutral portrait", uploadNote: "Neutral portrait source." },
				{ name: "Happy portrait", uploadNote: "Happy portrait source." },
			],
		},
		"1.0.0",
		false
	);
	await page
		.getByRole("button", { name: "Sürüm ve bağımlılık işlemleri", exact: true })
		.click();
	const neutral = page.getByRole("listitem").filter({
		has: page.getByRole("heading", { name: "Neutral portrait", exact: true }),
	});
	await neutral
		.getByLabel("İnceleme gerekçesi")
		.fill("Approved portrait identity.");
	const approvalResponse = page.waitForResponse((response) =>
		response.url().includes("assetVersions/review")
	);
	await neutral.getByRole("button", { name: "Onayla", exact: true }).click();
	const approval = await approvalResponse;
	expect(approval.ok(), await approval.text()).toBe(true);
	await expect(
		neutral.getByRole("paragraph").filter({ hasText: "Sürüm 1 · Onaylandı" })
	).toBeVisible();
	await neutral.getByRole("button", { name: "Ana Tasarım olarak seç" }).click();
	await expect(
		page.getByText("Ana Tasarım seçildi.", { exact: true })
	).toBeVisible();
	await page
		.getByRole("button", { name: "Aile ve temsil ilişkileri", exact: true })
		.click();
	await page.getByLabel("İlişki türü").selectOption("derivative");
	await page
		.getByLabel("İlgili Varlık Kaydı")
		.selectOption({ label: "Happy portrait" });
	await page.getByRole("button", { name: "İlişki ekle", exact: true }).click();
	await expect(
		page.getByText("İlişki kaydedildi.", { exact: true })
	).toBeVisible();
	await activateFamilyProfile(
		page,
		"Portre, logo ve tanıtım görseli",
		familyUrl,
		"1.0.0"
	);
	await page
		.getByRole("button", { name: "Profil incelemeleri", exact: true })
		.click();
	const review = page.getByRole("region", {
		name: "Portre Kimliğini ve Kırpmayı İnceleme",
	});
	await review
		.getByLabel("Portre sürümü")
		.nth(0)
		.selectOption({ label: "Neutral portrait · Sürüm 1" });
	await review
		.getByLabel("Portre sürümü")
		.nth(1)
		.selectOption({ label: "Happy portrait · Sürüm 1" });
	await review.getByLabel("İfade adı").nth(0).fill("Neutral");
	await review.getByLabel("İfade adı").nth(1).fill("Happy");
	await review.getByLabel("Kırpma X").nth(0).fill("8");
	await expect(
		review.getByRole("button", { name: "Portre incelemesini kaydet" })
	).toBeDisabled();
	await review.getByLabel("Kırpma genişliği").nth(0).fill("24");
	await review.getByLabel("Kullanım genişliği").nth(0).fill("137");
	await review.getByLabel("Kullanım yüksekliği").nth(0).fill("181");
	await review
		.getByLabel("Kimlik tutarlılığı", { exact: true })
		.selectOption("passed");
	await review
		.getByLabel("İfade tutarlılığı", { exact: true })
		.selectOption("passed");
	await review
		.getByLabel("Kırpma ve yüz görünürlüğü", { exact: true })
		.selectOption("failed");
	await review
		.getByLabel("Kimlik tutarlılığı notu")
		.fill("Same Hero identity.");
	await review
		.getByLabel("İfade tutarlılığı notu")
		.fill("Neutral and Happy remain distinct.");
	await review
		.getByLabel("Kırpma ve yüz görünürlüğü notu")
		.fill("Face is clipped in dialogue.");
	await review
		.getByLabel("İnceleme gerekçesi")
		.fill("Dialogue crop needs follow-up.");
	await expect(
		review.getByRole("img", { name: "Neutral portrait Neutral" })
	).toBeVisible();
	await expect(
		review.getByRole("button", { name: "Portre incelemesini kaydet" })
	).toBeEnabled();
	await review
		.getByRole("button", { name: "Portre incelemesini kaydet" })
		.click();
	await expect(
		review.getByText("Portre incelemesi kaydedildi.", { exact: true })
	).toBeVisible();
	await review.screenshot({ path: "../../.context/portrait-review.png" });
	await page.reload();
	await page
		.getByRole("button", { name: "Profil incelemeleri", exact: true })
		.click();
	await expect(
		review.getByText("Dialogue crop needs follow-up.", { exact: true })
	).toBeVisible();
	await review
		.getByText("İnceleme ayrıntılarını göster", { exact: true })
		.click();
	await expect(
		review.getByText(
			"Kırpma ve yüz görünürlüğü: Başarısız · Face is clipped in dialogue.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		review.getByText(
			"Neutral portrait · Neutral · Diyalog · 137 × 181 px · Kırpma: 8, 0, 24 × 32 · Açık",
			{ exact: true }
		)
	).toBeVisible();
});
