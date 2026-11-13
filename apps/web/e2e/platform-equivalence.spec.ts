import { expect, test } from "@playwright/test";
import {
	createProjectFromProjectsView,
	signUpWithFixture,
} from "./project-workflow";

const interimText = /Phase 3 interim evidence/;

const fixture = {
	email: `platform-equivalence-e2e-${crypto.randomUUID()}@example.test`,
	generalArtDirection: "Readable pixel silhouettes for a chapter demo",
	password: "PlatformEquivalenceE2E-Password-1",
	projectName: "Platform Equivalence Project",
	userName: "Platform Equivalence E2E",
};

test("the web app shows interim evidence, and offers no report without a run", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"CONTEXT_TEST_DATABASE_URL is required to sign in."
	);
	await signUpWithFixture(page, fixture);
	await createProjectFromProjectsView(page, fixture);

	await page.getByRole("link", { name: "Platform Equivalence" }).click();

	await expect(
		page.getByRole("heading", { name: "Platform Equivalence", level: 1 })
	).toBeVisible();
	await expect(page.getByText(interimText)).toBeVisible();
	await expect(
		page.getByText(
			"This project has no Export Bundle to record a run from yet."
		)
	).toBeVisible();
	await expect(page.getByText("No run has been recorded yet.")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Create report from latest runs" })
	).toBeDisabled();
});
