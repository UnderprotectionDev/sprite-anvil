import { expect, test } from "@playwright/test";

const project = {
	id: "00000000-0000-4000-8000-000000000001",
	name: "Moonlit Vale",
};
const moonlitValePattern = /Moonlit Vale/u;
const projectsUrlPattern = /\/projects$/u;

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
			name: "Sprite Anvil",
		})
	).toBeVisible();
	await expect(
		page.getByRole("heading", { level: 2, name: "Sign in" })
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
	await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
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
	await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});

test("opens and dismisses project creation without losing the project list", async ({
	page,
}) => {
	await page.goto("/projects");
	await expect(page.getByRole("heading", { name: project.name })).toBeVisible();
	const trigger = page.getByRole("button", { name: "New project" });
	await trigger.click();
	const dialog = page.getByRole("dialog", { name: "New project" });
	await expect(dialog).toBeVisible();
	await dialog.getByLabel("Game project name").fill("Another game");
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
	await page.getByRole("button", { name: "Second game" }).click();
	await page.getByRole("link", { name: "Details" }).click();
	await expect(page.getByRole("heading", { name: "Details" })).toBeVisible();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.getByRole("link", { name: "Back to Projects" }).click();
	await expect(
		page.getByRole("link", { name: "Second game open project" })
	).toBeVisible();
	await page.goto(`/context-proposals?projectId=${secondProject.id}`);
	await expect
		.poll(() => new URL(page.url()).searchParams.get("projectId"))
		.toBe(secondProject.id);
	await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue(
		secondProject.id
	);
	await page.getByRole("button", { name: "New project" }).click();
	await expect(page.getByRole("dialog", { name: "New project" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog", { name: "New project" })).toHaveCount(
		0
	);
	await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue(
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
	await page.getByLabel("Project name").fill(created.name);
	await page.getByLabel("Art direction").fill(created.generalArtDirection);
	await page.getByRole("button", { name: "Create project" }).click();
	await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue(
		created.id
	);
	await page.getByRole("link", { name: "Back to projects" }).click();
	await expect(page.getByRole("heading", { name: created.name })).toBeVisible();
});

test("does not silently open another Project Context from an invalid project link", async ({
	page,
}) => {
	await page.route("**/rpc/projectContexts/list", (route) =>
		route.fulfill({ json: { json: [asContextProject(project)] } })
	);
	await page.goto("/context-proposals?projectId=not-a-uuid");
	await expect(page.getByRole("alert")).toContainText(
		"This project was not found"
	);
	await expect(page.getByRole("combobox", { name: "Project" })).toHaveCount(0);

	await page.goto("/context-proposals?projectId=");
	await expect(page.getByRole("alert")).toContainText(
		"This project was not found"
	);
	await expect(page.getByRole("combobox", { name: "Project" })).toHaveCount(0);

	await page.goto(
		"/context-proposals?projectId=00000000-0000-4000-8000-000000000099"
	);
	await expect(page.getByRole("alert")).toContainText(
		"This project was not found"
	);
	await expect(page.getByRole("combobox", { name: "Project" })).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Back to projects" }).last()
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
	await page.getByRole("button", { name: "New project" }).click();
	const dialog = page.getByRole("dialog", { name: "New project" });
	await dialog.getByLabel("Game project name").fill("Second game");
	await dialog.getByLabel("General art direction").fill("Muted pixel art");
	await dialog.getByRole("button", { name: "Create project" }).click();
	await expect(dialog).toHaveCount(0);
	await expect(
		page.getByRole("heading", { name: "Second game" })
	).toBeVisible();
	await expect(page.getByText("Game project saved.")).toBeVisible();
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
	await page.getByRole("button", { name: "New project" }).click();
	const dialog = page.getByRole("dialog", { name: "New project" });
	await dialog.getByLabel("Game project name").fill("Saved offline");
	await dialog.getByLabel("General art direction").fill("Soft colors");
	await dialog.getByRole("button", { name: "Create project" }).click();
	await expect(
		page.getByRole("heading", { name: "Saved offline" })
	).toBeVisible();
	await expect(page.getByRole("alert")).toContainText("last known state", {
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
		page.getByRole("heading", { name: "Project Context" })
	).toBeVisible();
	await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({
		timeout: 15_000,
	});
	await expect(
		page.getByRole("link", { name: "Back to projects" })
	).toBeVisible();
});

test("opens the account Project Archive from workspace navigation", async ({
	page,
}) => {
	await page.route("**/rpc/projectArchives/list", (route) =>
		route.fulfill({ json: { json: { archives: [] } } })
	);
	await page.goto("/projects");
	await page
		.getByRole("link", { name: "Project Archive", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Project Archive", exact: true })
	).toBeVisible();
	await expect(page.getByText("No archives yet")).toBeVisible();
});

test("Paper new project look picker stays aligned after selecting and copying", async ({
	page,
}) => {
	const records = [
		{ ...project, generalArtDirection: "Soft moonlight" },
		{
			id: "00000000-0000-4000-8000-000000000002",
			name: "Night Market",
			generalArtDirection: "Lantern light",
		},
	];
	await page.route("**/rpc/projects/list", (route) =>
		route.fulfill({ json: { json: records } })
	);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/projects");
	await page.getByRole("button", { name: "New project" }).click();
	const dialog = page.getByRole("dialog", { name: "New project" });
	await dialog.getByLabel("Game project name").fill("Night Market");
	await expect(
		dialog.getByText("A project with this name already exists.")
	).toBeVisible();
	await expect(
		dialog.getByRole("button", { name: "Create project", exact: true })
	).toBeDisabled();
	await dialog.getByLabel("Game project name").fill("New harbor");
	await dialog
		.getByRole("button", { name: "Select Night Market look" })
		.click();
	await expect(dialog.getByLabel("General art direction")).toHaveValue("");
	await dialog
		.getByRole("button", { name: "Copy approach from Night Market" })
		.click();
	await expect(dialog.getByLabel("General art direction")).toHaveValue(
		"Lantern light"
	);
	await dialog
		.getByLabel("Upload image")
		.setInputFiles("public/account-art-1.png");
	await expect(dialog.getByAltText("Uploaded project look")).toBeVisible();
	await expect(dialog.getByText("Your image", { exact: true })).toHaveCount(2);
	const removeImage = dialog.getByRole("button", {
		name: "Remove uploaded image",
	});
	await expect(removeImage).toBeVisible();
	await removeImage.click();
	await expect(dialog.getByAltText("Uploaded project look")).toHaveCount(0);
	await expect(dialog.getByLabel("General art direction")).toHaveValue(
		"Lantern light"
	);
	await expect
		.poll(() =>
			dialog.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				return Math.abs(rect.top - (window.innerHeight - rect.bottom));
			})
		)
		.toBeLessThanOrEqual(2);
	await expect
		.poll(() =>
			dialog.evaluate((element) => ({
				overflow: element.scrollWidth - element.clientWidth,
				offset: element.scrollLeft,
			}))
		)
		.toEqual({ overflow: 0, offset: 0 });
	await page.setViewportSize({ width: 900, height: 650 });
	await expect
		.poll(() =>
			dialog.evaluate((element) => {
				const rect = element.getBoundingClientRect();
				return Math.abs(rect.top - (window.innerHeight - rect.bottom));
			})
		)
		.toBeLessThanOrEqual(2);
	await expect
		.poll(() =>
			dialog.evaluate((element) => ({
				overflow: element.scrollWidth - element.clientWidth,
				offset: element.scrollLeft,
			}))
		)
		.toEqual({ overflow: 0, offset: 0 });
	await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
});

test("restore uses the persisted operation and opens the verified new project", async ({
	page,
}) => {
	const archiveId = "00000000-0000-4000-8000-000000000021";
	const restoreId = "00000000-0000-4000-8000-000000000022";
	const operationId = "00000000-0000-4000-8000-000000000023";
	const restoredId = "00000000-0000-4000-8000-000000000024";
	const operation = {
		id: operationId,
		projectId: project.id,
		kind: "restore",
		scopeTargetId: restoreId,
		status: "completed",
		progressPercent: 100,
		progressStep: "Verified",
		resultSummary: "Restore completed",
	};
	await page.route("**/rpc/projectArchives/get", (route) =>
		route.fulfill({
			json: {
				json: {
					id: archiveId,
					createdAt: "2026-10-24T14:02:00.000Z",
					manifest: { files: [], contents: [] },
				},
			},
		})
	);
	await page.route("**/rpc/projectArchives/requestRestore", (route) =>
		route.fulfill({ json: { json: operation } })
	);
	await page.route("**/rpc/backgroundOperations/list", (route) =>
		route.fulfill({ json: { json: { operations: [operation] } } })
	);
	await page.route("**/rpc/projectArchives/getRestore", (route) =>
		route.fulfill({
			json: { json: { id: restoreId, restoredProjectId: restoredId } },
		})
	);
	await page.route("**/rpc/projectArchives/getRestoreOperation", (route) =>
		route.fulfill({
			json: {
				json: {
					operation,
					restore: {
						id: restoreId,
						restoredProjectId: restoredId,
						archiveId,
						sections: [],
						files: [],
					},
				},
			},
		})
	);
	await page.goto(
		`/projects/${project.id}/project-archives?task=restore&archiveId=${archiveId}`
	);
	await page.getByLabel("New project name").fill("Restored game");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(
		page.getByRole("heading", { name: "Your new project is ready" })
	).toBeVisible();
	await expect(
		page.getByText("Waiting for progress", { exact: true })
	).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Open project", exact: true })
	).toHaveAttribute("href", `/projects/${restoredId}/assets`);
	await expect
		.poll(() => new URL(page.url()).searchParams.get("operationId"))
		.toBe(operationId);
	await page.reload();
	await expect(
		page.getByRole("link", { name: "Open project", exact: true })
	).toHaveAttribute("href", `/projects/${restoredId}/assets`);
});

test("failed restore shows the verified failure and does not offer a new project", async ({
	page,
}) => {
	const operationId = "00000000-0000-4000-8000-000000000025";
	await page.route("**/rpc/backgroundOperations/list", (route) =>
		route.fulfill({
			json: {
				json: {
					operations: [
						{
							id: operationId,
							status: "failed",
							failureSummary: "Archive failed verification.",
						},
					],
				},
			},
		})
	);
	await page.route("**/rpc/projectArchives/getRestoreOperation", (route) =>
		route.fulfill({
			json: {
				json: {
					operation: {
						id: operationId,
						kind: "restore",
						status: "failed",
						failureSummary: "Archive failed verification.",
					},
					restore: null,
				},
			},
		})
	);
	await page.goto(
		`/projects/${project.id}/project-archives?task=restore&archiveId=00000000-0000-4000-8000-000000000021&operationId=${operationId}`
	);
	await expect(
		page.getByRole("heading", { name: "This archive can’t be restored" })
	).toBeVisible();
	await expect(page.getByText("Archive failed verification.")).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Open project", exact: true })
	).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Try another file" })
	).toBeVisible();
});

