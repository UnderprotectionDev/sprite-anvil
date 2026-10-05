import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import { assetFamilyComparisons } from "@sprite-anvil/db/schema/asset-family-comparisons";
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
import { projectSpecializedProfileContracts } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetFamilyStore } from "../../asset-families/server/asset-family-store";
import { createAssetRecordStore } from "../../asset-records/server/asset-record-store";
import { createAssetVersionStore } from "../../asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "../../quality-evidence/server/specialized-profile-contract-store";
import { createAssetFamilyComparisonStore } from "./asset-family-comparison-store";

const databaseUrl = process.env.ASSET_FAMILY_COMPARISON_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"persists current Asset Versions from distinct Asset Records through the API and rereads them on a second PostgreSQL connection",
	async () => {
		if (!databaseUrl) {
			throw new Error("ASSET_FAMILY_COMPARISON_TEST_DATABASE_URL is required.");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/asset_family_comparison_test"
		) {
			throw new Error(
				"Asset Family Comparison integration requires a disposable loopback asset_family_comparison_test database."
			);
		}

		const connection = new SQL(databaseUrl);
		const secondConnection = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({
			client: secondConnection,
		}) as unknown as Database;
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const records = [
			{
				id: crypto.randomUUID(),
				name: "Closed crate",
				unitKey: "closed",
				unitType: "state" as const,
			},
			{
				id: crypto.randomUUID(),
				name: "South-facing crate",
				unitKey: "south",
				unitType: "direction" as const,
			},
		].map((record) => ({
			...record,
			sourceAssetVersionId: crypto.randomUUID(),
			assetVersionId: crypto.randomUUID(),
			unitVersionId: crypto.randomUUID(),
		}));
		const contract = specializedProfileContractCatalog.find(
			(candidate) => candidate.profileId === "object_weapon_equipment_states"
		);
		if (!contract) {
			throw new Error(
				"Object and equipment Specialized Profile Contract is missing."
			);
		}
		let insertedUser = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Asset Family Comparison Integration Test",
				email: `asset-family-comparison-${userId}@example.test`,
			});
			insertedUser = true;
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "Crate Family",
			});
			await db.insert(visualWorlds).values({
				id: worldId,
				projectId,
				name: "Gameplay",
				createdByUserId: userId,
			});
			await db.insert(assetFamilies).values({
				id: familyId,
				projectId,
				visualWorldId: worldId,
				name: "Crate States and Directions",
				useContext: "World props",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values(
				records.map((record) => ({
					id: record.id,
					projectId,
					assetFamilyId: familyId,
					assetCategory: "object_weapon_equipment_states" as const,
					name: record.name,
					supportLevel: "general" as const,
					availability: "active" as const,
					createdByUserId: userId,
				}))
			);
			await db.insert(assetVersions).values(
				records.flatMap((record) => [
					{
						id: record.sourceAssetVersionId,
						projectId,
						assetFamilyId: familyId,
						assetRecordId: record.id,
						versionNumber: 1,
						contentType: "image/png",
						byteSize: 91,
						objectKey: `test/${record.sourceAssetVersionId}`,
						contentDigest: "1".repeat(64),
						integrityVerified: true,
						createdByUserId: userId,
					},
					{
						id: record.assetVersionId,
						projectId,
						assetFamilyId: familyId,
						assetRecordId: record.id,
						versionNumber: 2,
						contentType: "image/png",
						byteSize: 91,
						objectKey: `test/${record.assetVersionId}`,
						contentDigest: "2".repeat(64),
						integrityVerified: true,
						createdByUserId: userId,
					},
				])
			);
			await db.insert(unitVersions).values(
				records.map((record) => ({
					id: record.unitVersionId,
					projectId,
					assetRecordId: record.id,
					assetVersionId: record.assetVersionId,
					sourceAssetVersionId: record.sourceAssetVersionId,
					unitType: record.unitType,
					unitKey: record.unitKey,
					versionNumber: 1,
					createdByUserId: userId,
				}))
			);

			const contractStore = createSpecializedProfileContractStore(db);
			await contractStore.activate(
				userId,
				projectId,
				"object_weapon_equipment_states",
				contract
			);
			const comparisonInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				contractRevisionId: `${contract.profileId}@${contract.version}`,
				assetVersions: records.map((record) => ({
					assetRecordId: record.id,
					assetVersionId: record.assetVersionId,
					unitVersionIds: [record.unitVersionId],
				})),
				observations: {
					scale: "Both versions use the same in-game scale.",
					perspective: "The low top-down perspective is consistent.",
					materialLanguage: "Both use the same weathered oak material.",
					stateDirectionDistinction:
						"The closed state and south direction remain distinguishable.",
				},
			};
			const context = {
				assetFamilyStore: createAssetFamilyStore(db),
				assetFamilyComparisonStore: createAssetFamilyComparisonStore(db),
				assetRecordStore: createAssetRecordStore(db),
				assetVersionStore: createAssetVersionStore(db),
				specializedProfileContractStore: contractStore,
				verifyAssetVersionContent: async () => true,
				session: { user: { id: userId } },
			} as unknown as Context;
			const comparisonRouter = Reflect.get(appRouter, "assetFamilyComparisons");
			if (!comparisonRouter) {
				throw new Error(
					"Asset Family Comparison API router is not registered."
				);
			}
			const saved = await call(comparisonRouter.save, comparisonInput, {
				context,
			});
			const reread = await call(
				comparisonRouter.list,
				{ projectId, assetFamilyId: familyId },
				{
					context: {
						...context,
						db: rereadDb,
					} as Context,
				}
			);
			expect(reread).toEqual([saved]);
			expect(saved.versionPins).toHaveLength(2);
			expect(
				saved.versionPins.map(
					(pin: { versionNumber: number }) => pin.versionNumber
				)
			).toEqual([2, 2]);
			const firstRecord = records.at(0);
			if (!firstRecord) {
				throw new Error("The comparison fixture needs its first Asset Record.");
			}
			const staleInput = {
				...comparisonInput,
				id: crypto.randomUUID(),
				assetVersions: comparisonInput.assetVersions.map(
					(assetVersion, index) =>
						index === 0
							? {
									...assetVersion,
									assetVersionId: firstRecord.sourceAssetVersionId,
									unitVersionIds: [],
								}
							: assetVersion
				),
			};
			await expect(
				call(comparisonRouter.save, staleInput, { context })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const incompleteUnitsInput = {
				...comparisonInput,
				id: crypto.randomUUID(),
				assetVersions: comparisonInput.assetVersions.map(
					(assetVersion, index) =>
						index === 0 ? { ...assetVersion, unitVersionIds: [] } : assetVersion
				),
			};
			await expect(
				call(comparisonRouter.save, incompleteUnitsInput, { context })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const duplicateAssetRecordInput = {
				...comparisonInput,
				id: crypto.randomUUID(),
				assetVersions: comparisonInput.assetVersions.map(
					(assetVersion, index) =>
						index === 1
							? { ...assetVersion, assetRecordId: firstRecord.id }
							: assetVersion
				),
			};
			await expect(
				call(comparisonRouter.save, duplicateAssetRecordInput, { context })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const secondRecord = records.at(1);
			if (!secondRecord) {
				throw new Error(
					"The comparison fixture needs its second Asset Record."
				);
			}
			const foreignUnitVersionInput = {
				...comparisonInput,
				id: crypto.randomUUID(),
				assetVersions: comparisonInput.assetVersions.map(
					(assetVersion, index) =>
						index === 0
							? {
									...assetVersion,
									unitVersionIds: [secondRecord.unitVersionId],
								}
							: assetVersion
				),
			};
			await expect(
				call(comparisonRouter.save, foreignUnitVersionInput, { context })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const rereadFromSecondConnection = await call(
				comparisonRouter.list,
				{ projectId, assetFamilyId: familyId },
				{
					context: {
						...context,
						assetFamilyComparisonStore:
							createAssetFamilyComparisonStore(rereadDb),
						db: rereadDb,
					} as Context,
				}
			);
			expect(rereadFromSecondConnection).toEqual([saved]);
		} finally {
			if (insertedUser) {
				await db
					.delete(projectSpecializedProfileContracts)
					.where(eq(projectSpecializedProfileContracts.projectId, projectId));
				await db
					.delete(assetFamilyComparisons)
					.where(eq(assetFamilyComparisons.projectId, projectId));
				await db
					.delete(unitVersions)
					.where(eq(unitVersions.projectId, projectId));
				await db
					.delete(assetVersions)
					.where(eq(assetVersions.projectId, projectId));
				await db
					.delete(assetRecords)
					.where(eq(assetRecords.projectId, projectId));
				await db
					.delete(assetFamilies)
					.where(eq(assetFamilies.projectId, projectId));
				await db
					.delete(visualWorlds)
					.where(eq(visualWorlds.projectId, projectId));
				await db.delete(project).where(eq(project.id, projectId));
				await db.delete(user).where(eq(user.id, userId));
			}
			await connection.close();
			await secondConnection.close();
		}
	}
);
