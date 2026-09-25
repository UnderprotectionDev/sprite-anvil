import { expect, test } from "@playwright/test";
import {
	assetRecordFixture,
	assetRecordMeasurementScenarios,
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "./asset-record-fixture";

const identityCheckboxName = /Bağımsız ürün anlamı/;
const secondVersionCandidate = /ash-knight-alt\.png.*Sürüm 2.*Aday/;

test("persists an Asset Record created through the web flow", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A disposable Neon test branch is required for the persistent flow."
	);

	await page.goto("/login");
	await page.getByLabel("Name").fill(assetRecordFixture.userName);
	await page.getByLabel("Email").fill(assetRecordFixture.email);
	await page.getByLabel("Password").fill(assetRecordFixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

	await page.getByRole("link", { name: "Projects" }).click();
	await page
		.getByLabel("Oyun projesi adı")
		.fill(assetRecordFixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(assetRecordFixture.generalArtDirection);
	await page.getByRole("button", { name: "Proje oluştur" }).click();

	await page
		.getByRole("link", {
			name: `${assetRecordFixture.projectName} varlık kayıtlarını aç`,
		})
		.click();
	await page.getByLabel("Varlık adı").waitFor();
	const assetRecordsUrl = page.url();
	for (const scenario of assetRecordMeasurementScenarios) {
		// biome-ignore lint/performance/noAwaitInLoops: Each scenario reuses one page and must finish before navigating to the next record.
		await page.goto(assetRecordsUrl);
		await page.getByLabel("Varlık adı").fill(scenario.name);
		await page.getByRole("checkbox", { name: identityCheckboxName }).check();
		await page.getByRole("button", { name: "Varlık kaydı oluştur" }).click();
		await expect(
			page.getByRole("heading", { name: scenario.name })
		).toBeVisible();
		await Promise.all(
			scenario.inputs.map(({ accessibleName, kind, value }) =>
				kind === "select"
					? page.getByLabel(accessibleName).selectOption(value)
					: page.getByLabel(accessibleName).fill(value)
			)
		);
		await page.getByRole("button", { name: "Ölçüleri kaydet" }).click();
		await expect(
			page.getByText("Ölçüler kaydedildi.", { exact: true })
		).toBeVisible();
		if (scenario.name === assetRecordFixture.name) {
			await expect(
				page.getByText("Bağımsız ürün anlamı", { exact: true })
			).toBeVisible();
		}
		await page.reload();
		await expect(
			page.getByRole("heading", { name: scenario.name })
		).toBeVisible();
		await expect(page.getByText("Kayıt oluşturuldu")).toBeVisible();
		await Promise.all(
			scenario.inputs.map(({ accessibleName, value }) =>
				expect(page.getByLabel(accessibleName)).toHaveValue(value)
			)
		);
	}
});

test("persists an Asset Version, review, quality result, and legacy history", async ({
	page,
}) => {
	const versionFixture = createAssetRecordFixture();
	test.skip(
		!assetVersionE2eEnabled,
		"A disposable Neon branch and explicitly selected test R2 bucket are required for version persistence."
	);

	await page.goto("/login");
	await page.getByLabel("Name").fill(versionFixture.userName);
	await page.getByLabel("Email").fill(versionFixture.email);
	await page.getByLabel("Password").fill(versionFixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
	await page.getByRole("link", { name: "Projects" }).click();
	await page.getByLabel("Oyun projesi adı").fill(versionFixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(versionFixture.generalArtDirection);
	await page.getByRole("button", { name: "Proje oluştur" }).click();
	await page
		.getByRole("link", {
			name: `${versionFixture.projectName} varlık kayıtlarını aç`,
		})
		.click();
	await page.getByLabel("Varlık adı").fill(versionFixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Varlık kaydı oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: versionFixture.name })
	).toBeVisible();

	await page.locator("#asset-version-file").setInputFiles({
		name: "ash-knight.png",
		mimeType: "image/png",
		buffer: Buffer.from(versionFixture.assetVersionPngBase64, "base64"),
	});
	await page.getByLabel("Bilinen kaynak").fill("Created for version tracking");
	await page.getByLabel("Varlıkla ilişkiniz").selectOption("created_by_user");
	await page
		.getByLabel("Destekleyici kanıt")
		.fill("Owner attested to the source and relationship.");
	await page.getByRole("button", { name: "Aday sürümü kaydet" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Aday Sürüm kaydedildi."
	);
	await expect(
		page.getByText("Dosya biçim imzası eşleşti (1 sürüm).")
	).toBeVisible();

	await page
		.getByLabel("İnceleme gerekçesi (isteğe bağlı)")
		.fill("Reviewed through the web flow.");
	await page.getByRole("button", { name: "Onayla" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Onaylı Sürüm kaydedildi."
	);
	await expect(page.getByText("ash-knight.png · Sürüm 1")).toBeVisible();
	await expect(page.getByText("Created for version tracking")).toBeVisible();
	await expect(
		page.getByText("Owner attested to the source and relationship.")
	).toBeVisible();
	await expect(page.getByText("Kullanıcı oluşturdu")).toBeVisible();
	await expect(page.getByText("Reviewed through the web flow.")).toBeVisible();

	await page.locator("#asset-version-file").setInputFiles({
		name: "ash-knight-alt.png",
		mimeType: "image/png",
		buffer: Buffer.from(versionFixture.assetVersionPngBase64, "base64"),
	});
	await page.getByLabel("Bilinen kaynak").fill("Alternative sketch");
	await page
		.getByLabel("Varlıkla ilişkiniz")
		.selectOption("received_from_team");
	await page.getByLabel("Destekleyici kanıt").fill("Team handoff note.");
	await page.getByRole("button", { name: "Aday sürümü kaydet" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Aday Sürüm kaydedildi."
	);
	await expect(page.getByText(secondVersionCandidate)).toBeVisible();
	await expect(
		page.getByText("Dosya biçim imzası eşleşti (2 sürüm).")
	).toBeVisible();

	await page.reload();
	await expect(page.getByText("ash-knight.png · Sürüm 1")).toBeVisible();
	await expect(page.getByText(secondVersionCandidate)).toBeVisible();
	await expect(
		page.getByText("Dosya biçim imzası eşleşti (2 sürüm).")
	).toBeVisible();
	await expect(page.getByText("Created for version tracking")).toBeVisible();
	await expect(page.getByText("Alternative sketch")).toBeVisible();
	await expect(page.getByText("Team handoff note.")).toBeVisible();
	await expect(
		page.getByText("Owner attested to the source and relationship.")
	).toBeVisible();
	await expect(page.getByText("Kullanıcı oluşturdu")).toBeVisible();
	await expect(page.getByText("Ekipten alındı")).toBeVisible();
	await expect(page.getByText("Reviewed through the web flow.")).toBeVisible();
});

test("archives and restores an Asset Record through the web flow", async ({
	page,
}) => {
	const fixture = createAssetRecordFixture();
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A disposable Neon test branch is required for the persistent flow."
	);

	await page.goto("/login");
	await page.getByLabel("Name").fill(fixture.userName);
	await page.getByLabel("Email").fill(fixture.email);
	await page.getByLabel("Password").fill(fixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
	await page.getByRole("link", { name: "Projects" }).click();
	await page.getByLabel("Oyun projesi adı").fill(fixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Proje oluştur" }).click();
	await page
		.getByRole("link", {
			name: `${fixture.projectName} varlık kayıtlarını aç`,
		})
		.click();
	await page.getByLabel("Varlık adı").fill(fixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Varlık kaydı oluştur" }).click();
	await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();

	await page.getByRole("button", { name: "Kaydı arşivle" }).click();
	await expect(page.getByText("Arşivlenmiş", { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByText("Arşivlenmiş", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Kaydı yeniden etkinleştir" }).click();
	await expect(page.getByText("Etkin", { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByText("Etkin", { exact: true })).toBeVisible();
});