test("sign-in failure stays inside the Paper panel and can be retried", async ({
	page,
}) => {
	await page.route("**/api/auth/sign-in/email", (route) =>
		route.fulfill({
			status: 401,
			json: {
				code: "INVALID_EMAIL_OR_PASSWORD",
				message: "Invalid email or password",
			},
		})
	);
	await page.goto("/login");
	await page.getByLabel("Email", { exact: true }).fill("artist@example.test");
	await page.getByLabel("Password", { exact: true }).fill("wrongpassword");
	await page.getByRole("button", { name: "Sign In", exact: true }).click();
	await expect(page.getByRole("alert")).toContainText("Sign-in did not finish");
	await expect(
		page.getByRole("button", { name: "Try signing in again" })
	).toBeEnabled();
	await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
		"artist@example.test"
	);
});

test("active archive creation is locked and its operation survives reload", async ({
	page,
}) => {
	const operationId = "00000000-0000-4000-8000-000000000029";
	const operation = {
		id: operationId,
		projectId: project.id,
		kind: "archive",
		scopeSummary: "Archive request",
		status: "running",
		progressPercent: null,
		progressStep: null,
		resultSummary: null,
	};
	await page.route("**/rpc/projectArchives/listWorkingFiles", (route) =>
		route.fulfill({ json: { json: { files: [], nextCursor: null } } })
	);
	await page.route("**/rpc/projectArchives/requestArchive", (route) =>
		route.fulfill({ json: { json: operation } })
	);
	await page.route("**/rpc/backgroundOperations/list", (route) =>
		route.fulfill({ json: { json: { operations: [operation] } } })
	);
	await page.goto(`/projects/${project.id}/project-archives?task=create`);
	await page
		.getByRole("button", { name: "Create archive", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Creating…", exact: true })
	).toBeDisabled();
	await expect
		.poll(() => new URL(page.url()).searchParams.get("operationId"))
		.toBe(operationId);
	await page.reload();
	await expect(
		page.getByRole("button", { name: "Creating…", exact: true })
	).toBeDisabled();
});

test("restore matches the Paper horizontal stages and real archive selector", async ({
	page,
}) => {
	const archiveId = "00000000-0000-4000-8000-000000000021";
	const archive = {
		id: archiveId,
		projectId: project.id,
		createdAt: "2026-10-24T14:02:00.000Z",
		manifest: { files: [], contents: [] },
	};
	await page.route("**/rpc/projectArchives/list", (route) =>
		route.fulfill({ json: { json: { archives: [archive] } } })
	);
	await page.route("**/rpc/projectArchives/get", (route) =>
		route.fulfill({ json: { json: archive } })
	);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(
		`/projects/${project.id}/project-archives?task=restore&archiveId=${archiveId}`
	);
	const select = page.getByRole("region", { name: "Select archive" });
	const check = page.getByRole("region", { name: "Integrity check" });
	const result = page.getByRole("region", { name: "Open new project" });
	await expect(select).toBeVisible();
	await expect(
		select.getByRole("button", { name: "Browse files" })
	).toBeVisible();
	await expect(
		select.getByRole("button", { name: moonlitValePattern })
	).toBeVisible();
	await expect(check).toBeVisible();
	await expect(result).toBeVisible();
	const [a, b, c] = await Promise.all([
		select.boundingBox(),
		check.boundingBox(),
		result.boundingBox(),
	]);
	expect(a && b && c).toBeTruthy();
	if (a && b && c) {
		expect(Math.abs(a.y - b.y)).toBeLessThan(2);
		expect(Math.abs(b.y - c.y)).toBeLessThan(2);
		expect(a.width).toBeGreaterThan(b.width * 2);
		expect(b.x).toBeGreaterThan(a.x);
		expect(c.x).toBeGreaterThan(b.x);
	}
	await select.getByLabel("New project name").fill("New restored project");
	await expect(select.getByRole("button", { name: "Continue" })).toBeEnabled();
	const fileChooser = page.waitForEvent("filechooser");
	await select.getByRole("button", { name: "Browse files" }).click();
	await (await fileChooser).setFiles({
		name: "not-an-archive.png",
		mimeType: "image/png",
		buffer: Buffer.from("invalid"),
	});
	await expect(
		select.getByText("Choose a non-empty ZIP archive.")
	).toBeVisible();
	await expect(select.getByRole("button", { name: "Continue" })).toBeDisabled();
	await select.getByRole("button", { name: "Remove archive file" }).click();
	await expect(select.getByRole("button", { name: "Continue" })).toBeEnabled();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(select.getByRole("button", { name: "Continue" })).toBeVisible();
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth)
	).toBeLessThanOrEqual(390);
});

