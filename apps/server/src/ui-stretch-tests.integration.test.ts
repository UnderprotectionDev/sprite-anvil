import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	makeUiProfileManifest,
	readUiProfileManifest,
} from "@sprite-anvil/api/ui-profile-export";
import type { UiStretchTestInput } from "@sprite-anvil/api/ui-stretch-tests";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";
import { createUiStretchTestStore } from "./features/ui-profile/server/ui-stretch-test-store";

const url = process.env.UI_STRETCH_TEST_DATABASE_URL;
test.skipIf(!url)(
	"UI Stretch Test saves exact state geometry, rereads it and exports target-size evidence",
	async () => {
		if (
			!url ||
			new URL(url).hostname !== "127.0.0.1" ||
			new URL(url).pathname !== "/ui_stretch_test"
		) {
			throw new Error("Requires disposable loopback ui_stretch_test database.");
		}
		const connection = new SQL(url);
		const second = new SQL(url);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({ client: second }) as unknown as Database;
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const subjectIdentityId = crypto.randomUUID();
		const recordId = crypto.randomUUID();
		const versionId = crypto.randomUUID();
		const contracts = createSpecializedProfileContractStore(db);
		const contract = getSpecializedProfileContract("ui");
		if (!contract) {
			throw new Error("Missing UI contract");
		}
		try {
			await db.insert(user).values({
				id: userId,
				name: "UI Stretch Test",
				email: `ui-stretch-${userId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "UI Stretch Test",
			});
			await db.insert(visualWorlds).values({
				id: worldId,
				projectId,
				name: "Inventory",
				createdByUserId: userId,
			});
			await db.insert(subjectIdentities).values({
				id: subjectIdentityId,
				projectId,
				name: "Inventory identity",
				createdByUserId: userId,
			});
			await db.insert(assetFamilies).values({
				id: familyId,
				subjectIdentityId,
				projectId,
				visualWorldId: worldId,
				name: "Inventory panels",
				useContext: "Inventory",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values({
				id: recordId,
				projectId,
				assetFamilyId: familyId,
				name: "Normal panel",
				assetCategory: "ui",
				supportLevel: "general",
				availability: "active",
				createdByUserId: userId,
			});
			await db.insert(assetVersions).values({
				id: versionId,
				projectId,
				assetFamilyId: familyId,
				assetRecordId: recordId,
				versionNumber: 1,
				contentType: "image/png",
				byteSize: 91,
				objectKey: `test/${versionId}`,
				contentDigest: "a".repeat(64),
				integrityVerified: true,
				sourceImageWidth: 32,
				sourceImageHeight: 24,
				createdByUserId: userId,
			});
			await contracts.activate(userId, projectId, "ui", contract);
			const activation = await contracts.getActive(userId, projectId, "ui");
			if (!activation) {
				throw new Error("Missing activation");
			}
			const context = {
				session: { user: { id: userId } },
				assetFamilyStore: createAssetFamilyStore(db),
				assetRecordStore: createAssetRecordStore(db),
				assetVersionStore: createAssetVersionStore(db),
				specializedProfileContractStore: contracts,
				uiStretchTestStore: createUiStretchTestStore(db),
				verifyAssetVersionContent: async () => true,
			} as unknown as Context;
			const input: UiStretchTestInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				visualWorldId: worldId,
				contractRevisionId: activation.contractRevisionId,
				states: [
					{
						componentId: "panel",
						stateId: "normal",
						assetRecordId: recordId,
						assetVersionId: versionId,
						naturalSize: { width: 32, height: 24 },
						stretchMargins: { left: 4, right: 6, top: 3, bottom: 5 },
						textSafeArea: { x: 6, y: 5, width: 18, height: 12 },
					},
				],
				targets: [{ width: 64, height: 40 }],
				sampleText: "Inventory item description",
				observations: [
					{
						componentId: "panel",
						stateId: "normal",
						targetIndex: 0,
						outcome: "passed",
						notes: "Corners and text remain readable.",
					},
				],
			};
			const [normalState] = input.states;
			if (!normalState) {
				throw new Error("Missing normal state fixture");
			}
			const saved = await call(appRouter.uiStretchTests.save, input, {
				context,
			});
			const reread = {
				...context,
				uiStretchTestStore: createUiStretchTestStore(rereadDb),
			};
			expect(
				await call(
					appRouter.uiStretchTests.list,
					{ projectId, assetFamilyId: familyId },
					{ context: reread }
				)
			).toEqual([saved]);
			expect(saved).toMatchObject({
				...input,
				contractSnapshot: contract,
				versionPins: [
					{ assetVersionId: versionId, contentDigest: "a".repeat(64) },
				],
				evaluations: [
					{
						geometry: "passed",
						outcome: "passed",
					},
				],
			});
			expect(saved.evaluations[0]?.targetTextSafeArea?.x).toBeCloseTo(98 / 11);
			expect(saved.evaluations[0]?.targetTextSafeArea?.width).toBeCloseTo(
				486 / 11
			);
			expect(saved.evaluations[0]?.targetTextSafeArea).toMatchObject({
				y: 7,
				height: 24,
			});
			expect(
				await call(appRouter.uiStretchTests.save, input, { context })
			).toEqual(saved);
			const manifest = await call(
				appRouter.uiStretchTests.export,
				{ projectId, assetFamilyId: familyId, id: saved.id },
				{ context: reread }
			);
			expect(readUiProfileManifest(JSON.stringify(manifest))).toEqual(
				makeUiProfileManifest(saved)
			);
			expect(manifest.ui.components[0]).toMatchObject({
				id: "panel",
				states: [{ id: "normal", asset_version_id: versionId }],
				natural_size: { normal: { width: 32, height: 24 } },
				stretch_margins: { normal: { left: 4, right: 6, top: 3, bottom: 5 } },
				text_safe_area: { normal: { x: 6, y: 5, width: 18, height: 12 } },
			});
			const compared = await call(
				appRouter.uiStretchTests.save,
				{
					...input,
					id: crypto.randomUUID(),
					screen: { assetRecordId: recordId, assetVersionId: versionId },
					states: [...input.states, { ...normalState, stateId: "pressed" }],
					targets: [...input.targets, { width: 32, height: 24 }],
				},
				{ context }
			);
			const comparedManifest = readUiProfileManifest(
				JSON.stringify(makeUiProfileManifest(compared))
			);
			expect(comparedManifest.ui.components).toHaveLength(1);
			expect(
				comparedManifest.ui.components[0]?.states.map((s) => s.id)
			).toEqual(["normal", "pressed"]);
			expect(comparedManifest.ui.components[0]?.natural_size.pressed).toEqual({
				width: 32,
				height: 24,
			});
			expect(comparedManifest.ui.screen_component_link).toEqual({
				asset_record_id: recordId,
				asset_version_id: versionId,
			});
			const tampered = makeUiProfileManifest(compared);
			const pressedMargins = tampered.ui.components[0]?.stretch_margins.pressed;
			if (!pressedMargins) {
				throw new Error("Missing pressed margins");
			}
			pressedMargins.left = 8;
			expect(() => readUiProfileManifest(JSON.stringify(tampered))).toThrow();

			await expect(
				call(
					appRouter.uiStretchTests.save,
					{
						...input,
						states: [
							{
								...normalState,
								stretchMargins: { left: 20, right: 20, top: 3, bottom: 5 },
							},
						],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.uiStretchTests.save,
					{
						...input,
						id: crypto.randomUUID(),
						states: [
							{ ...normalState, naturalSize: { width: 33, height: 24 } },
						],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.uiStretchTests.save,
					{
						...input,
						states: [
							{
								...normalState,
								textSafeArea: { x: 31, y: 5, width: 18, height: 12 },
							},
						],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.uiStretchTests.save,
					{ ...input, targets: [{ width: 80, height: 40 }] },
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			const small = await call(
				appRouter.uiStretchTests.save,
				{
					...input,
					id: crypto.randomUUID(),
					targets: [{ width: 8, height: 7 }],
				},
				{ context }
			);
			expect(small.evaluations[0]).toMatchObject({
				geometry: "failed",
				outcome: "failed",
				ruleId: "ui.target_size_and_text_bounds",
				ruleClass: "waivable_requirement",
				targetTextSafeArea: null,
			});
			const incomplete = await call(
				appRouter.uiStretchTests.save,
				{ ...input, id: crypto.randomUUID(), observations: [] },
				{ context }
			);
			expect(incomplete.evaluations[0]?.outcome).toBe("inconclusive");
			await Promise.all(
				[null, { user: { id: "outsider" } }].map(async (session) => {
					await expect(
						call(
							appRouter.uiStretchTests.list,
							{ projectId, assetFamilyId: familyId },
							{ context: { ...context, session } as Context }
						)
					).rejects.toMatchObject({
						code: session ? "NOT_FOUND" : "UNAUTHORIZED",
					});
					await expect(
						call(
							appRouter.uiStretchTests.export,
							{ projectId, assetFamilyId: familyId, id: saved.id },
							{ context: { ...context, session } as Context }
						)
					).rejects.toMatchObject({
						code: session ? "NOT_FOUND" : "UNAUTHORIZED",
					});
				})
			);
			await expect(
				call(
					appRouter.uiStretchTests.save,
					{ ...input, id: crypto.randomUUID() },
					{
						context: {
							...context,
							verifyAssetVersionContent: async () => false,
						},
					}
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.uiStretchTests.save,
					{ ...input, id: crypto.randomUUID(), contractRevisionId: "stale" },
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
		} finally {
			await connection.close();
			await second.close();
		}
	}
);
