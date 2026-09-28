import { expect, test } from "@playwright/test";
import { createAssetRecordFixture } from "./asset-record-fixture";
import {
	sourceMetadataMappingFixture,
	sourceMetadataMappingFixtureHash,
} from "./source-metadata-mapping-fixture";

const unresolvedConflictStatusPattern =
	/alan çakışması var; öneri henüz kesinleşmedi\./;

test("creates and rereads the shared source metadata mapping proposal through the web flow", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);

	const fixture = createAssetRecordFixture();
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
	await page.getByRole("link", { name: "İçe Aktarma Gelen Kutusu" }).click();

	await page.getByLabel("Dosyalar").setInputFiles([
		{
			name: sourceMetadataMappingFixture.source.fileName,
			mimeType: sourceMetadataMappingFixture.source.contentType,
			buffer: sourceMetadataMappingFixture.source.bytes,
		},
		{
			name: sourceMetadataMappingFixture.aseprite.fileName,
			mimeType: sourceMetadataMappingFixture.aseprite.contentType,
			buffer: sourceMetadataMappingFixture.aseprite.bytes,
		},
		{
			name: sourceMetadataMappingFixture.texturePacker.fileName,
			mimeType: sourceMetadataMappingFixture.texturePacker.contentType,
			buffer: sourceMetadataMappingFixture.texturePacker.bytes,
		},
	]);
	await page
		.getByRole("button", { name: "Dosyaları Gelen Kutusuna Al" })
		.click();

	const sourcePanel = page.getByRole("region", {
		name: `${sourceMetadataMappingFixture.source.fileName} için Kaynak Metadata Eşleme Önerisi`,
	});
	await sourcePanel
		.getByRole("checkbox", {
			name: new RegExp(sourceMetadataMappingFixture.aseprite.fileName),
		})
		.check();
	await sourcePanel
		.getByRole("checkbox", {
			name: new RegExp(sourceMetadataMappingFixture.texturePacker.fileName),
		})
		.check();
	await sourcePanel
		.getByRole("button", {
			name: `Kaynak Metadata Eşleme Önerisi oluştur: ${sourceMetadataMappingFixture.source.fileName}`,
		})
		.click();

	const proposalSummary = page
		.locator("summary")
		.filter({ hasText: "Kaynak Metadata Eşleme Önerisi" });
	await expect(proposalSummary).toBeVisible();
	await proposalSummary.click();
	const proposalDetails = page
		.locator("details")
		.filter({ hasText: "source-metadata-mapping/1.0.0" });
	await expect(proposalDetails.getByRole("status")).toContainText(
		unresolvedConflictStatusPattern
	);
	await expect(
		proposalDetails.getByText("source-metadata-mapping/1.0.0")
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			sourceMetadataMappingFixtureHash(
				sourceMetadataMappingFixture.source.bytes
			),
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			sourceMetadataMappingFixtureHash(
				sourceMetadataMappingFixture.aseprite.bytes
			),
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			sourceMetadataMappingFixtureHash(
				sourceMetadataMappingFixture.texturePacker.bytes
			),
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			"Varlık Ailesi bağlantısı: Bilinmiyor · kaynak kanıtı yok.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			"Gerekli Öğeler Listesi bağlantısı: Bilinmiyor · kaynak kanıtı yok.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails.getByText("Tag · walk", { exact: true })
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			"Oyun İçi Bilgiler: Bilinmiyor · proje bağlamı gerekli.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails
			.getByRole("list", { name: "Önerilen kaynak alanları" })
			.getByText("Pivot · walk-0", { exact: true })
	).toHaveCount(2);

	await page.reload();
	const rereadProposalSummary = page
		.locator("summary")
		.filter({ hasText: "Kaynak Metadata Eşleme Önerisi" });
	await expect(rereadProposalSummary).toBeVisible();
	await rereadProposalSummary.click();
	const rereadProposalDetails = page
		.locator("details")
		.filter({ hasText: "source-metadata-mapping/1.0.0" });
	await expect(rereadProposalDetails.getByRole("status")).toContainText(
		unresolvedConflictStatusPattern
	);
	await expect(
		rereadProposalDetails.getByText("Tag · walk", { exact: true })
	).toBeVisible();
});