test("restore progress expands the middle stage and shows only recorded evidence", async ({
	page,
}) => {
	const archiveId = "00000000-0000-4000-8000-000000000021";
	const operationId = "00000000-0000-4000-8000-000000000027";
	await page.route("**/rpc/projectArchives/get", (route) =>
		route.fulfill({
			json: {
				json: {
					id: archiveId,
					createdAt: "2026-10-24T14:02:00.000Z",
					manifest: {
						contents: [],
						files: [
							{
								sourceId: "ev-one",
								fileName: "runtime-capture.zip",
								kind: "runtime_evidence_file",
								presence: "excluded",
								byteSize: 100,
							},
						],
					},
				},
			},
		})
	);
	await page.route("**/rpc/backgroundOperations/list", (route) =>
		route.fulfill({
			json: {
				json: {
					operations: [
						{
							id: operationId,
							status: "running",
							progressPercent: null,
							progressStep: null,
						},
					],
				},
			},
		})
	);
	await page.route("**/rpc/projectArchives/getRestoreOperation", (route) =>
		route.fulfill({
			json: {
				json: {
					operation: {
						id: operationId,
						kind: "restore",
						status: "running",
						progressPercent: null,
						progressStep: null,
					},
					restore: null,
				},
			},
		})
	);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(
		`/projects/${project.id}/project-archives?task=restore&archiveId=${archiveId}&operationId=${operationId}`
	);
	const check = page.getByRole("region", { name: "Integrity check" });
	await expect(check.getByRole("progressbar")).toBeVisible();
	await expect(check.getByRole("progressbar")).not.toHaveAttribute(
		"aria-valuenow"
	);
	await expect(check.getByText("runtime-capture.zip")).toBeVisible();
	await expect(check.getByText("Evidence left out")).toBeVisible();
	const first = await page
		.getByRole("region", { name: "Select archive" })
		.boundingBox();
	const middle = await check.boundingBox();
	expect(first && middle).toBeTruthy();
	if (first && middle) {
		expect(middle.width).toBeGreaterThan(first.width * 2);
		expect(middle.x).toBeGreaterThan(first.x);
	}
});

