import { expect, type Page } from "@playwright/test";
import { signUpWithFixture } from "./project-workflow";

const objectProfileHeading = "Objeler, silahlar, ekipmanlar ve durum aileleri";
const candidateVersionText = "Sürüm 1 · Aday";

export const assetFamilyWorkspaceFixture = {
	userName: "Asset Family Comparison E2E",
	email: `asset-family-comparison-e2e-${crypto.randomUUID()}@example.test`,
	password: "AssetFamilyComparisonE2E-Password-1",
	projectName: "Asset Family Comparison Project",
	generalArtDirection: "Readable states and directions for props",
	visualWorldName: "Comparison Gameplay",
	identityName: "Crate",
	familyName: "Crate States and Directions",
	useContext: "world props",
	records: [
		{ name: "Kapalı sandık", uploadNote: "Closed crate browser fixture." },
		{ name: "Açık sandık", uploadNote: "Open crate browser fixture." },
	],
	categoryLabel: objectProfileHeading,
	// A 32×32 PNG that passes the server's strict sharp decode; the shared
	// 1×1 asset-version fixture PNG trips the warning-failing libpng read.
	png: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVRYhWNgGAVDDeR3zviPD48sBzw9XoGCRx2QP+LSQP5gdEA+rR2UTy8H5JNo0agD8kejoHM0Ec4YzYb/h3dBxECkI8m2EB2MOiB/NAo6R3oiHAUMdAIApRlBiwhnmmsAAAAASUVORK5CYII=",
		"base64"
	),
};

