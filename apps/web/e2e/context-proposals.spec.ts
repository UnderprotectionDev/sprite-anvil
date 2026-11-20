import { expect, test } from "@playwright/test";
import { projectContextFixture } from "./project-context-fixture";
import { signUpWithFixture } from "./project-workflow";

test("persists a structured Project Context proposal from the web flow", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required for the persistent flow."
	);

	await signUpWithFixture(page, projectContextFixture);

	await page.goto("/context-proposals");
	await page.getByLabel("Project name").fill(projectContextFixture.projectName);
	await page
		.getByLabel("Art direction")
		.fill(projectContextFixture.generalArtDirection);
	await page.getByRole("button", { name: "Create project" }).click();
	await page
		.getByRole("tab", { name: "Visual Worlds and Themes", exact: true })
		.click();
	await page.getByLabel("Visual World name").fill("Sunken coast");
	await page.getByRole("button", { name: "Add Visual World" }).click();
	await expect(
		page
			.locator(".scope-record-list")
			.getByText("Sunken coast", { exact: true })
	).toBeVisible();
	await page.getByLabel("Theme name").fill("Blue lanterns");
	await page.getByRole("button", { name: "Add Theme" }).click();
	await expect(
		page
			.locator(".scope-record-list")
			.getByText("Blue lanterns", { exact: true })
	).toBeVisible();

	await page
		.getByRole("tab", { name: "Propose a rule change", exact: true })
		.click();
	const operation = page.locator('select[aria-label="Change 1 operation"]');
	await expect(operation.locator('option[value="replace"]')).toBeDisabled();
	await expect(operation.locator('option[value="remove"]')).toBeDisabled();
	await page
		.getByLabel("Change 1 scope")
		.selectOption({ label: "Theme · Sunken coast / Blue lanterns" });

	await page.getByLabel("Proposal summary").fill(projectContextFixture.summary);
	await page
		.getByLabel("Change 1 rule", { exact: true })
		.selectOption(projectContextFixture.ruleId);
	await page
		.getByLabel("Change 1 rule value")
		.fill(projectContextFixture.value);
	await page
		.getByLabel("Rationale for this change")
		.fill(projectContextFixture.rationale);
	await page
		.getByRole("textbox", { name: "Evidence", exact: true })
		.fill(projectContextFixture.evidence);
	await page.getByRole("button", { name: "Save Context Proposal" }).click();

	await page
		.getByRole("tab", { name: "Review proposals", exact: true })
		.click();
	const savedProposal = page.getByRole("heading", {
		name: projectContextFixture.summary,
	});
	await expect(savedProposal).toBeVisible();
	await expect(page.getByText("Proposed value: 1.5")).toBeVisible();
	await page.getByRole("button", { name: "Review proposal" }).click();
	await expect(
		page.getByRole("heading", { name: "Activation summary · R1" })
	).toBeVisible();
	await expect(
		page.locator(".review-revisions").getByText("R0", { exact: true })
	).toHaveCount(2);
	await expect(page.getByText("Ready to activate")).toBeVisible();
	await expect(
		page.getByText(
			"Precedence: Theme · Sunken coast / Blue lanterns → Visual World · Sunken coast → Project · " +
				projectContextFixture.projectName
		)
	).toBeVisible();
	await page.getByRole("button", { name: "Activate R1" }).click();
	await expect(
		page.getByText("This proposal was saved as Active Context Revision R1.")
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Active revision · R1" })
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Activate R1" })).toHaveCount(
		0
	);

	await page.reload();
	await expect(savedProposal).toBeVisible();
	await expect(page.getByText("Proposed value: 1.5")).toBeVisible();
	const proposalRecord = page.locator(".proposal-record").filter({
		has: savedProposal,
	});
	await expect(
		proposalRecord.getByText("Active", { exact: true })
	).toBeVisible();
	await proposalRecord.getByRole("button", { name: "Review proposal" }).click();
	await expect(
		page.getByRole("heading", { name: "Active revision · R1" })
	).toBeVisible();
});