test("restore completed operation without verified result never displays success", async ({
	page,
}) => {
	const operationId = "00000000-0000-4000-8000-000000000023";
	await page.route("**/rpc/projectArchives/getRestoreOperation", (route) =>
		route.fulfill({
			json: {
				json: {
					operation: { id: operationId, kind: "restore", status: "completed" },
					restore: null,
				},
			},
		})
	);
	await page.goto(
		`/projects/${project.id}/project-archives?task=upload&operationId=${operationId}`
	);
	await expect(
		page.getByText(
			"The selected operation or its verified result could not be read."
		)
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Your new project is ready" })
	).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Open project", exact: true })
	).toHaveCount(0);
});
test("verified ZIP restore opens the exact new project", async ({ page }) => {
	const operationId = "00000000-0000-4000-8000-000000000023";
	const restoredId = "00000000-0000-4000-8000-000000000024";
	await page.route("**/rpc/projectArchives/getRestoreOperation", (route) =>
		route.fulfill({
			json: {
				json: {
					operation: { id: operationId, kind: "restore", status: "completed" },
					restore: {
						restoredProjectId: restoredId,
						sections: [],
						files: [
							{
								sourceId: "evidence-1",
								kind: "runtime_evidence_file",
								presence: "excluded",
								byteSize: 20,
								exclusionReason: "evidence_not_archived",
							},
						],
					},
				},
			},
		})
	);
	await page.goto(
		`/projects/${project.id}/project-archives?task=upload&operationId=${operationId}`
	);
	await expect(
		page.getByRole("link", { name: "Open project", exact: true })
	).toHaveAttribute("href", `/projects/${restoredId}/assets`);
	await page.getByText("Evidence and files left out").click();
	await expect(
		page.getByText(
			"evidence-1 · runtime_evidence_file · 20 bytes · evidence_not_archived"
		)
	).toBeVisible();
});

