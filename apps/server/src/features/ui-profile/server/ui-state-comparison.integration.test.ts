import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	createUiStateComparisonArchive,
	type UiStateComparisonInput,
	uiComponentStates,
	uiStateComparisonArchiveSchema,
} from "@sprite-anvil/api/ui-state-comparisons";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { project } from "@sprite-anvil/db/schema/project";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetRecordStore } from "../../asset-records/server/asset-record-store";
import { createAssetVersionStore } from "../../asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "../../quality-evidence/server/specialized-profile-contract-store";
import { createUiStateComparisonStore } from "./ui-state-comparison-store";

const databaseUrl = process.env.UI_STATE_COMPARISON_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists UI state mappings across database connections and rejects foreign, erased and conflicting inputs",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing UI comparison test database.");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/ui_state_comparison_test"
		) {
			throw new Error(
				"UI integration requires the disposable loopback ui_state_comparison_test database."
			);
		}
		const connection = new SQL(databaseUrl);
		const second = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({ client: second }) as unknown as Database;
		const owner = crypto.randomUUID();
		const outsider = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const world = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const screenId = crypto.randomUUID();
		const buttonId = crypto.randomUUID();
		const foreignId = crypto.randomUUID();
		const foreignFamily = crypto.randomUUID();
		const unitId = crypto.randomUUID();
		const sourceButtonId = crypto.randomUUID();
		const contract = getSpecializedProfileContract("ui");
		if (!contract) {
			throw new Error("Missing UI contract.");
		}
		try {
			await db.insert(user).values([
				{
					id: owner,
					name: "UI comparison owner",
					email: `ui-${owner}@example.test`,
				},
				{
					id: outsider,
					name: "UI outsider",
					email: `ui-${outsider}@example.test`,
				},
			]);
			await db.insert(project).values({
				id: projectId,
				ownerUserId: owner,
				name: "Inventory UI comparison",
			});
			await db.insert(visualWorlds).values({
				id: world,
				projectId,
				name: "Inventory UI",
				createdByUserId: owner,
			});
			await db.insert(assetFamilies).values(
				[familyId, foreignFamily].map((id) => ({
					id,
					projectId,
					visualWorldId: world,
					name: id === familyId ? "Inventory components" : "Other UI family",
					useContext: "Inventory",
					createdByUserId: owner,
				}))
			);
			await db.insert(assetRecords).values(
				[screenId, buttonId, foreignId].map((id) => ({
					id,
					projectId,
					assetFamilyId: id === foreignId ? foreignFamily : familyId,
					name: id === screenId ? "Inventory screen" : "Button states",
					assetCategory: "ui" as const,
					supportLevel: "general" as const,
					availability: "active" as const,
					createdByUserId: owner,
				}))
			);
			await db.insert(assetVersions).values(
				[screenId, buttonId, foreignId].map((id) => ({
					id,
					projectId,
					assetFamilyId: id === foreignId ? foreignFamily : familyId,
					assetRecordId: id,
					versionNumber: 1,
					contentType: "image/png",
					byteSize: 100,
					objectKey: `test/${id}`,
					contentDigest: "a".repeat(64),
					sourceImageWidth: 64,
					sourceImageHeight: 64,
					integrityVerified: true,
					createdByUserId: owner,
				}))
			);
			await db.insert(assetVersions).values({
				id: sourceButtonId,
				projectId,
				assetFamilyId: familyId,
				assetRecordId: buttonId,
				versionNumber: 2,
				contentType: "image/png",
				byteSize: 100,
				objectKey: `test/${sourceButtonId}`,
				contentDigest: "a".repeat(64),
				sourceImageWidth: 64,
				sourceImageHeight: 64,
				integrityVerified: true,
				createdByUserId: owner,
			});
			await db.insert(unitVersions).values({
				id: unitId,
				projectId,
				assetRecordId: buttonId,
				assetVersionId: buttonId,
				sourceAssetVersionId: sourceButtonId,
				unitType: "state",
				unitKey: "normal",
				versionNumber: 1,
				createdByUserId: owner,
			});
			const contractStore = createSpecializedProfileContractStore(db);
			await contractStore.activate(owner, projectId, "ui", contract);
			const activation = await contractStore.getActive(owner, projectId, "ui");
			if (!activation) {
				throw new Error("UI contract activation failed.");
			}
			const context = {
				session: { user: { id: owner } },
				assetRecordStore: createAssetRecordStore(db),
				assetVersionStore: createAssetVersionStore(db),
				uiStateComparisonStore: createUiStateComparisonStore(db),
				specializedProfileContractStore: contractStore,
				verifyAssetVersionContent: async () => true,
			} as unknown as Context;
			const input: UiStateComparisonInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				contractRevisionId: activation.contractRevisionId,
				screenAssetVersionId: screenId,
				name: "Inventory controls",
				outcome: "needs_follow_up",
				familyStyleNotes: "Disabled outline needs adjustment.",
				stateDistinctionNotes: "States retain distinct borders.",
				items: uiComponentStates.map((state, index) => ({
					componentId: "inventory-button",
					componentKind: "button",
					state,
					assetVersionId: buttonId,
					unitVersionId: index === 0 ? unitId : null,
					region: { x: index * 8, y: 0, width: 8, height: 8 },
				})),
			};
			const saved = await call(appRouter.uiStateComparisons.save, input, {
				context,
			});
			const rereadContext = {
				...context,
				uiStateComparisonStore: createUiStateComparisonStore(rereadDb),
			};
			expect(
				await call(
					appRouter.uiStateComparisons.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			expect(saved.items.map((item) => item.state)).toEqual([
				"normal",
				"hover",
				"pressed",
				"disabled",
				"selected",
				"open",
				"closed",
			]);
			expect(saved.unitPins).toMatchObject([{ id: unitId, unitKey: "normal" }]);
			expect(
				uiStateComparisonArchiveSchema.parse(
					JSON.parse(JSON.stringify(createUiStateComparisonArchive(saved)))
				).record
			).toEqual(saved);
			expect(
				await call(appRouter.uiStateComparisons.save, input, {
					context: rereadContext,
				})
			).toEqual(saved);
			await expect(
				call(
					appRouter.uiStateComparisons.save,
					{ ...input, name: "Altered" },
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			await expect(
				call(
					appRouter.uiStateComparisons.list,
					{ projectId, assetFamilyId: familyId },
					{
						context: {
							...context,
							session: { user: { id: outsider } },
						} as unknown as Context,
					}
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				call(
					appRouter.uiStateComparisons.save,
					{
						...input,
						id: crypto.randomUUID(),
						screenAssetVersionId: foreignId,
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				createUiStateComparisonStore(db).append(outsider, {
					...saved,
					id: crypto.randomUUID(),
					reviewedByUserId: outsider,
				})
			).resolves.toBeNull();
			await expect(
				createUiStateComparisonStore(db).append(owner, {
					...saved,
					id: crypto.randomUUID(),
					versionPins: saved.versionPins.map((pin) => ({
						...pin,
						contentDigest: "b".repeat(64),
					})),
				})
			).resolves.toBeNull();
			await db
				.update(assetRecords)
				.set({ availability: "erased" })
				.where(eq(assetRecords.id, buttonId));
			expect(
				await call(
					appRouter.uiStateComparisons.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([]);
			await expect(
				call(
					appRouter.uiStateComparisons.save,
					{ ...input, id: crypto.randomUUID() },
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		} finally {
			await connection.close();
			await second.close();
		}
	}
);
