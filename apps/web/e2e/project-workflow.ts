import { expect, type Page } from "@playwright/test";

interface AccountFixture {
	email: string;
	password: string;
	userName: string;
}

interface ProjectFixture {
	generalArtDirection: string;
	projectName: string;
}

export async function signUpWithFixture(page: Page, fixture: AccountFixture) {
	await page.goto("/login");
	await page.getByRole("button", { name: "Need an account? Sign Up" }).click();
	await page.getByLabel("Name").fill(fixture.userName);
	await page.getByLabel("Email").fill(fixture.email);
	await page.getByLabel("Password").fill(fixture.password);
	await page.getByRole("button", { name: "Sign Up" }).click();
	await expect(
		page.getByRole("heading", { name: "Game projects" })
	).toBeVisible({ timeout: 30_000 });
}

export async function createProjectFromProjectsView(
	page: Page,
	fixture: ProjectFixture
) {
	await page.getByRole("link", { name: "Projects" }).click();
	await page.getByRole("button", { name: "New game project" }).click();
	const dialog = page.getByRole("dialog", { name: "New game project" });
	await dialog.getByLabel("Game project name").fill(fixture.projectName);
	await dialog
		.getByLabel("General art direction")
		.fill(fixture.generalArtDirection);
	await dialog.getByRole("button", { name: "Create project" }).click();
	await expect(dialog).toHaveCount(0);
	await expect(
		page.getByRole("heading", { name: fixture.projectName })
	).toBeVisible();
}
