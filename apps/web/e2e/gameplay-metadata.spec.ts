import { expect, test } from "@playwright/test";
import { createEmptyAssetRecordMeasurements } from "@sprite-anvil/api/asset-records";
import type {
	GameplayMetadataRecord,
	GameplayMetadataWriteInput,
} from "@sprite-anvil/api/gameplay-metadata";
import { getGameplayMetadataFields } from "@sprite-anvil/api/gameplay-metadata";
import {
	createGameplayMetadataPackage,
	readGameplayMetadataPackage,
} from "@sprite-anvil/api/gameplay-metadata-package";
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
		const frames = [{ assetVersionId, frameKey: "walk-0", sourcePivots: [] }];
		await page.route("**/gameplay-preview.png", (route) =>
			route.fulfill({
				contentType: "image/svg+xml",
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="8" y="4" width="16" height="20" fill="#8090b0"/></svg>',
			})
		);
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
					assetVersions: [
						{
							id: assetVersionId,
							projectId,
							assetRecordId,
							assetFamilyId: "fixture-family",
							versionNumber: 1,
							contentType: "image/png",
							contentLength: 128,
							contentDigest: "a".repeat(64),
							integrityVerified: true,
							previewUrl: "/gameplay-preview.png",
							createdAt: "2026-10-02T00:00:00.000Z",
							productionEvidence: {
								evidenceLevel: "unknown",
								managedSnapshots: [],
								manualImportEvidence: null,
								sourceKind: "unknown",
							},
							reviewDisposition: "candidate",
							reviewEvents: [],
						},
					],
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
					frames,
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
					contractSnapshot: contract,
					fields: request.fields.map((field) => {
						const definition = getGameplayMetadataFields(contract).find(
							(candidate) => candidate.id === field.fieldId
						);
						return {
							fieldId: field.fieldId,
							value:
								field.source?.kind === "authored" ? field.source.value : null,
							unit: definition?.unit ?? null,
							coordinateSystem: definition?.coordinateSystem ?? null,
							source: {
								kind:
									field.source?.kind === "authored" ? "authored" : "unknown",
							},
						};
					}),
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
				records = [saved, ...records];
				result = saved;
				if (outcome === "uncertain") {
					await route.abort("failed");
					return;
				}
			} else if (operation === "gameplayMetadata/review") {
				const decision = route.request().postDataJSON().json;
				const source = records.find(
					(record) => record.id === decision.recordId
				);
				if (!source) {
					throw new Error("Review target missing");
				}
				const reviewed: GameplayMetadataRecord = {
					...source,
					id: decision.id,
					review: {
						sourceRecordId: source.id,
						reviewedByUserId: "test-user",
						reviewedAt: "2026-10-02T00:00:00.000Z",
					},
				};
				records = [reviewed, ...records];
				result = reviewed;
			} else if (
				operation === "gameplayMetadata/createPackage" ||
				operation === "gameplayMetadata/readPackage"
			) {
				const submitted = route.request().postDataJSON().json;
				const selected = records.find(
					(record) => record.id === submitted.recordId
				);
				if (!selected) {
					throw new Error("Package target missing");
				}
				try {
					result =
						operation === "gameplayMetadata/createPackage"
							? await createGameplayMetadataPackage(selected, frames)
							: await readGameplayMetadataPackage(
									submitted.package,
									selected,
									frames
								);
				} catch (failure) {
					await route.fulfill({
						status: 400,
						json: {
							json: {
								defined: true,
								code: "BAD_REQUEST",
								status: 400,
								message:
									failure instanceof Error
										? failure.message
										: "Bütünlük hatası",
							},
						},
					});
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
			.getByLabel("Olay bağlantıları (JSON)")
			.fill('[{"id":"strike","frameKey":"walk-0","time":90}]');
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
		).not.toHaveCount(0);
		if (outcome === "confirmed") {
			await panel
				.getByRole("button", { name: "Bilgileri incele", exact: true })
				.click();
			const review = panel.getByRole("region", {
				name: "Bilgileri İnceleme ve Koruma",
			});
			await expect(review.getByRole("img")).toBeVisible();
			await expect(
				review.getByRole("note", { name: "Olay bağlantıları görsel katmanı" })
			).toContainText("strike");
			await review
				.getByRole("checkbox", { name: "Olay bağlantıları", exact: true })
				.uncheck();
			await expect(
				review.getByRole("note", { name: "Olay bağlantıları görsel katmanı" })
			).toHaveCount(0);
			await review
				.getByRole("checkbox", { name: "Olay bağlantıları", exact: true })
				.check();
			await expect(
				review.getByRole("button", { name: "İncelemeyi kaydet" })
			).toBeEnabled();
			const visiblePivot = await review.getByRole("img").screenshot();
			await review
				.getByRole("checkbox", { name: "Dönüş noktası", exact: true })
				.uncheck();
			await expect(
				review.getByRole("button", { name: "İncelemeyi kaydet" })
			).toBeEnabled();
			expect(await review.getByRole("img").screenshot()).not.toEqual(
				visiblePivot
			);
			await review
				.getByRole("checkbox", { name: "Dönüş noktası", exact: true })
				.check();
			await review.getByRole("button", { name: "İncelemeyi kaydet" }).click();
			await expect(
				review.getByText("İncelendi", { exact: true })
			).toBeVisible();
			const downloaded = page.waitForEvent("download");
			await review
				.getByRole("button", { name: "Oyun içi bilgiler paketini indir" })
				.click();
			const download = await downloaded;
			const path = await download.path();
			if (!path) {
				throw new Error("Package file was not downloaded");
			}
			await review.getByLabel("Paketi yeniden oku").setInputFiles(path);
			await expect(review.getByRole("status")).toHaveText(
				"Paket yeniden okundu; incelenmiş alanlar, kare ve kesin sürüm korunuyor."
			);
			if (process.env.GAMEPLAY_E2E_SCREENSHOT) {
				await page.setViewportSize({ width: 1440, height: 1600 });
				await review.screenshot({ path: process.env.GAMEPLAY_E2E_SCREENSHOT });
			}
			await review.getByLabel("Paketi yeniden oku").setInputFiles({
				name: "broken.json",
				mimeType: "application/json",
				buffer: Buffer.from('{"schemaVersion":"99.0.0"}'),
			});
			await expect(review.getByRole("alert")).toContainText("Bütünlük hatası");
			await panel
				.getByRole("button", { name: "Bilgileri düzenle", exact: true })
				.first()
				.click();
			await panel.getByLabel("Dönüş noktası (JSON)").fill('{"x":13,"y":24}');
			await panel.getByRole("button", { name: "Düzenlemeyi iptal et" }).click();
			await expect(
				review.getByText('{"x":12,"y":24}', { exact: true })
			).toBeVisible();
			await panel
				.getByRole("button", { name: "Bilgileri düzenle", exact: true })
				.first()
				.click();
			await panel.getByLabel("Dönüş noktası (JSON)").fill('{"x":13,"y":24}');
			await panel
				.getByRole("button", { name: "Oyun içi bilgileri kaydet" })
				.click();
			await page.reload();
			await expect(
				panel.getByText('{"x":13,"y":24} · Kullanıcı girdisi', { exact: true })
			).toBeVisible();
			await expect(panel.getByText("İncelendi", { exact: true })).toBeVisible();
			await panel
				.getByRole("button", { name: "Bilgileri incele", exact: true })
				.first()
				.click();
			await expect(
				review.getByText("Henüz incelenmedi", { exact: true })
			).toBeVisible();
			await expect(
				review.getByRole("button", { name: "Oyun içi bilgiler paketini indir" })
			).toHaveCount(0);
			await expect(
				review.getByRole("button", { name: "İncelemeyi kaydet" })
			).toBeEnabled();
			let nestedPayload: unknown = Array.from({ length: 7900 }, () => 0);
			for (let depth = 0; depth < 100; depth += 1) {
				nestedPayload = [nestedPayload];
			}
			await panel
				.getByRole("button", { name: "Bilgileri düzenle", exact: true })
				.first()
				.click();
			await panel
				.getByLabel("Olay bağlantıları (JSON)")
				.fill(
					JSON.stringify([
						{ id: "strike", extension: { payload: nestedPayload } },
					])
				);
			await panel
				.getByRole("button", { name: "Oyun içi bilgileri kaydet" })
				.click();
			await expect(panel.getByRole("status")).toHaveText(
				"Oyun içi bilgiler kaydedildi ve yeniden okundu."
			);
			await panel
				.getByRole("button", { name: "Bilgileri incele", exact: true })
				.first()
				.click();
			await expect(
				review.getByRole("note", { name: "Olay bağlantıları görsel katmanı" })
			).toContainText("payload");
			await review.getByRole("button", { name: "İncelemeyi kaydet" }).click();
			const deepDownloaded = page.waitForEvent("download");
			await review
				.getByRole("button", { name: "Oyun içi bilgiler paketini indir" })
				.click();
			const deepPath = await (await deepDownloaded).path();
			if (!deepPath) {
				throw new Error("Nested metadata package was not downloaded");
			}
			await review.getByLabel("Paketi yeniden oku").setInputFiles(deepPath);
			await expect(review.getByRole("status")).toHaveText(
				"Paket yeniden okundu; incelenmiş alanlar, kare ve kesin sürüm korunuyor."
			);
			await page.route("**/gameplay-preview.png", (route) =>
				route.abort("failed")
			);
			await page.reload();
			await panel
				.getByRole("button", { name: "Bilgileri incele", exact: true })
				.nth(1)
				.click();
			await expect(review.getByRole("alert")).toContainText(
				"görseli yüklenemedi"
			);
			await expect(
				review.getByRole("button", { name: "İncelemeyi kaydet" })
			).toBeDisabled();
			frames.splice(0);
			await page.reload();
			await panel
				.getByRole("button", { name: "Bilgileri incele", exact: true })
				.nth(1)
				.click();
			await expect(review.getByRole("alert")).toContainText(
				"Kare kimliği veya kesin sürüm bağlantısı kayboldu"
			);
			await expect(
				review.getByRole("button", { name: "İncelemeyi kaydet" })
			).toBeDisabled();
			await panel
				.getByRole("button", { name: "Bilgileri düzenle", exact: true })
				.first()
				.click();
			await expect(
				panel.getByText(
					"Bütünlük hatası: düzenlenen kaydın kare veya kesin sürüm bağlantısı kayboldu."
				)
			).toBeVisible();
		}
	});
}
