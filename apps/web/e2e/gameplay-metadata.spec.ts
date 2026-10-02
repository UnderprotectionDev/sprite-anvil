import { expect, test } from "@playwright/test";
import { createEmptyAssetRecordMeasurements } from "@sprite-anvil/api/asset-records";
import type {
	GameplayMetadataRecord,
	GameplayMetadataWriteInput,
} from "@sprite-anvil/api/gameplay-metadata";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";

const projectId = "00000000-0000-4000-8000-000000000001";
const assetRecordId = "00000000-0000-4000-8000-000000000002";
const assetVersionId = "00000000-0000-4000-8000-000000000003";
const [contract] = specializedProfileContractCatalog;
const contractRevisionId = `${contract.profileId}@${contract.version}`;

for (const outcome of ["confirmed", "uncertain", "conflicted"] as const) {
	test(`authors exact-frame Gameplay Metadata with ${outcome} write and verifies the visible outcome`, async ({
		page,
	}) => {
		let records: GameplayMetadataRecord[] = [];
		let request: GameplayMetadataWriteInput | null = null;
		let writeAttempts = 0;
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({
				json: {
					session: {
						id: "test-session",
						userId: "test-user",
						expiresAt: "2099-01-01T00:00:00.000Z",
					},
					user: {
						id: "test-user",
						name: "Test User",
						email: "test@example.com",
					},
				},
			})
		);
		await page.route("**/rpc/**", async (route) => {
			const operation = new URL(route.request().url()).pathname.replace(
				"/rpc/",
				""
			);
			let result: unknown = [];
			if (operation === "projects/get") {
				result = { id: projectId, name: "Gameplay Metadata Test" };
			} else if (operation === "assetRecords/get") {
				result = {
					id: assetRecordId,
					projectId,
					name: "Walk cycle",
					availability: "active",
					supportLevel: "general",
					identityCriteria: ["independent_product_meaning"],
					measurements: createEmptyAssetRecordMeasurements(),
					createdAt: "2026-10-02T00:00:00.000Z",
				};
			} else if (operation === "assetRecords/tracking") {
				result = null;
			} else if (operation === "contextScopes/list") {
				result = { themes: [], visualWorlds: [] };
			} else if (operation === "assetVersions/list") {
				result = {
					assetVersions: [],
					unitVersions: [],
					compositeVersions: [],
					canonicalDesigns: [],
				};
			} else if (operation === "specializedProfileContracts/list") {
				result = {
					profiles: [
						{
							definition: contract,
							activeContract: {
								contract,
								projectId,
								contractRevisionId,
								activatedByUserId: "test-user",
								activatedAt: "2026-10-02T00:00:00.000Z",
							},
						},
					],
				};
			} else if (operation === "gameplayMetadata/list") {
				result = {
					frames: [{ assetVersionId, frameKey: "walk-0", sourcePivots: [] }],
					records,
				};
			} else if (operation === "gameplayMetadata/write") {
				request = route.request().postDataJSON().json;
				if (!request) {
					throw new Error("Gameplay Metadata request was not received.");
				}
				writeAttempts += 1;
				if (outcome === "conflicted" && writeAttempts === 1) {
					await route.abort("failed");
					return;
				}
				const saved: GameplayMetadataRecord = {
					id: request.id,
					projectId,
					assetRecordId,
					assetVersionId,
					frameKey: "walk-0",
					useContext: "walk east",
					profileId: "character_creature_animation",
					contractRevisionId,
					createdAt: "2026-10-02T00:00:00.000Z",
					fields: [
						{
							fieldId: "pivot",
							value: { x: 12, y: 24 },
							unit: "px",
							coordinateSystem: "source_image_top_left",
							source: { kind: "authored" },
						},
						{
							fieldId: "collision_areas",
							value: null,
							unit: "px",
							coordinateSystem: "source_image_top_left",
							source: { kind: "unknown" },
						},
					],
				};
				if (outcome === "conflicted") {
					await route.fulfill({
						status: 409,
						json: {
							json: {
								defined: true,
								code: "CONFLICT",
								status: 409,
								message:
									"The selected Specialized Profile Contract revision changed. Reload and select the active contract.",
							},
						},
					});
					return;
				}
				records = [saved];
				result = saved;
				if (outcome === "uncertain") {
					await route.abort("failed");
					return;
				}
			}
			await route.fulfill({ json: { json: result } });
		});
		await page.goto(`/projects/${projectId}/assets/${assetRecordId}`);
		const panel = page.getByRole("region", {
			name: "Oyun İçi Bilgileri",
			exact: true,
		});
		await panel.getByLabel("Kullanım bağlamı").fill("walk east");
		await panel.getByLabel("Dönüş noktası (JSON)").fill("{");
		await panel
			.getByRole("button", { name: "Oyun içi bilgileri kaydet" })
			.click();
		await expect(panel.getByRole("alert")).toHaveText(
			"Alanlara geçerli JSON girin; boş isteğe bağlı alanlar Bilinmiyor kalır."
		);
		expect(request).toBeNull();
		await panel.getByLabel("Dönüş noktası (JSON)").fill('{"x":12,"y":24}');
		await panel
			.getByRole("button", { name: "Oyun içi bilgileri kaydet" })
			.click();
		if (outcome === "uncertain") {
			await expect(panel.getByLabel("Kullanım bağlamı")).toBeDisabled();
			await panel.getByRole("button", { name: "Kaydı kontrol et" }).click();
			await expect(panel.getByRole("status")).toHaveText(
				"Oyun içi bilgiler kalıcı kayıttan yeniden okundu."
			);
			await expect(panel.getByLabel("Kullanım bağlamı")).toBeEnabled();
		} else if (outcome === "conflicted") {
			await expect(panel.getByLabel("Kullanım bağlamı")).toBeDisabled();
			await panel.getByRole("button", { name: "Kaydı kontrol et" }).click();
			await expect(panel.getByRole("alert")).toHaveText(
				"Kayıt henüz görünmüyor. Aynı işlemi yeniden deneyin; yeni kayıt oluşturulmaz."
			);
			await expect(panel.getByLabel("Kullanım bağlamı")).toBeDisabled();
			await panel
				.getByRole("button", { name: "Aynı işlemi yeniden dene" })
				.click();
			await expect(panel.getByRole("alert")).toHaveText(
				"The selected Specialized Profile Contract revision changed. Reload and select the active contract."
			);
			await expect(panel.getByLabel("Kullanım bağlamı")).toBeEnabled();
			return;
		} else {
			await expect(panel.getByRole("status")).toHaveText(
				"Oyun içi bilgiler kaydedildi ve yeniden okundu."
			);
		}
		expect(request).toMatchObject({
			assetVersionId,
			frameKey: "walk-0",
			useContext: "walk east",
			fields: expect.arrayContaining([
				{
					fieldId: "pivot",
					source: { kind: "authored", value: { x: 12, y: 24 } },
				},
				{ fieldId: "collision_areas", source: null },
			]),
		});
		await page.reload();
		await expect(
			panel.getByText("walk-0 — walk east", { exact: true })
		).toBeVisible();
		await expect(
			panel.getByText('{"x":12,"y":24} · Kullanıcı girdisi', { exact: true })
		).toBeVisible();
		await expect(
			panel.getByText("Bilinmiyor · Bilinmiyor", { exact: true })
		).toBeVisible();
		if (process.env.GAMEPLAY_E2E_SCREENSHOT && outcome === "confirmed") {
			await page.setViewportSize({ width: 1440, height: 2400 });
			await panel.scrollIntoViewIfNeeded();
			await panel.screenshot({ path: process.env.GAMEPLAY_E2E_SCREENSHOT });
		}
	});
}
