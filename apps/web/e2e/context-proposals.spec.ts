import { expect, test } from "@playwright/test";
import { projectContextFixture } from "./project-context-fixture";

test("persists a structured Project Context proposal from the web flow", async ({
	page,
}) => {
	test.skip(
		!process.env.CONTEXT_TEST_DATABASE_URL,
		"A disposable Neon test branch is required for the persistent flow."
	);

	await page.goto("/login");
	await page.getByLabel("Name").fill(projectContextFixture.userName);
	await page.getByLabel("Email").fill(projectContextFixture.email);
	await page.getByLabel("Password").fill(projectContextFixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill(projectContextFixture.projectName);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(projectContextFixture.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: "Bağlam Önerisi hazırlayın" })
	).toBeVisible();

	const operation = page.locator('select[aria-label="Değişiklik 1 işlemi"]');
	await expect(operation.locator('option[value="replace"]')).toBeDisabled();
	await expect(operation.locator('option[value="remove"]')).toBeDisabled();

	await page.getByLabel("Öneri özeti").fill(projectContextFixture.summary);
	await page
		.getByLabel("Değişiklik 1 kuralı")
		.selectOption(projectContextFixture.ruleId);
	await page
		.getByLabel("Değişiklik 1 kural değeri")
		.fill(projectContextFixture.value);
	await page
		.getByLabel("Bu değişikliğin gerekçesi")
		.fill(projectContextFixture.rationale);
	await page.getByLabel("Kanıt").fill(projectContextFixture.evidence);
	await page.getByRole("button", { name: "Bağlam Önerisini kaydet" }).click();

	const savedProposal = page.getByRole("heading", {
		name: projectContextFixture.summary,
	});
	await expect(savedProposal).toBeVisible();
	await expect(page.getByText("Önerilen değer: 1.5")).toBeVisible();
	await page.getByRole("button", { name: "Öneriyi incele" }).click();
	await expect(
		page.getByRole("heading", { name: "Etkinleştirme özeti · R1" })
	).toBeVisible();
	await expect(
		page.locator(".review-revisions").getByText("R0", { exact: true })
	).toBeVisible();
	await expect(page.getByText("Etkinleştirilebilir")).toBeVisible();
	await page.getByRole("button", { name: "R1 sürümünü etkinleştir" }).click();
	await expect(
		page.getByText("Bu öneri Etkin Bağlam Sürümü R1 olarak kaydedildi.")
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Etkin sürüm · R1" })
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "R1 sürümünü etkinleştir" })
	).toHaveCount(0);

	await page.reload();
	await expect(savedProposal).toBeVisible();
	await expect(page.getByText("Önerilen değer: 1.5")).toBeVisible();
	const proposalRecord = page.locator(".proposal-record").filter({
		has: savedProposal,
	});
	await expect(
		proposalRecord.getByText("Etkin", { exact: true })
	).toBeVisible();
	await expect(
		page.getByText("Etkin Bağlam Sürümü", { exact: true })
	).toBeVisible();
});