test("requires exact project deletion confirmation and shows a rejected approval", async ({
	page,
}) => {
	await page.route("**/rpc/projectContexts/list", (route) =>
		route.fulfill({ json: { json: [asContextProject(project)] } })
	);
	await page.route("**/rpc/projects/deletion/prepare*", (route) =>
		route.fulfill({
			json: {
				json: {
					projectId: project.id,
					projectName: project.name,
					scopeDigest: "a".repeat(64),
					records: [{ kind: "asset_records", count: 3 }],
					managedObjects: 3,
					sharedObjects: 0,
					blocked: false,
				},
			},
		})
	);
	await page.route("**/rpc/projects/deletion/approve*", (route) =>
		route.fulfill({
			status: 409,
			json: {
				json: {
					defined: true,
					code: "CONFLICT",
					status: 409,
					message: "The deletion scope changed. Review a fresh impact report.",
				},
			},
		})
	);
	await page.goto(`/projects/${project.id}/details`);
	await page.getByRole("button", { name: "Delete project…" }).click();
	const dialog = page.getByRole("dialog", { name: "Delete project" });
	await expect(dialog.getByText("3 records · 3 managed files")).toBeVisible();
	const confirmation = dialog.getByLabel(
		"Type the exact project name to confirm"
	);
	const submit = dialog.getByRole("button", {
		name: "Permanently delete project",
	});
	await expect(submit).toBeDisabled();
	await confirmation.fill("Wrong name");
	await expect(submit).toBeDisabled();
	await confirmation.fill(project.name);
	await expect(submit).toBeEnabled();
	await submit.click();
	await expect(dialog.getByRole("alert")).toContainText(
		"The deletion scope changed"
	);
	await expect(dialog).toBeVisible();
});
