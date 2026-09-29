import { expect, test } from "@playwright/test";

const project = {
	id: "00000000-0000-4000-8000-000000000001",
	name: "Moonlit Vale",
};
const projectsUrlPattern = /\/projects$/;

function asContextProject(item: { id: string; name: string }) {
	return {
		...item,
		generalArtDirection: "Muted pixel art",
		createdAt: "2026-09-29T00:00:00.000Z",
		currentContextRevision: {
			id: `revision-${item.id}`,
			projectId: item.id,
			revisionNumber: 0,
			sourceProposalId: null,
			ruleContractVersion: "context-rule/1.0.0",
			isActive: false,
			rules: [],
			createdAt: "2026-09-29T00:00:00.000Z",
		},
	};
}

test.beforeEach(async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				session: {
					id: "test-session",
					userId: "test-user",
					expiresAt: "2099-01-01T00:00:00.000Z",
				},
				user: { id: "test-user", name: "Test User", email: "test@example.com" },
			},
		})
	);
	await page.route("**/rpc/projects/list", (route) =>
		route.fulfill({ json: { json: [project] } })
	);
});

test("uses a sequential heading hierarchy on the login screen", async ({
	page,
}) => {
	await page.goto("/login");
	await expect(
		page.getByRole("heading", {
			level: 1,
			name: "Keep your game art decisions together.",
		})
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "Welcome Back" })
	).toBeVisible();

	await page.getByRole("button", { name: "Need an account? Sign Up" }).click();
	await expect(
		page.getByRole("heading", { level: 2, name: "Create Account" })
	).toBeVisible();
});

test("sign in opens projects instead of the placeholder dashboard", async ({
	page,
}) => {
	await page.route("**/api/auth/sign-in/email", (route) =>
		route.fulfill({
			json: {
				token: "test-token",
				user: { id: "test-user", name: "Test User", email: "test@example.com" },
			},
		})
	);
	await page.goto("/login");
	await page.getByLabel("Email").fill("test@example.com");
	await page.getByLabel("Password").fill("correct-password");
	await page.getByRole("button", { name: "Sign In", exact: true }).click();
	await expect(page).toHaveURL(projectsUrlPattern);
	await expect(
		page.getByRole("heading", { name: "Oyun projeleri" })
	).toBeVisible();
});

test("sign up opens the project workspace", async ({ page }) => {
	await page.route("**/api/auth/sign-up/email", (route) =>
		route.fulfill({
			json: {
				token: "test-token",
				user: { id: "test-user", name: "Test User", email: "test@example.com" },
			},
		})
	);
	await page.goto("/login");
	await page.getByRole("button", { name: "Need an account? Sign Up" }).click();
	await page.getByLabel("Name").fill("Test User");
	await page.getByLabel("Email").fill("test@example.com");
	await page.getByLabel("Password").fill("correct-password");
	await page.getByRole("button", { name: "Sign Up", exact: true }).click();
	await expect(page).toHaveURL(projectsUrlPattern);
	await expect(
		page.getByRole("heading", { name: "Oyun projeleri" })
	).toBeVisible();
});

test("opens and dismisses project creation without losing the project list", async ({
	page,
}) => {
	await page.goto("/projects");
	await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
	const trigger = page.getByRole("button", { name: "Yeni oyun projesi" });
	await trigger.click();
	const dialog = page.getByRole("dialog", { name: "Yeni oyun projesi" });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel("Oyun projesi adı").fill("Another game");
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
});

test("opens Project Context for the selected project", async ({ page }) => {
	const secondProject = {
		id: "00000000-0000-4000-8000-000000000002",
		name: "Second game",
	};
	await page.route("**/rpc/projects/list", (route) =>
		route.fulfill({ json: { json: [project, secondProject] } })
	);
	await page.route("**/rpc/projectContexts/list", (route) =>
		route.fulfill({
			json: {
				json: [project, secondProject].map(asContextProject),
			},
		})
	);
	await page.route("**/rpc/contextScopes/list*", (route) =>
		route.fulfill({ json: { json: { visualWorlds: [], themes: [] } } })
	);
	await page.route("**/rpc/contextProposals/list*", (route) =>
		route.fulfill({ json: { json: [] } })
	);
	await page.goto("/projects");
	await page
		.getByRole("link", { name: "Second game proje bağlamını aç" })
		.click();
	await expect
		.poll(() => new URL(page.url()).searchParams.get("projectId"))
		.toBe(secondProject.id);
	await expect(page.getByRole("combobox", { name: "Proje" })).toHaveValue(
		secondProject.id
	);
	await page.getByRole("button", { name: "Yeni proje" }).click();
	await expect(page.getByRole("dialog", { name: "Yeni proje" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "Yeni proje" })).toHaveCount(0);
	await expect(page.getByRole("combobox", { name: "Proje" })).toHaveValue(
		secondProject.id
	);
});

