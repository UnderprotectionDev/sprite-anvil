import { expect, test } from "@playwright/test";
import { createAssetRecordFixture } from "./asset-record-fixture";
import { signUpWithFixture } from "./project-workflow";
import {
	sourceMetadataMappingFixture,
	sourceMetadataMappingFixtureHash,
} from "./source-metadata-mapping-fixture";

const unresolvedConflictStatusPattern =
	/Field conflicts: 1\. The proposal is not finalized\./u;

test("creates and rereads the shared source metadata mapping proposal through the web flow", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);

	const fixture = createAssetRecordFixture();
	await signUpWithFixture(page, fixture);

	const visualWorldName = `${fixture.name} world`;
	const identityName = `${fixture.name} identity`;
	const familyName = `${fixture.name} family`;
	await page.goto("/context-proposals");
	await page.getByLabel("Project name").fill(fixture.projectName);
	await page.getByLabel("Art direction").fill(fixture.generalArtDirection);
	await page.getByRole("button", { name: "Create project" }).click();
	await page
		.getByRole("button", { name: "Visual Worlds and Themes", exact: true })
		.click();
	await page.getByLabel("Visual World name").fill(visualWorldName);
	await page.getByRole("button", { name: "Add Visual World" }).click();
	await page.goto("/projects");
	await page.getByRole("link", { name: "Asset Families" }).click();
	await page
		.getByRole("button", {
			name: "Family and representation relationships",
			exact: true,
		})
		.click();
	await page.getByLabel("Subject Identity name").fill(identityName);
	await page.getByRole("button", { name: "Create Subject Identity" }).click();
	await page.getByLabel("Asset Family name").fill(familyName);
	await page
		.getByLabel("Visual World")
		.selectOption({ label: visualWorldName });
	await page.getByLabel("Usage context").fill("Walking animation");
	await page.getByRole("button", { name: "Create Asset Family" }).click();
	await page.getByLabel("Asset Record name").fill(fixture.name);
	await page.getByRole("button", { name: "Add Asset Record" }).click();
	await page.goto("/projects");
	await page
		.getByRole("link", {
			name: `${fixture.projectName} open Asset Records`,
		})
		.click();
	await page.getByRole("link", { name: "Import Inbox" }).click();

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
	await page.getByRole("button", { name: "Add files to Import Inbox" }).click();

	await page
		.getByRole("button", { name: "Bekleyen dosyalar", exact: true })
		.click();
	const sourcePanel = page.getByRole("region", {
		name: `Source Metadata Mapping Proposal for ${sourceMetadataMappingFixture.source.fileName}`,
	});
	await sourcePanel
		.getByRole("checkbox", {
			name: new RegExp(sourceMetadataMappingFixture.aseprite.fileName, "u"),
		})
		.check();
	await sourcePanel
		.getByRole("checkbox", {
			name: new RegExp(
				sourceMetadataMappingFixture.texturePacker.fileName,
				"u"
			),
		})
		.check();
	await sourcePanel
		.getByRole("button", {
			name: `Create Source Metadata Mapping Proposal: ${sourceMetadataMappingFixture.source.fileName}`,
		})
		.click();

	const proposalSummary = page
		.locator("summary")
		.filter({ hasText: "Source Metadata Mapping Proposal" });
	await expect(proposalSummary).toBeVisible();
	await proposalSummary.click();
	const proposalDetails = page
		.locator("details")
		.filter({ hasText: "source-metadata-mapping/1.1.0" });
	await expect(proposalDetails.getByRole("status")).toContainText(
		unresolvedConflictStatusPattern
	);
	await expect(
		proposalDetails.getByText("source-metadata-mapping/1.1.0")
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
			"Asset Family link: Unknown · no source evidence.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			"Required Set link: Unknown · no source evidence.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails.getByText("Tag · walk", { exact: true })
	).toBeVisible();
	await expect(
		proposalDetails.getByText("Duration · walk-0", { exact: true })
	).toBeVisible();
	await expect(
		proposalDetails.getByText(
			"Gameplay Metadata: Unknown · project context required.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(
		proposalDetails
			.getByRole("list", { name: "Proposed source fields" })
			.getByText("Pivot · walk-0", { exact: true })
	).toHaveCount(2);
	await proposalDetails
		.getByLabel("Target Asset Record")
		.selectOption({ label: fixture.name });
	await expect(
		proposalDetails.getByRole("button", {
			name: "Finalize mapping and create Candidate Version",
		})
	).toBeDisabled();
	await proposalDetails
		.getByLabel("Frame · walk-0 (zorunlu)")
		.selectOption({ index: 1 });
	await proposalDetails
		.getByRole("button", {
			name: "Finalize mapping and create Candidate Version",
		})
		.click();
	await expect(
		proposalDetails.getByText("Confirmed link · Candidate Version created")
	).toBeVisible();
	await expect(
		proposalDetails.getByText("Pivot · walk-0: Bilinmiyor")
	).toBeVisible();

	await page.reload();
	await page
		.getByRole("button", { name: "Bekleyen dosyalar", exact: true })
		.click();
	const rereadProposalSummary = page
		.locator("summary")
		.filter({ hasText: "Source Metadata Mapping Proposal" });
	await expect(rereadProposalSummary).toBeVisible();
	await rereadProposalSummary.click();
	const rereadProposalDetails = page
		.locator("details")
		.filter({ hasText: "source-metadata-mapping/1.1.0" });
	await expect(
		rereadProposalDetails.getByText(
			"Confirmed link · Candidate Version created"
		)
	).toBeVisible();
	await expect(
		rereadProposalDetails.getByText("Tag · walk", { exact: true })
	).toBeVisible();
	await expect(
		rereadProposalDetails.getByText("Duration · walk-0", { exact: true })
	).toBeVisible();
	await rereadProposalDetails
		.getByRole("link", { name: "Open Candidate Version" })
		.click();
	await expect(
		page.getByText(
			`${sourceMetadataMappingFixture.source.fileName} · Version 1 · Candidate`
		)
	).toBeVisible();
});
