import { expect, test } from "@playwright/test";
import {
	assetRecordFixture,
	assetRecordMeasurementScenarios,
	assetVersionE2eEnabled,
	createAssetRecordFixture,
} from "./asset-record-fixture";
import {
	createProjectFromProjectsView,
	signUpWithFixture,
} from "./project-workflow";

const identityCheckboxName = /Independent product meaning/u;
const secondVersionCandidate = /ash-knight-alt\.png.*Version 2.*Candidate/u;

test("persists an Asset Record created through the web flow", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A dedicated test database is required for the persistent flow."
	);

	await signUpWithFixture(page, assetRecordFixture);
	await createProjectFromProjectsView(page, assetRecordFixture);

	await page
		.getByRole("link", {
			name: `${assetRecordFixture.projectName} open project`,
		})
		.click();
	await page.getByRole("button", { name: "New Asset Record" }).waitFor();
	const assetRecordsUrl = page.url();
	for (const scenario of assetRecordMeasurementScenarios) {
		// biome-ignore lint/performance/noAwaitInLoops: Each scenario reuses one page and must finish before navigating to the next record.
		await page.goto(assetRecordsUrl);
		await page
			.getByRole("button", { name: "New Asset Record", exact: true })
			.click();
		await page.getByLabel("Asset name").fill(scenario.name);
		await page.getByRole("checkbox", { name: identityCheckboxName }).check();
		await page.getByRole("button", { name: "Create Asset Record" }).click();
		await expect(
			page.getByRole("heading", { name: scenario.name })
		).toBeVisible();
		await page
			.getByRole("tab", { name: "Record details", exact: true })
			.click();
		for (const { accessibleName, kind, value } of scenario.inputs) {
			const field = page.getByLabel(accessibleName, { exact: true });
			// biome-ignore lint/performance/noAwaitInLoops: Each field must finish before the next field gets browser focus.
			await (kind === "select" ? field.selectOption(value) : field.fill(value));
		}
		await page.getByRole("button", { name: "Save dimensions" }).click();
		await expect(
			page.getByText("Dimensions saved.", { exact: true })
		).toBeVisible();
		if (scenario.name === assetRecordFixture.name) {
			await expect(
				page.getByText("Independent product meaning", { exact: true })
			).toBeVisible();
		}
		await page.reload();
		await page
			.getByRole("tab", { name: "Record details", exact: true })
			.click();
		await expect(
			page.getByRole("heading", { name: scenario.name })
		).toBeVisible();
		await expect(page.getByText("Record created")).toBeVisible();
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
		"A dedicated test database and explicitly selected test R2 bucket are required for version persistence."
	);

	await signUpWithFixture(page, versionFixture);
	await createProjectFromProjectsView(page, versionFixture);
	await page
		.getByRole("link", {
			name: `${versionFixture.projectName} open project`,
		})
		.click();
	await page
		.getByRole("button", { name: "New Asset Record", exact: true })
		.click();
	await page.getByLabel("Asset name").fill(versionFixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Create Asset Record" }).click();
	await expect(
		page.getByRole("heading", { name: versionFixture.name })
	).toBeVisible();

	await page.locator("#asset-version-file").setInputFiles({
		name: "ash-knight.png",
		mimeType: "image/png",
		buffer: Buffer.from(versionFixture.assetVersionPngBase64, "base64"),
	});
	await page
		.getByLabel("Unknown production history")
		.fill("The original generation instruction is unavailable.");
	await page.getByLabel("Known source").fill("Created for version tracking");
	await page
		.getByLabel("Your relationship to the asset")
		.selectOption("created_by_user");
	await page
		.getByLabel("Supporting evidence")
		.fill("Owner attested to the source and relationship.");
	await page.getByRole("button", { name: "Save Candidate Version" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Candidate Version saved."
	);
	await expect(
		page.getByText("File format signature matched (1 version).")
	).toBeVisible();

	await page
		.getByLabel("Review rationale (optional)")
		.fill("Reviewed through the web flow.");
	await page.getByRole("button", { name: "Approve" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Approved Version saved."
	);
	await expect(page.getByText("ash-knight.png · Version 1")).toBeVisible();
	await expect(page.getByText("Created for version tracking")).toBeVisible();
	await expect(
		page.getByText(
			"Unknown production history: The original generation instruction is unavailable."
		)
	).toBeVisible();
	await expect(
		page.getByText(
			"Supporting evidence: Owner attested to the source and relationship.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(page.getByText("Created by user")).toBeVisible();
	await expect(
		page
			.getByRole("paragraph")
			.filter({ hasText: "Reviewed through the web flow." })
	).toBeVisible();

	await page.locator("#asset-version-file").setInputFiles({
		name: "ash-knight-alt.png",
		mimeType: "image/png",
		buffer: Buffer.from(versionFixture.assetVersionPngBase64, "base64"),
	});
	await page
		.getByLabel("Unknown production history")
		.fill("The alternative sketch instructions are unavailable.");
	await page.getByLabel("Known source").fill("Alternative sketch");
	await page
		.getByLabel("Your relationship to the asset")
		.selectOption("received_from_team");
	await page.getByLabel("Supporting evidence").fill("Team handoff note.");
	await page.getByRole("button", { name: "Save Candidate Version" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Candidate Version saved."
	);
	await expect(page.getByText(secondVersionCandidate)).toBeVisible();
	await expect(
		page.getByText("File format signature matched (2 version).")
	).toBeVisible();

	await page.reload();
	await expect(page.getByText("ash-knight.png · Version 1")).toBeVisible();
	await expect(page.getByText(secondVersionCandidate)).toBeVisible();
	await expect(
		page.getByText("File format signature matched (2 version).")
	).toBeVisible();
	await expect(page.getByText("Created for version tracking")).toBeVisible();
	await expect(
		page.getByText(
			"Unknown production history: The original generation instruction is unavailable."
		)
	).toBeVisible();
	await expect(
		page.getByText("Version 2 · Alternative sketch", { exact: true })
	).toBeVisible();
	await expect(
		page.getByText(
			"Unknown production history: The alternative sketch instructions are unavailable."
		)
	).toBeVisible();
	await expect(
		page.getByText("Supporting evidence: Team handoff note.", { exact: true })
	).toBeVisible();
	await expect(
		page.getByText(
			"Supporting evidence: Owner attested to the source and relationship.",
			{ exact: true }
		)
	).toBeVisible();
	await expect(page.getByText("Created by user")).toBeVisible();
	await expect(
		page.getByText("History unknown · Received from team", { exact: true })
	).toBeVisible();
	await expect(
		page
			.getByRole("paragraph")
			.filter({ hasText: "Reviewed through the web flow." })
	).toBeVisible();
});

test("archives and restores an Asset Record through the web flow", async ({
	page,
}) => {
	const fixture = createAssetRecordFixture();
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A dedicated test database is required for the persistent flow."
	);

	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);
	await page
		.getByRole("link", {
			name: `${fixture.projectName} open project`,
		})
		.click();
	await page
		.getByRole("button", { name: "New Asset Record", exact: true })
		.click();
	await page.getByLabel("Asset name").fill(fixture.name);
	await page.getByRole("checkbox", { name: identityCheckboxName }).check();
	await page.getByRole("button", { name: "Create Asset Record" }).click();
	await expect(page.getByRole("heading", { name: fixture.name })).toBeVisible();

	await page.getByRole("tab", { name: "Record details", exact: true }).click();
	await page.getByRole("button", { name: "Archive record" }).click();
	await expect(page.getByText("Archived", { exact: true })).toBeVisible();
	await page.reload();
	await page.getByRole("tab", { name: "Record details", exact: true }).click();
	await expect(page.getByText("Archived", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Reactivate record" }).click();
	await expect(page.getByText("Active", { exact: true })).toBeVisible();
	await page.reload();
	await page.getByRole("tab", { name: "Record details", exact: true }).click();
	await expect(page.getByText("Active", { exact: true })).toBeVisible();
});
