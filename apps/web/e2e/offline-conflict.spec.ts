import { expect, type Page, test } from "@playwright/test";

const projectId = "00000000-0000-4000-8000-000000000001";
const draftId = "b17f5ff0-a50d-438f-8bf2-a0152b42c401";
const sourceAssetVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c301";
const conflictId = "b17f5ff0-a50d-438f-8bf2-a0152b42c501";
const candidateId = "b17f5ff0-a50d-438f-8bf2-a0152b42c601";
const resolutionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c701";
const localDigest = "digest-of-the-local-draft";
const project = {
	id: projectId,
	name: "Moonlit Vale",
	generalArtDirection: "Readable pixel art",
	createdAt: "2026-10-13T00:00:00.000Z",
	currentContextRevision: null,
};
const pen = {
	type: "pen",
	color: "#00ff00ff",
	size: 1,
	points: [{ x: 0, y: 0 }],
};
const onePixelPng = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
	"base64"
);
const uuidText = /^[0-9a-f-]{36}$/;
const conflictHeading = /Conflict: the cloud Working Draft changed/;
const resolvedText = /Resolved: you created a separate Candidate Version/;
const finalizedText = /was created from the staged Working Draft/;
const stagingUrl = `/projects/${projectId}/offline-staging`;

interface ResolveRequest {
	choice: string;
	confirmAbandon?: boolean;
	idempotencyKey: string;
	shownLocalDigest?: string;
}

const conflictView = (resolution: unknown = null) => ({
	id: conflictId,
	projectId,
	draftId,
	contractVersion: "offline-conflict/1.0.0",
	createdAt: "2026-11-06T10:00:00.000Z",
	base: { revision: 1, sourceAssetVersionId },
	cloud: {
		revision: 2,
		status: "open",
		sourceAssetVersionId,
		committedAssetVersionId: null,
		operations: [pen, { ...pen, color: "#0000ffff" }],
		appliedOperationCount: 2,
	},
	local: { operations: [pen], appliedOperationCount: 1 },
	localDigest,
	resolution,
});

// The cloud is mocked; `cloud.reachable = false` stands in for lost connectivity.
async function mockCloud(page: Page) {
	const cloud = {
		reachable: true,
		baseCurrent: false,
		failNextResolve: false,
		reconciles: 0,
		resolves: [] as ResolveRequest[],
		commits: [] as unknown[],
	};
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
	await page.route("**/pixel-editor/**", (route) => {
		if (!cloud.reachable) {
			return route.abort("internetdisconnected");
		}
		const request = route.request();
		const { pathname } = new URL(request.url());
		if (pathname.endsWith("/reconcile")) {
			cloud.reconciles += 1;
			return route.fulfill({
				status: cloud.baseCurrent ? 200 : 201,
				json: cloud.baseCurrent
					? {
							outcome: "base-current",
							draft: { id: draftId, revision: 1, sourceAssetVersionId },
						}
					: { outcome: "conflict", conflict: conflictView() },
			});
		}
		if (pathname.includes("/preview/")) {
			return route.fulfill({ contentType: "image/png", body: onePixelPng });
		}
		if (pathname.endsWith("/resolve")) {
			const body = request.postDataJSON() as ResolveRequest;
			cloud.resolves.push(body);
			if (cloud.failNextResolve) {
				cloud.failNextResolve = false;
				return route.fulfill({
					status: 503,
					json: { error: "Working Draft commit failed" },
				});
			}
			return route.fulfill({
				status: 201,
				json: {
					created: true,
					conflict: conflictView({
						id: resolutionId,
						choice: body.choice,
						resolvedAt: "2026-11-06T10:05:00.000Z",
						resolvedByUserId: "test-user",
						resultAssetVersionId:
							body.choice === "create-candidate" ? candidateId : null,
						idempotencyKey: body.idempotencyKey,
					}),
				},
			});
		}
		if (pathname.endsWith("/commit")) {
			cloud.commits.push(request.postDataJSON());
			return route.fulfill({
				status: 201,
				json: {
					assetVersionId: candidateId,
					created: true,
					draft: {
						id: draftId,
						projectId,
						assetRecordId: "record-1",
						sourceAssetVersionId,
						status: "committed",
						revision: 2,
						operations: [pen],
						appliedOperationCount: 1,
						canUndo: true,
						canRedo: false,
						sourceSize: { width: 4, height: 4 },
						size: { width: 4, height: 4 },
						diff: {
							changedPixelCount: 1,
							boundingBox: { x: 0, y: 0, width: 1, height: 1 },
							sizeChanged: false,
						},
						palette: { origin: "source-image", colors: ["#ff0000ff"] },
						usedColors: [],
						outOfPaletteColors: [],
						sourcePreviewUrl: "/p",
						previewUrl: "/p",
						committedAssetVersionId: candidateId,
						updatedAt: "2026-11-06T10:06:00.000Z",
					},
				},
			});
		}
		return route.fulfill({ status: 404, json: { error: "Not found" } });
	});
	return cloud;
}

/** Puts a staged Working Draft, pinned to its base, into the browser store the page reads. */
async function seedStagedDraft(page: Page) {
	await page.goto(stagingUrl);
	await expect(
		page
			.getByRole("region", { name: "Project" })
			.getByText("Moonlit Vale", { exact: true })
	).toBeVisible();
	await page.evaluate(
		async ({ draft, project: projectKey, source }) => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open("sprite-anvil-offline-staging");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction("drafts", "readwrite");
				tx.objectStore("drafts").put({
					id: draft,
					projectId: projectKey,
					stagedAt: 1,
					base: { revision: 1, sourceAssetVersionId: source },
					draft: {
						id: draft,
						projectId: projectKey,
						revision: 1,
						sourceAssetVersionId: source,
						operations: [
							{
								type: "pen",
								color: "#00ff00ff",
								size: 1,
								points: [{ x: 0, y: 0 }],
							},
						],
						appliedOperationCount: 1,
					},
				});
				tx.oncomplete = () => resolve();
				tx.onerror = () => reject(tx.error);
			});
			db.close();
		},
		{ draft: draftId, project: projectId, source: sourceAssetVersionId }
	);
	await page.reload();
	await expect(page.getByText("Pinned base revision 1")).toBeVisible();
}

