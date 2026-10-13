// biome-ignore-all lint/performance/noAwaitInLoops: Browser navigation and screenshots must run sequentially on the same page.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const loadingCopy = /yükleniyor/;

const projectId = "00000000-0000-4000-8000-000000000001";
const recordId = "00000000-0000-4000-8000-000000000002";
const project = {
	id: projectId,
	name: "Moonlit Vale",
	generalArtDirection: "Readable pixel art",
	createdAt: "2026-10-13T00:00:00.000Z",
	currentContextRevision: {
		id: "00000000-0000-4000-8000-000000000003",
		projectId,
		revisionNumber: 0,
		sourceProposalId: null,
		ruleContractVersion: "context-rule/1.0.0",
		isActive: false,
		rules: [],
		createdAt: "2026-10-13T00:00:00.000Z",
	},
};
const measurements = Object.fromEntries(
	[
		"atlasDimensions",
		"cellDimensions",
		"displayScale",
		"logicalResolution",
		"sourceImageDimensions",
		"visibleContentBounds",
	].map((key) => [key, { confirmed: null, proposal: null }])
);
const record = {
	id: recordId,
	projectId,
	name: "Ash Knight",
	availability: "active",
	assetCategory: "character_creature_animation",
	supportLevel: "general",
	identityCriteria: ["independent_product_meaning"],
	tags: [],
	visualWorldId: null,
	themeId: null,
	measurements,
	createdAt: "2026-10-13T00:00:00.000Z",
};
const catalog = {
	assetFamilies: [],
	assetRecords: [],
	relationships: [],
	subjectIdentities: [],
};
const versions = {
	assetVersions: [],
	canonicalDesigns: [],
	compositeVersions: [],
	unitVersions: [],
};
const screenshots = path.resolve("../../.context");

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
	await page.route("**/rpc/**", (route) => {
		const [, rpc = ""] = new URL(route.request().url()).pathname.split("/rpc/");
		const responses: Record<string, unknown> = {
			"projects/list": [project],
			"projects/get": project,
			"projectContexts/list": [project],
			"contextScopes/list": { visualWorlds: [], themes: [] },
			"contextProposals/list": [],
			"assetRecords/list": [record],
			"assetRecords/get": record,
			"assetRecords/search": {
				records: [{ record, matchingVersions: [] }],
				totalCount: 1,
			},
			"assetRecords/tracking": {
				record,
				tracking: {
					availableRecords: [],
					availableVersions: [],
					approvedVersion: null,
					alternatives: [],
					derivatives: [],
					family: null,
					manualImportEvidenceRequiredVersionIds: [],
					productionHistory: [],
					quality: {
						integrityStatus: "unavailable",
						profileStatus: "general_support",
						verifiedVersionCount: 0,
					},
					references: [],
					reviewEvents: [],
					visualWorlds: [],
				},
			},
			"assetFamilies/list": catalog,
			"assetVersions/list": versions,
			"collections/list": {
				collections: [],
				memberships: [],
				assetRecords: [record],
				assetFamilies: [],
			},
			"specializedProfileContracts/list": {
				profiles: specializedProfileContractCatalog.map((definition) => ({
					definition,
					activeContract: null,
				})),
			},
			"projects/access/list": [],
			"projects/access/listExternalVisualAnalysis": [],
			"generationPackages/list": [],
			"rightsRecords/list": [],
			"gameplayMetadata/list": { frames: [], records: [] },
			"referenceProduction/list": {
				imageReferences: [],
				conflicts: [],
				assetVersionReferences: [],
				effectiveTransferredFeatures: [],
				effectiveForbiddenFeatures: [],
			},
			"dependencyRevalidation/list": {
				dependencyLinks: [],
				contextRevisions: [],
				changeImpacts: [],
				reviews: [],
				revalidationRequiredVersionIds: [],
				canonicalDesigns: [],
			},
			"dependencyRevalidation/listHistoricalCompositions": { pins: [] },
			"dependencyRevalidation/historicalCompositionOptions": {
				contracts: [],
				evidence: [],
			},
		};
		return route.fulfill({ json: { json: responses[rpc] ?? [] } });
	});
	await page.route("**/api/projects/*/import-inbox", (route) =>
		route.fulfill({ json: [] })
	);
});

