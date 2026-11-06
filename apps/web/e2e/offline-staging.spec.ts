import { expect, type Page, test } from "@playwright/test";

const projectId = "00000000-0000-4000-8000-000000000001";
const project = {
	id: projectId,
	name: "Moonlit Vale",
	generalArtDirection: "Readable pixel art",
	createdAt: "2026-10-13T00:00:00.000Z",
	currentContextRevision: null,
};
const pngBytes = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);

interface Upload {
	idempotencyKey: string | undefined;
	name: string | undefined;
	size: number;
}

// The cloud is mocked; `cloud.reachable = false` stands in for lost connectivity.
async function mockCloud(page: Page) {
	const cloud = { reachable: true, uploads: [] as Upload[] };
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
	await page.route("**/rpc/**", (route) => {
		if (!cloud.reachable) {
			return route.abort("internetdisconnected");
		}
		const [, rpc = ""] = new URL(route.request().url()).pathname.split("/rpc/");
		return route.fulfill({
			json: { json: rpc === "projects/get" ? project : [] },
		});
	});
	await page.route("**/api/projects/*/import-inbox", (route) => {
		if (!cloud.reachable) {
			return route.abort("internetdisconnected");
		}
		const request = route.request();
		if (request.method() === "POST") {
			const headers = request.headers();
			cloud.uploads.push({
				idempotencyKey: headers["idempotency-key"],
				name: headers["x-import-inbox-file-name"],
				size: request.postDataBuffer()?.length ?? 0,
			});
			return route.fulfill({ status: 201, json: {} });
		}
		return route.fulfill({ json: [] });
	});
	return cloud;
}

const cachedCopyText = /Moonlit Vale \(cached copy/;
const stayStagedText = /staged file\(s\) stay staged/;
const enteredInboxText = /entered the Import Inbox/;
const uuidText = /^[0-9a-f-]{36}$/;
const offlineText = /^Offline$/;
const stagingUrl = `/projects/${projectId}/offline-staging`;

async function stagePng(page: Page) {
	await page.getByLabel("Stage a PNG file").setInputFiles({
		name: "ash-knight.png",
		mimeType: "image/png",
		buffer: pngBytes,
	});
}

test("a cached project and a staged PNG survive a reload without the cloud", async ({
	context,
	page,
}) => {
	const cloud = await mockCloud(page);
	await page.goto(stagingUrl);
	await expect(
		page
			.getByRole("region", { name: "Project" })
			.getByText("Moonlit Vale", { exact: true })
	).toBeVisible();

	cloud.reachable = false;
	await context.setOffline(true);
	await expect(
		page.getByRole("status").filter({ hasText: offlineText })
	).toBeVisible();
	await stagePng(page);
	await expect(page.getByText("ash-knight.png", { exact: true })).toBeVisible();
	await expect(page.getByText("waiting for the Import Inbox")).toBeVisible();

	// Cloud still unreachable after reload: the cached project and staged file come from the browser.
	await context.setOffline(false);
	await page.reload();
	await expect(
		page.getByRole("region", { name: "Project" }).getByText(cachedCopyText)
	).toBeVisible();
	await expect(page.getByText("ash-knight.png", { exact: true })).toBeVisible();
	await page
		.getByRole("button", { name: "Send staged files to the Import Inbox" })
		.click();
	await expect(page.getByText(stayStagedText)).toBeVisible();
	await expect(page.getByText("ash-knight.png", { exact: true })).toBeVisible();
	expect(cloud.uploads).toEqual([]);
});

test("reconnecting sends the staged file to the Import Inbox once, keyed for retries", async ({
	context,
	page,
}) => {
	const cloud = await mockCloud(page);
	await page.goto(stagingUrl);
	await expect(
		page
			.getByRole("region", { name: "Project" })
			.getByText("Moonlit Vale", { exact: true })
	).toBeVisible();

	cloud.reachable = false;
	await context.setOffline(true);
	await stagePng(page);
	await expect(page.getByText("ash-knight.png", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Send staged files to the Import Inbox" })
	).toBeDisabled();

	cloud.reachable = true;
	await context.setOffline(false);
	await expect(page.getByText("No staged files.")).toBeVisible();
	await expect(page.getByText(enteredInboxText)).toBeVisible();
	expect(cloud.uploads).toHaveLength(1);
	expect(cloud.uploads[0]).toMatchObject({
		name: "ash-knight.png",
		size: pngBytes.length,
	});
	expect(cloud.uploads[0]?.idempotencyKey).toMatch(uuidText);
});

test("a file that is not a PNG is refused and not staged", async ({ page }) => {
	await mockCloud(page);
	await page.goto(stagingUrl);
	await page.getByLabel("Stage a PNG file").setInputFiles({
		name: "notes.png",
		mimeType: "image/png",
		buffer: Buffer.from("not an image"),
	});
	await expect(page.getByText("Only PNG files can be staged.")).toBeVisible();
	await expect(page.getByText("No staged files.")).toBeVisible();
});