test("shows a project created in Project Context on the Projects screen", async ({
	page,
}) => {
	const created = asContextProject({
		id: "00000000-0000-4000-8000-000000000004",
		name: "Context project",
	});
	const contexts: (typeof created)[] = [];
	const records: { id: string; name: string; createdAt: string }[] = [];
	await page.route("**/rpc/projectContexts/list", (route) =>
		route.fulfill({ json: { json: contexts } })
	);
	await page.route("**/rpc/projects/list", (route) =>
		route.fulfill({ json: { json: records } })
	);
	await page.route("**/rpc/projectContexts/create", (route) => {
		contexts.push(created);
		records.push({
			id: created.id,
			name: created.name,
			createdAt: created.createdAt,
		});
		return route.fulfill({ json: { json: created } });
	});
	await page.route("**/rpc/contextScopes/list*", (route) =>
		route.fulfill({ json: { json: { visualWorlds: [], themes: [] } } })
	);
	await page.route("**/rpc/contextProposals/list*", (route) =>
		route.fulfill({ json: { json: [] } })
	);
	await page.goto("/context-proposals");
	await page.getByLabel("Proje adı").fill(created.name);
	await page
		.getByLabel("Genel sanat yaklaşımı")
		.fill(created.generalArtDirection);
	await page.getByRole("button", { name: "Projeyi oluştur" }).click();
	await expect(page.getByRole("combobox", { name: "Proje" })).toHaveValue(
		created.id
	);
	await page.getByRole("link", { name: "Projelere dön" }).click();
	await expect(page.getByRole("heading", { name: created.name })).toBeVisible();
});

test("does not silently open another Project Context from an invalid project link", async ({
	page,
}) => {
	await page.route("**/rpc/projectContexts/list", (route) =>
		route.fulfill({ json: { json: [asContextProject(project)] } })
	);
	await page.goto("/context-proposals?projectId=not-a-uuid");
	await expect(page.getByRole("alert")).toContainText("Bu proje bulunamadı");
	await expect(page.getByRole("combobox", { name: "Proje" })).toHaveCount(0);

	await page.goto("/context-proposals?projectId=");
	await expect(page.getByRole("alert")).toContainText("Bu proje bulunamadı");
	await expect(page.getByRole("combobox", { name: "Proje" })).toHaveCount(0);

	await page.goto(
		"/context-proposals?projectId=00000000-0000-4000-8000-000000000099"
	);
	await expect(page.getByRole("alert")).toContainText("Bu proje bulunamadı");
	await expect(page.getByRole("combobox", { name: "Proje" })).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Projelere dön" }).last()
	).toBeVisible();
});

test("creates a project and shows it in the list", async ({ page }) => {
	const projects = [project];
	await page.route("**/rpc/projects/list", (route) =>
		route.fulfill({ json: { json: projects } })
	);
	await page.route("**/rpc/projects/create", (route) => {
		const created = {
			id: "00000000-0000-4000-8000-000000000002",
			name: "Second game",
			createdAt: "2026-09-29T00:00:00.000Z",
		};
		projects.push(created);
		return route.fulfill({ json: { json: created } });
	});
	await page.goto("/projects");
	await page.getByRole("button", { name: "Yeni oyun projesi" }).click();
	const dialog = page.getByRole("dialog", { name: "Yeni oyun projesi" });
	await dialog.getByLabel("Oyun projesi adı").fill("Second game");
	await dialog.getByLabel("Genel sanat yaklaşımı").fill("Muted pixel art");
	await dialog.getByRole("button", { name: "Proje oluştur" }).click();
	await expect(dialog).toHaveCount(0);
	await expect(
		page.getByRole("heading", { name: "Second game" })
	).toBeVisible();
	await expect(page.getByRole("status")).toContainText(
		"Oyun projesi kaydedildi."
	);
});

test("keeps a saved project visible when the list refresh fails", async ({
	page,
}) => {
	let listRequests = 0;
	await page.route("**/rpc/projects/list", (route) => {
		listRequests += 1;
		return listRequests === 1
			? route.fulfill({ json: { json: [project] } })
			: route.fulfill({ status: 500, json: { error: "unavailable" } });
	});
	await page.route("**/rpc/projects/create", (route) =>
		route.fulfill({
			json: {
				json: {
					id: "00000000-0000-4000-8000-000000000003",
					name: "Saved offline",
					createdAt: "2026-09-29T00:00:00.000Z",
				},
			},
		})
	);
	await page.goto("/projects");
	await page.getByRole("button", { name: "Yeni oyun projesi" }).click();
	const dialog = page.getByRole("dialog", { name: "Yeni oyun projesi" });
	await dialog.getByLabel("Oyun projesi adı").fill("Saved offline");
	await dialog.getByLabel("Genel sanat yaklaşımı").fill("Soft colors");
	await dialog.getByRole("button", { name: "Proje oluştur" }).click();
	await expect(
		page.getByRole("heading", { name: "Saved offline" })
	).toBeVisible();
	await expect(page.getByRole("alert")).toContainText("son bilinen durumu", {
		timeout: 15_000,
	});
});

test("shows a retry action when Project Context projects fail to load", async ({
	page,
}) => {
	await page.route("**/rpc/projectContexts/list", (route) =>
		route.fulfill({ status: 500, json: { error: "unavailable" } })
	);
	await page.goto("/context-proposals");
	await expect(
		page.getByRole("heading", { name: "Proje Bağlamı" })
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Yeniden dene" })).toBeVisible({
		timeout: 15_000,
	});
	await expect(page.getByRole("link", { name: "Projelere dön" })).toBeVisible();
});
