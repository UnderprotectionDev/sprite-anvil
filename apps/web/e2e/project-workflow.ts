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
		page.getByRole("heading", { name: "Oyun projeleri" })
	).toBeVisible();
}

export async function createProjectFromProjectsView(
	page: Page,
	fixture: ProjectFixture
) {
	await page.getByRole("link", { name: "Projeler" }).click();
	await page.getByRole("button", { name: "Yeni oyun projesi" }).click();
	const dialog = page.getByRole("dialog", { name: "Yeni oyun projesi" });
	await dialog.getByLabel("Oyun projesi adı").fill(fixture.projectName);
	await dialog
		.getByLabel("Genel sanat yaklaşımı")
		.fill(fixture.generalArtDirection);
	await dialog.getByRole("button", { name: "Proje oluştur" }).click();
	await expect(dialog).toHaveCount(0);
	await expect(
		page.getByRole("heading", { name: fixture.projectName })
	).toBeVisible();
}
