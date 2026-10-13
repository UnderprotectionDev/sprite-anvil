import { expect, type Page, test } from "@playwright/test";
import type { SceneQaInput, SceneQaRecord } from "@sprite-anvil/api/scene-qa";
import { sceneQaRoleProfiles, sceneQaRoles } from "@sprite-anvil/api/scene-qa";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { animationTimingFixture } from "./animation-timing-review-fixture";

const projectId = "scene-project";
const profileIds = [...new Set(Object.values(sceneQaRoleProfiles))];
const profiles = profileIds.map((profileId) => {
	const definition = specializedProfileContractCatalog.find(
		(c) => c.profileId === profileId
	);
	if (!definition) {
		throw new Error("Missing scene profile fixture.");
	}
	return {
		definition,
		activeContract: {
			projectId,
			contractRevisionId: `${profileId}@1`,
			contract: definition,
			activatedByUserId: "owner",
			activatedAt: "2026-10-13T00:00:00.000Z",
		},
	};
});
const assets = sceneQaRoles.map((role) => ({
	id: `${role}-asset`,
	name: `Forest ${role}`,
	projectId,
	assetCategory: sceneQaRoleProfiles[role],
	availability: "active",
}));
const versions = sceneQaRoles.map((role) => ({
	id: `${role}-version`,
	assetRecordId: `${role}-asset`,
	assetFamilyId: `${role}-family`,
	versionNumber: 1,
	contentDigest: "a".repeat(64),
	integrityVerified: true,
	sourceImageDimensions: { width: 32, height: 32 },
	previewUrl: `/scene-fixture/${role}.png`,
}));
async function prepare(
	page: Page,
	unreadable = false,
	loseSaveResponse = false
) {
	const records: SceneQaRecord[] = [];
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				session: {
					id: "scene-session",
					userId: "owner",
					expiresAt: "2099-01-01T00:00:00Z",
				},
				user: {
					id: "owner",
					name: "Scene QA user",
					email: "scene@example.test",
				},
			},
		})
	);
	await page.route("**/scene-fixture/*.png", (route) =>
		route.fulfill({
			status: unreadable ? 404 : 200,
			contentType: "image/png",
			headers: {
				"Access-Control-Allow-Origin": new URL(page.url()).origin,
				"Access-Control-Allow-Credentials": "true",
			},
			body: unreadable ? Buffer.alloc(0) : animationTimingFixture.png,
		})
	);
	await page.route("**/rpc/**", async (route) => {
		const [, operation] = new URL(route.request().url()).pathname.split(
			"/rpc/"
		);
		let result: unknown = [];
		if (operation === "assetRecords/list") {
			result = assets;
		}
		if (operation === "assetVersions/list") {
			result = { assetVersions: versions };
		}
		if (operation === "specializedProfileContracts/list") {
			result = { profiles };
		}
		if (operation === "sceneQa/list") {
			result = records;
		}
		if (operation === "sceneQa/save") {
			const { json: input } = route.request().postDataJSON() as {
				json: SceneQaInput;
			};
			const record: SceneQaRecord = {
				...input,
				versionPins: input.setup.placements.map((p) => ({
					assetVersionId: p.assetVersionId,
					assetRecordId: `${p.role}-asset`,
					assetFamilyId: `${p.role}-family`,
					assetRecordName: `Forest ${p.role}`,
					versionNumber: 1,
					contentDigest: "a".repeat(64),
					width: 32,
					height: 32,
				})),
				profilePins: profiles.map((p) => ({
					contractRevisionId: p.activeContract.contractRevisionId,
					profileId: p.definition.profileId,
					contractSnapshot: p.definition,
				})),
				createdAt: "2026-10-13T00:00:00.000Z",
				createdByUserId: "owner",
			};
			records.push(record);
			if (loseSaveResponse) {
				await route.abort("failed");
				return;
			}
			result = record;
		}
		await route.fulfill({ json: { json: result } });
	});
	await page.goto(`/projects/${projectId}/scene-qa`);
	await expect(
		page.getByRole("heading", { name: "Scene QA Playground" })
	).toBeVisible();
}
const walkPattern = /walk ·/;
const completePattern = /idle · 4000 \/ 4000/;
test("places six roles, plays movement and event transitions, saves observations and reopens exact evidence", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await prepare(page);
	await page
		.getByLabel("Scene name", { exact: true })
		.fill("Forest usage check");
	for (const role of sceneQaRoles) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser actions must observe the preceding selection.
		await page.getByLabel("Role", { exact: true }).selectOption(role);
		await page
			.getByLabel("Exact Asset Version", { exact: true })
			.selectOption(`${role}-version`);
		await page
			.getByRole("button", { name: "Add to scene", exact: true })
			.click();
	}
	const preview = page.getByRole("region", {
		name: "Scene preview",
		exact: true,
	});
	await expect(
		preview.getByRole("button", { name: "Play scene", exact: true })
	).toBeEnabled({ timeout: 60_000 });
	const before = await preview.getByRole("img").screenshot();
	await preview
		.getByRole("button", { name: "Play scene", exact: true })
		.click();

	await expect(preview.getByText(walkPattern)).toBeVisible();
	await preview
		.getByRole("button", { name: "Pause scene", exact: true })
		.click();
	const after = await preview.getByRole("img").screenshot();
	expect(after).not.toEqual(before);
	await preview
		.getByRole("button", { name: "Play scene", exact: true })
		.click();
	await expect(preview.getByText(completePattern)).toBeVisible({
		timeout: 10_000,
	});
	for (const label of [
		"Scale and perspective",
		"Layering and Y-sort",
		"Animation transitions",
		"Hit event and effect",
		"Camera behavior",
		"Contrast and readability",
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Browser observations are filled sequentially.
		await page
			.getByLabel(label, { exact: true })
			.fill(`${label}: inspected in the forest scene.`);
	}
	await page
		.getByRole("button", { name: "Save scene evidence", exact: true })
		.click();
	await expect(
		page.getByText("Scene evidence saved: Forest usage check.")
	).toBeVisible();
	await page.reload();
	await page.getByText("Forest usage check ·", { exact: false }).click();
	await expect(
		page.getByText("Scale and perspective: inspected in the forest scene.", {
			exact: true,
		})
	).toBeVisible();
	await page
		.getByRole("button", { name: "Replay saved scene", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Play scene", exact: true })
	).toBeEnabled({ timeout: 60_000 });
	await page
		.getByRole("region", { name: "Scene preview", exact: true })
		.screenshot({ path: "../../.context/scene-qa-preview.png" });
	await page.screenshot({
		path: "../../.context/scene-qa-browser.png",
		fullPage: true,
	});
});
test("unreadable exact image prevents scene evidence completion", async ({
	page,
}) => {
	await prepare(page, true);
	await page
		.getByLabel("Exact Asset Version", { exact: true })
		.selectOption("object-version");
	await page.getByRole("button", { name: "Add to scene", exact: true }).click();
	await expect(page.getByRole("alert")).toBeVisible({ timeout: 60_000 });
	await expect(
		page.getByRole("button", { name: "Save scene evidence", exact: true })
	).toBeDisabled();
});