async function reconnect(
	cloud: { reachable: boolean },
	context: { setOffline: (offline: boolean) => Promise<void> },
	page: Page
) {
	cloud.reachable = false;
	await context.setOffline(true);
	await expect(
		page.getByRole("status").filter({ hasText: "Offline" })
	).toBeVisible();
	cloud.reachable = true;
	await context.setOffline(false);
}

test("reconnecting after the cloud advanced shows three versions and a retry reuses the idempotency key", async ({
	context,
	page,
}) => {
	const cloud = await mockCloud(page);
	await seedStagedDraft(page);
	await reconnect(cloud, context, page);

	await expect(
		page.getByRole("heading", { name: conflictHeading })
	).toBeVisible();
	await Promise.all(
		["Base", "Cloud", "Local"].map((title) =>
			expect(
				page.getByRole("img", { name: `${title} version preview` })
			).toBeVisible()
		)
	);
	await expect(page.getByText("Current cloud: revision 2")).toBeVisible();
	await expect(page.getByText("Local Working Draft: pen x1")).toBeVisible();
	// The staged draft is still recoverable while the conflict is open.
	await expect(page.getByText("Pinned base revision 1")).toBeVisible();

	cloud.failNextResolve = true;
	const create = page.getByRole("button", {
		name: "Create a separate Candidate Version from the local draft",
	});
	await create.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("alert")).toContainText(
		"Working Draft commit failed"
	);
	await create.click();
	await expect(page.getByText(resolvedText)).toBeVisible();
	await expect(page.getByText("Pinned base revision 1")).toHaveCount(0);

	expect(cloud.resolves).toHaveLength(2);
	expect(cloud.resolves[0]?.idempotencyKey).toMatch(uuidText);
	expect(cloud.resolves[1]?.idempotencyKey).toBe(
		cloud.resolves[0]?.idempotencyKey
	);
	expect(cloud.resolves[1]?.choice).toBe("create-candidate");
});

test("abandoning shows the local content and needs a separate confirmation", async ({
	context,
	page,
}) => {
	const cloud = await mockCloud(page);
	await seedStagedDraft(page);
	await reconnect(cloud, context, page);
	await expect(
		page.getByRole("heading", { name: conflictHeading })
	).toBeVisible();

	await page.getByRole("button", { name: "Abandon the local draft" }).click();
	const dialog = page.getByRole("alertdialog");
	await expect(dialog).toContainText("This cannot be undone");
	await expect(dialog).toContainText("pen x1");
	expect(cloud.resolves).toHaveLength(0);

	await dialog.getByRole("button", { name: "Keep the local draft" }).click();
	await expect(dialog).toHaveCount(0);
	expect(cloud.resolves).toHaveLength(0);
	await expect(page.getByText("Pinned base revision 1")).toBeVisible();

	await page.getByRole("button", { name: "Abandon the local draft" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Abandon the local draft" })
		.click();
	await expect(page.getByText("Resolved: you abandoned")).toBeVisible();
	expect(cloud.resolves).toHaveLength(1);
	expect(cloud.resolves[0]).toMatchObject({
		choice: "abandon",
		confirmAbandon: true,
		shownLocalDigest: localDigest,
	});
});

test("keeping the cloud retains the staged draft in this browser", async ({
	context,
	page,
}) => {
	const cloud = await mockCloud(page);
	await seedStagedDraft(page);
	await reconnect(cloud, context, page);
	await page
		.getByRole("button", {
			name: "Keep the cloud version and retain the local draft",
		})
		.click();
	await expect(
		page.getByText("kept the cloud version and retained the local draft")
	).toBeVisible();
	await expect(page.getByText("Pinned base revision 1")).toBeVisible();
	expect(cloud.resolves[0]?.choice).toBe("keep-cloud-retain-draft");
});

test("a still-current base is finalized through the normal commit path", async ({
	context,
	page,
}) => {
	const cloud = await mockCloud(page);
	cloud.baseCurrent = true;
	await seedStagedDraft(page);
	await reconnect(cloud, context, page);

	await expect(page.getByText("can be finalized normally")).toBeVisible();
	await expect(
		page.getByRole("heading", { name: conflictHeading })
	).toHaveCount(0);
	await page
		.getByRole("button", { name: "Finalize as a Candidate Version" })
		.click();
	await expect(page.getByText(finalizedText)).toBeVisible();
	expect(cloud.commits).toEqual([{ expectedRevision: 1 }]);
	await expect(page.getByText("Pinned base revision 1")).toHaveCount(0);
});

test("an unreachable cloud during the check leaves the staged draft in place", async ({
	page,
}) => {
	const cloud = await mockCloud(page);
	await seedStagedDraft(page);
	cloud.reachable = false;
	await page
		.getByRole("button", {
			name: "Check staged Working Drafts against the cloud",
		})
		.click();
	await expect(page.getByRole("alert")).toContainText("stays staged");
	await expect(page.getByText("Pinned base revision 1")).toBeVisible();
	expect(cloud.reconciles).toBe(0);
});