test("keeps the selected project across all delivered project screens", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(`/projects/${projectId}/assets`);
	const nav = page.getByRole("navigation", { name: "Proje gezinmesi" });
	await expect(nav).toBeVisible();
	for (const label of [
		"Koleksiyonlar",
		"Varlık Aileleri",
		"İçe aktarma",
		"Proje Bağlamı",
		"Özel profil sözleşmeleri",
		"İzinler",
		"Varlık kayıtları",
	]) {
		await nav.getByRole("link", { name: label, exact: true }).click();
		await expect(
			nav.getByRole("link", { name: label, exact: true })
		).toHaveAttribute("aria-current", "page");
		await expect(page.locator("main")).toBeVisible();
		await expect(
			page.getByText("Moonlit Vale", { exact: true }).first()
		).toBeVisible();
	}
	expect(errors).toEqual([]);
});

test("separates finding, creating and editing without losing a draft", async ({
	page,
}) => {
	await page.goto(`/projects/${projectId}/assets`);
	await expect(
		page.getByRole("button", { name: "Ash Knight kaydını aç" })
	).toBeVisible();
	await expect(page.getByLabel("Varlık adı", { exact: true })).toHaveCount(0);
	await page
		.getByRole("button", { name: "Yeni varlık kaydı", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Yeni varlık kaydı" });
	await dialog.getByLabel("Varlık adı", { exact: true }).fill("Draft Knight");
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Yeni varlık kaydı", exact: true })
	).toBeFocused();
	await page.getByRole("button", { name: "Ash Knight kaydını aç" }).click();
	await expect(
		page.getByRole("heading", { name: "Ash Knight", exact: true })
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Görseli yükle", exact: true })
	).toBeHidden();
	await page
		.getByRole("button", { name: "Üretim ve içe aktarma", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Görseli yükle", exact: true })
	).toBeVisible();
	await page
		.getByRole("button", { name: "Kayıt bilgileri", exact: true })
		.click();
	await page.getByLabel("Etiketler", { exact: true }).fill("unfinished-edit");
	await page
		.getByRole("button", { name: "Sürümler ve dosyalar", exact: true })
		.click();
	await expect(page.getByLabel("Etiketler", { exact: true })).toBeHidden();
	await page
		.getByRole("button", { name: "Kayıt bilgileri", exact: true })
		.click();
	await expect(page.getByLabel("Etiketler", { exact: true })).toHaveValue(
		"unfinished-edit"
	);
	await page
		.getByRole("link", { name: "Varlık kayıtlarına dön", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Ash Knight kaydını aç" })
	).toBeVisible();
});

test("shows a recovery action for failed record loading", async ({ page }) => {
	await page.route("**/rpc/assetRecords/get*", (route) =>
		route.fulfill({
			status: 500,
			json: {
				json: {
					code: "INTERNAL_SERVER_ERROR",
					message: "Internal server error",
					data: {
						supportReference: "SUP-00000000-0000-4000-8000-000000000009",
					},
				},
			},
		})
	);
	await page.goto(`/projects/${projectId}/assets/${recordId}`);
	await expect(
		page.getByRole("heading", { name: "Varlık kaydı açılamadı" })
	).toBeVisible({ timeout: 15_000 });
	await expect(
		page.locator("main").getByRole("button", { name: "Yeniden dene" })
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Varlık kayıtlarına dön", exact: true })
	).toBeVisible();
	await page.unroute("**/rpc/assetRecords/get*");
	await page
		.locator("main")
		.getByRole("button", { name: "Yeniden dene" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Ash Knight", exact: true })
	).toBeVisible();
});

test("keeps controls reachable at desktop and narrow sizes and captures actual screens", async ({
	page,
}) => {
	test.setTimeout(60_000);
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await mkdir(screenshots, { recursive: true });
	const screens = [
		{ slug: "projects", url: "/projects" },
		{ slug: "library", url: `/projects/${projectId}/assets` },
		{ slug: "record", url: `/projects/${projectId}/assets/${recordId}` },
		{ slug: "families", url: `/projects/${projectId}/asset-families` },
		{ slug: "collections", url: `/projects/${projectId}/collections` },
		{ slug: "context", url: `/context-proposals?projectId=${projectId}` },
		{ slug: "import", url: `/projects/${projectId}/import-inbox` },
		{ slug: "profiles", url: `/projects/${projectId}/profile-contracts` },
		{ slug: "access", url: `/projects/${projectId}/access` },
	];
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 900 });
		for (const screen of screens) {
			await page.goto(screen.url);
			await expect(page.locator("main")).toBeVisible();
			await expect(
				page.getByRole("navigation", { name: "Ana gezinme" })
			).toBeVisible();
			await expect(page.locator("main").getByText(loadingCopy)).toHaveCount(0);
			await expect
				.poll(() =>
					page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth
					)
				)
				.toBe(true);
			expect(
				await page
					.locator("main")
					.evaluate((el) => getComputedStyle(el).overflowY)
			).not.toBe("auto");
			await page.screenshot({
				path: path.join(screenshots, `ui-${screen.slug}-${width}.png`),
				fullPage: true,
			});
		}
	}
	expect(errors).toEqual([]);
});