export async function prepareAssetFamilyWorkspace(
	page: Page,
	fixture: Omit<typeof assetFamilyWorkspaceFixture, "records"> & {
		records: {
			name: string;
			uploadNote: string;
			categoryLabel?: string;
			png?: Buffer;
		}[];
	} = assetFamilyWorkspaceFixture,
	contractVersion = "1.0.0"
) {
	await signUpWithFixture(page, fixture);

	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill(fixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await page
		.getByRole("button", { name: "Görsel Dünyalar ve Temalar", exact: true })
		.click();
	await page.getByLabel("Görsel Dünya adı").fill(fixture.visualWorldName);
	await page.getByRole("button", { name: "Görsel Dünya ekle" }).click();
	await expect(
		page.locator(".scope-record-list").getByText(fixture.visualWorldName)
	).toBeVisible();

	await page.goto("/projects");
	await page.getByRole("link", { name: "Varlık Aileleri" }).click();
	await page
		.getByRole("button", { name: "Aile ve temsil ilişkileri", exact: true })
		.click();
	await page.getByLabel("Varlık Kimliği adı").fill(fixture.identityName);
	await page.getByRole("button", { name: "Varlık Kimliği oluştur" }).click();
	await page
		.getByRole("button", { name: "Aile kataloğu", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: fixture.identityName })
	).toBeVisible();
	await page
		.getByRole("button", { name: "Aile ve temsil ilişkileri", exact: true })
		.click();
	await page.getByLabel("Varlık Ailesi adı").fill(fixture.familyName);
	await page.getByLabel("Görsel Dünya").selectOption({
		label: fixture.visualWorldName,
	});
	await page.getByLabel("Kullanım bağlamı").fill(fixture.useContext);
	await page.getByRole("button", { name: "Varlık Ailesi oluştur" }).click();
	await page
		.getByRole("button", { name: "Aile kataloğu", exact: true })
		.click();
	await expect(
		page
			.getByRole("region", { name: "Kaydedilmiş Varlık Aileleri" })
			.getByRole("heading", { name: fixture.familyName, exact: true })
	).toBeVisible();

	const familyUrl = page.url();
	for (const record of fixture.records) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser interactions within each record setup must occur in order.
		await page
			.getByRole("button", { name: "Aile ve temsil ilişkileri", exact: true })
			.click();
		await page.getByLabel("Bağımsız ürün anlamı", { exact: true }).check();
		await page.getByLabel("Varlık Kaydı adı").fill(record.name);
		await page.getByRole("button", { name: "Varlık Kaydı ekle" }).click();
		await page
			.getByRole("button", {
				name: "Sürüm ve bağımlılık işlemleri",
				exact: true,
			})
			.click();
		await expect(
			page
				.getByRole("listitem")
				.filter({ has: page.getByRole("heading", { name: record.name }) })
				.getByText("Henüz sürüm kaydedilmedi.")
		).toBeVisible();

		await page
			.getByRole("listitem")
			.filter({ has: page.getByRole("heading", { name: record.name }) })
			.getByRole("link", { name: "Varlık Sürümü yükle" })
			.click();

		await page
			.getByRole("button", { name: "Kayıt bilgileri", exact: true })
			.click();
		// Scope hydration can reset the form's initial metadata. Select only once
		// the record and its family world have finished loading.
		await expect(
			page.getByRole("heading", { name: "Kayıt durumu", exact: true })
		).toBeVisible();
		await expect(page.locator("#asset-record-metadata-world")).toBeDisabled();
		await expect(
			page.getByRole("button", { name: "Metadata’yı kaydet" })
		).toBeEnabled();
		await page
			.getByLabel("Varlık kategorisi")
			.selectOption({ label: record.categoryLabel ?? fixture.categoryLabel });
		await page.getByRole("button", { name: "Metadata’yı kaydet" }).click();
		await expect(
			page.getByText("Varlık kaydı metadata’sı kaydedildi.")
		).toBeVisible();

		await page
			.getByRole("button", { name: "Sürümler ve dosyalar", exact: true })
			.click();
		await page.getByLabel("PNG veya WebP dosyası").setInputFiles({
			name: `${record.name}.png`,
			mimeType: "image/png",
			buffer: record.png ?? fixture.png,
		});
		await page.getByLabel("Bilinmeyen üretim geçmişi").fill(record.uploadNote);
		await page
			.getByLabel("Bilinen kaynak", { exact: true })
			.fill("Asset family comparison browser fixture");
		await page.getByLabel("Varlıkla ilişkiniz").selectOption("created_by_user");
		await page
			.getByRole("button", { name: "Aday sürümü kaydet", exact: true })
			.click();
		await expect(
			page.getByText("Aday Sürüm kaydedildi.", { exact: true })
		).toBeVisible();

		await page.goto(familyUrl);
		await page
			.getByRole("button", {
				name: "Sürüm ve bağımlılık işlemleri",
				exact: true,
			})
			.click();
		await expect(
			page
				.getByRole("listitem")
				.filter({ has: page.getByRole("heading", { name: record.name }) })
				.getByRole("paragraph")
				.filter({ hasText: candidateVersionText })
		).toBeVisible();
	}

	const contractNames: Record<string, string> = {
		"Arayüz ekranları ve bileşenleri": "Arayüz ekranı ve bileşeni",
		"Objeler, silahlar, ekipmanlar ve durum aileleri":
			"Obje, silah, ekipman ve durum",
		"Karakterler, yaratıklar ve animasyonlar": "Karakter, yaratık ve animasyon",
		"Arka planlar ve katmanlı kaydırma": "Arka plan ve katmanlı kaydırma",
	};
	const contractName = contractNames[fixture.categoryLabel];
	if (!contractName) {
		throw new Error(`Unknown fixture profile: ${fixture.categoryLabel}`);
	}
	await activateFamilyProfile(page, contractName, familyUrl, contractVersion);

	return { familyName: fixture.familyName, familyUrl };
}

export async function activateFamilyProfile(
	page: Page,
	contractName: string,
	familyUrl: string,
	contractVersion: string
) {
	await page
		.getByRole("link", { name: "Özel profil sözleşmeleri", exact: true })
		.click();
	await page.getByRole("button", { name: contractName, exact: true }).click();
	const profile = page.getByRole("article", {
		name: contractName,
		exact: true,
	});
	await profile.getByRole("button", { name: "Sözleşmeyi etkinleştir" }).click();
	await expect(
		profile.getByText(`Bu projede etkin · ${contractVersion}`)
	).toBeVisible();
	await page.goto(familyUrl);
	await page
		.getByRole("button", { name: "Profil incelemeleri", exact: true })
		.click();
}