test("uncertain save is reconciled by reading the same evidence instead of sending a second save", async ({
	page,
}) => {
	await prepare(page, false, true);
	await page
		.getByLabel("Scene name", { exact: true })
		.fill("Interrupted scene save");
	await page
		.getByLabel("Exact Asset Version", { exact: true })
		.selectOption("object-version");
	await page.getByRole("button", { name: "Add to scene", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Play scene", exact: true })
	).toBeEnabled({ timeout: 60_000 });
	await page.getByRole("button", { name: "Play scene", exact: true }).click();
	await expect(page.getByText(completePattern)).toBeVisible({
		timeout: 10_000,
	});
	const fields = [
		"Scale and perspective",
		"Layering and Y-sort",
		"Animation transitions",
		"Hit event and effect",
		"Camera behavior",
		"Contrast and readability",
	];
	for (const label of fields) {
		// biome-ignore lint/performance/noAwaitInLoops: The visible form is completed sequentially.
		await page.getByLabel(label, { exact: true }).fill("Inspected.");
	}
	await page
		.getByRole("button", { name: "Save scene evidence", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Check saved evidence", exact: true })
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Save scene evidence", exact: true })
	).toBeDisabled();
	await page
		.getByRole("button", { name: "Check saved evidence", exact: true })
		.click();
	await expect(
		page.getByText("Scene evidence saved: Interrupted scene save.")
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Check saved evidence", exact: true })
	).toHaveCount(0);
});