test("reveals detailed filters without crowding the first search", async ({
	page,
}) => {
	await page.goto(`/projects/${projectId}/assets`);
	await expect(page.getByLabel("Ada göre ara")).toBeVisible();
	await expect(page.getByLabel("Kaynak Görsel genişliği (px)")).toBeHidden();
	await page.getByText("Diğer filtreler", { exact: true }).click();
	await expect(page.getByLabel("Kaynak Görsel genişliği (px)")).toBeVisible();
	await page.getByLabel("Kaynak Görsel genişliği (px)").fill("64");
	await page.getByText("Diğer filtreler", { exact: true }).click();
	await page
		.getByRole("button", { name: "Varlık kayıtlarını ara", exact: true })
		.click();
	await expect(page.getByText("1 varlık kaydı bulundu.")).toBeVisible();
});

test("makes implicit context selection explicit in navigation", async ({
	page,
}) => {
	await page.goto("/context-proposals");
	await expect(page).toHaveURL(`/context-proposals?projectId=${projectId}`);
	await expect(
		page.getByRole("navigation", { name: "Proje gezinmesi" })
	).toBeVisible();
});
test("returns from an unknown page to the project list", async ({ page }) => {
	await page.goto("/missing-workspace-page");
	await expect(
		page.getByRole("heading", { name: "Sayfa bulunamadı", exact: true })
	).toBeVisible();
	await page
		.getByRole("link", { name: "Oyun projelerine dön", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Oyun projeleri", exact: true })
	).toBeVisible();
});

test("offers recovery when a screen cannot render", async ({ page }) => {
	await page.route("**/rpc/assetFamilies/list*", (route) =>
		route.fulfill({ json: { json: {} } })
	);
	await page.goto(`/projects/${projectId}/asset-families`);
	await expect(
		page.getByRole("heading", { name: "Ekran açılamadı", exact: true })
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Yeniden dene", exact: true })
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Oyun projelerine dön", exact: true })
	).toBeVisible();
	await page.unroute("**/rpc/assetFamilies/list*");
	await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
	await expect(
		page.getByRole("heading", {
			name: "Varlık Kimliği ve Aileler",
			exact: true,
		})
	).toBeVisible();
});

test("opens family records and focuses evidence on the selected family", async ({
	page,
}) => {
	const identityId = "00000000-0000-4000-8000-000000000011";
	const familyId = "00000000-0000-4000-8000-000000000012";
	const secondFamilyId = "00000000-0000-4000-8000-000000000013";
	const visualWorldId = "00000000-0000-4000-8000-000000000014";
	const families = [
		{
			id: familyId,
			name: "Game Sprite",
			projectId,
			subjectIdentityId: identityId,
			visualWorldId,
			useContext: "gameplay",
			createdAt: record.createdAt,
		},
		{
			id: secondFamilyId,
			name: "Painted Portrait",
			projectId,
			subjectIdentityId: identityId,
			visualWorldId,
			useContext: "marketing",
			createdAt: record.createdAt,
		},
	];
	await page.route("**/rpc/assetFamilies/list*", (route) =>
		route.fulfill({
			json: {
				json: {
					...catalog,
					assetFamilies: families,
					assetRecords: [
						{
							id: recordId,
							projectId,
							assetFamilyId: familyId,
							name: record.name,
							createdAt: record.createdAt,
						},
					],
					subjectIdentities: [
						{
							id: identityId,
							projectId,
							name: "Ash Knight Identity",
							createdAt: record.createdAt,
						},
					],
				},
			},
		})
	);
	await page.route("**/rpc/contextScopes/list*", (route) =>
		route.fulfill({
			json: {
				json: {
					visualWorlds: [
						{
							id: visualWorldId,
							projectId,
							name: "Gameplay",
							createdAt: record.createdAt,
						},
					],
					themes: [],
				},
			},
		})
	);
	await page.route("**/rpc/familyReadiness/list*", (route) =>
		route.fulfill({
			json: {
				json: {
					projectId,
					assetFamilyId: familyId,
					status: "not_configured",
					activeRevision: null,
					revisions: [],
					items: [],
				},
			},
		})
	);
	await page.goto(`/projects/${projectId}/asset-families`);
	await expect(
		page.getByRole("link", { name: "Ash Knight", exact: true })
	).toHaveAttribute("href", `/projects/${projectId}/assets/${recordId}`);
	await page.screenshot({
		path: path.join(screenshots, "ui-family-catalog-populated.png"),
		fullPage: true,
	});
	await page
		.getByRole("button", { name: "Tamamlanma ve kanıtlar", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Game Sprite", exact: true })
	).toBeVisible();
	await page
		.getByLabel("İnceleme ve tamamlanma için aile")
		.selectOption(secondFamilyId);
	await expect(
		page.getByRole("heading", { name: "Painted Portrait", exact: true })
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Game Sprite", exact: true })
	).toHaveCount(0);
	await page.screenshot({
		path: path.join(screenshots, "ui-family-readiness-selected.png"),
		fullPage: true,
	});
	await page
		.getByRole("button", { name: "Aile kataloğu", exact: true })
		.click();
	await page.getByRole("link", { name: "Ash Knight", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Ash Knight", exact: true })
	).toBeVisible();
});

test("keeps every task panel reachable in a narrow window", async ({
	page,
}) => {
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 390, height: 844 });
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	for (const url of [
		`/projects/${projectId}/assets`,
		`/projects/${projectId}/assets/${recordId}`,
		`/projects/${projectId}/asset-families`,
		`/context-proposals?projectId=${projectId}`,
		`/projects/${projectId}/import-inbox`,
		`/projects/${projectId}/profile-contracts`,
	]) {
		await page.goto(url);
		const tasks = page.locator("main nav button[aria-controls][aria-pressed]");
		await expect(tasks.first()).toBeVisible();
		const taskCount = await tasks.count();
		for (let index = 0; index < taskCount; index += 1) {
			const task = tasks.nth(index);
			await task.click();
			await expect(task).toHaveAttribute("aria-pressed", "true");
			const panelId = await task.getAttribute("aria-controls");
			await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
			await expect
				.poll(() =>
					page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth
					)
				)
				.toBe(true);
		}
	}
	expect(errors).toEqual([]);
});
