import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { IconFamilyReviewInput } from "@sprite-anvil/api/icon-family-reviews";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { iconFamilyReviews } from "@sprite-anvil/db/schema/icon-family-reviews";
import { project } from "@sprite-anvil/db/schema/project";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createIconFamilyReviewStore } from "./features/icon-profile/server/icon-family-review-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

const databaseUrl = process.env.ICON_FAMILY_REVIEW_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists and rereads an icon family review with exact versions, usage sizes, and the active icon contract",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing icon family review test database URL");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/icon_family_review_test"
		) {
			throw new Error(
				"Icon family review integration requires a disposable loopback icon_family_review_test database."
			);
		}
		const connection = new SQL(databaseUrl);
		const second = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({ client: second }) as unknown as Database;
		const userId = crypto.randomUUID();
		const outsiderUserId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const subjectIdentityId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const fixtures = [
			{
				digest: "a".repeat(64),
				recordId: crypto.randomUUID(),
				recordName: "Health potion",
				versionId: crypto.randomUUID(),
			},
			{
				digest: "b".repeat(64),
				recordId: crypto.randomUUID(),
				recordName: "Mana potion",
				versionId: crypto.randomUUID(),
			},
		] as const;
		const records = [fixtures[0].recordId, fixtures[1].recordId] as const;
		const versions = [fixtures[0].versionId, fixtures[1].versionId] as const;
		const digests = [fixtures[0].digest, fixtures[1].digest] as const;
		const foreignFamilyId = crypto.randomUUID();
		const foreignRecordId = crypto.randomUUID();
		const foreignVersionId = crypto.randomUUID();
		const contractStore = createSpecializedProfileContractStore(db);
		const reviewStore = createIconFamilyReviewStore(db);
		const context = {
			session: { user: { id: userId } },
			assetFamilyStore: createAssetFamilyStore(db),
			assetRecordStore: createAssetRecordStore(db),
			assetVersionStore: createAssetVersionStore(db),
			iconFamilyReviewStore: reviewStore,
			specializedProfileContractStore: contractStore,
			verifyAssetVersionContent: async () => true,
		} as unknown as Context;
		const iconContract = specializedProfileContractCatalog.find(
			(definition) => definition.profileId === "icon"
		);
		if (!iconContract) {
			throw new Error("The icon Specialized Profile Contract is required.");
		}
		try {
			await db.insert(user).values({
				id: userId,
				name: "Icon family review test",
				email: `icon-family-review-${userId}@example.test`,
			});
			await db.insert(user).values({
				id: outsiderUserId,
				name: "Icon family review outsider",
				email: `icon-family-review-outsider-${outsiderUserId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "Icon family review test",
			});
			await db.insert(visualWorlds).values({
				id: worldId,
				projectId,
				name: "Inventory UI",
				createdByUserId: userId,
			});
			await db.insert(subjectIdentities).values({
				id: subjectIdentityId,
				projectId,
				name: "Potion identity",
				createdByUserId: userId,
			});
			await db.insert(assetFamilies).values({
				id: familyId,
				projectId,
				subjectIdentityId,
				visualWorldId: worldId,
				name: "Potion icons",
				useContext: "Inventory",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values(
				fixtures.map(({ recordId, recordName }) => ({
					id: recordId,
					projectId,
					assetFamilyId: familyId,
					name: recordName,
					assetCategory: "icon" as const,
					supportLevel: "general" as const,
					availability: "active" as const,
					createdByUserId: userId,
				}))
			);
			await db.insert(assetVersions).values(
				fixtures.map(({ recordId, versionId, digest }) => ({
					id: versionId,
					projectId,
					assetFamilyId: familyId,
					assetRecordId: recordId,
					versionNumber: 1,
					contentType: "image/png",
					byteSize: 91,
					objectKey: `test/${versionId}`,
					contentDigest: digest,
					integrityVerified: true,
					createdByUserId: userId,
				}))
			);
			await db.insert(assetFamilies).values({
				id: foreignFamilyId,
				projectId,
				visualWorldId: worldId,
				name: "Unrelated icon family",
				useContext: "Reward UI",
				createdByUserId: userId,
			});
			await db.insert(assetRecords).values({
				id: foreignRecordId,
				projectId,
				assetFamilyId: foreignFamilyId,
				name: "Reward emblem",
				assetCategory: "icon",
				supportLevel: "general",
				availability: "active",
				createdByUserId: userId,
			});
			await db.insert(assetVersions).values({
				id: foreignVersionId,
				projectId,
				assetFamilyId: foreignFamilyId,
				assetRecordId: foreignRecordId,
				versionNumber: 1,
				contentType: "image/png",
				byteSize: 91,
				objectKey: `test/${foreignVersionId}`,
				contentDigest: "c".repeat(64),
				integrityVerified: true,
				createdByUserId: userId,
			});
			await contractStore.activate(userId, projectId, "icon", iconContract);
			const activation = await contractStore.getActive(
				userId,
				projectId,
				"icon"
			);
			if (!activation) {
				throw new Error("Icon profile activation failed");
			}
			const input: IconFamilyReviewInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				contractRevisionId: activation.contractRevisionId,
				items: [
					{
						assetRecordId: records[0],
						assetVersionId: versions[0],
						usageVariant: "inventory-slot",
						logicalSize: { width: 24, height: 24 },
					},
					{
						assetRecordId: records[1],
						assetVersionId: versions[1],
						usageVariant: "inventory-slot",
						logicalSize: { width: 24, height: 24 },
					},
					{
						assetRecordId: records[0],
						assetVersionId: versions[0],
						usageVariant: "ability-wheel",
						logicalSize: { width: 64, height: 64 },
					},
				],
				testedBackgrounds: ["light", "dark"],
				grayscaleCompared: true,
				comparisons: {
					objectScale: {
						assessment: "needs_follow_up",
						notes: "Health reads larger at 24px.",
					},
					lightingDirection: {
						assessment: "consistent",
						notes: "Highlights face the upper left.",
					},
					outline: {
						assessment: "consistent",
						notes: "Both silhouettes use the same edge weight.",
					},
					detailDensity: {
						assessment: "inconclusive",
						notes: "Check the 64px variant in context.",
					},
					stateOrRarityColor: {
						assessment: "identity_preserved",
						notes: "The color variant retains the bottle silhouette.",
					},
				},
				outcome: "needs_follow_up",
				rationale: "The larger health icon needs a scale adjustment.",
			};
			const saved = await call(appRouter.iconFamilyReviews.save, input, {
				context,
			});
			const rereadContext = {
				...context,
				iconFamilyReviewStore: createIconFamilyReviewStore(rereadDb),
			};
			expect(
				await call(
					appRouter.iconFamilyReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: rereadContext }
				)
			).toEqual([saved]);
			expect(saved).toMatchObject({
				...input,
				reviewedByUserId: userId,
				versionPins: [
					{ assetVersionId: versions[0], contentDigest: digests[0] },
					{ assetVersionId: versions[1], contentDigest: digests[1] },
				],
				contractSnapshot: iconContract,
			});
			expect(
				await call(appRouter.iconFamilyReviews.save, input, { context })
			).toEqual(saved);
			const outsideFamilyInput: IconFamilyReviewInput = {
				...input,
				id: crypto.randomUUID(),
				items: input.items.map((item, index) =>
					index === 0 ? { ...item, assetVersionId: foreignVersionId } : item
				),
			};
			await expect(
				call(appRouter.iconFamilyReviews.save, outsideFamilyInput, { context })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const outsiderContext: Context = {
				...context,
				session: { user: { id: outsiderUserId } } as Context["session"],
			};
			await expect(
				call(
					appRouter.iconFamilyReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context: outsiderContext }
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				call(
					appRouter.iconFamilyReviews.save,
					{ ...input, id: crypto.randomUUID() },
					{ context: outsiderContext }
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect(
				await call(
					appRouter.iconFamilyReviews.list,
					{ projectId, assetFamilyId: familyId },
					{ context }
				)
			).toEqual([saved]);
		} finally {
			await db
				.delete(iconFamilyReviews)
				.where(eq(iconFamilyReviews.projectId, projectId));
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
				.delete(subjectIdentities)
				.where(eq(subjectIdentities.projectId, projectId));
			await db
				.delete(visualWorlds)
				.where(eq(visualWorlds.projectId, projectId));
			await db.delete(project).where(eq(project.id, projectId));
			await db.delete(user).where(eq(user.id, userId));
			await db.delete(user).where(eq(user.id, outsiderUserId));
			await connection.close();
			await second.close();
		}
	}
);
