import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { PortraitIdentityReviewInput } from "@sprite-anvil/api/portrait-identity-reviews";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import {
	assetFamilyCanonicalDesigns,
	assetFamilyRelationships,
} from "@sprite-anvil/db/schema/asset-families";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionReviewEvents,
	assetVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { portraitIdentityReviews } from "@sprite-anvil/db/schema/portrait-identity-reviews";
import { project } from "@sprite-anvil/db/schema/project";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createPortraitIdentityReviewStore } from "./features/portrait-marketing-profile/server/portrait-identity-review-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

const databaseUrl = process.env.PORTRAIT_REVIEW_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"persists exact portrait usage and lineage, rejects drift atomically and rereads via a second connection",
	async () => {
		if (!databaseUrl) {
			throw new Error("Missing portrait test database");
		}
		const target = new URL(databaseUrl);
		if (
			target.hostname !== "127.0.0.1" ||
			target.pathname !== "/portrait_review_test"
		) {
			throw new Error("Requires disposable loopback portrait_review_test");
		}
		const connection = new SQL(databaseUrl);
		const second = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({ client: second }) as unknown as Database;
		const owner = crypto.randomUUID();
		const outsider = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const portraitWorld = crypto.randomUUID();
		const gameplayWorld = crypto.randomUUID();
		const identity = crypto.randomUUID();
		const family = crypto.randomUUID();
		const gameplayFamily = crypto.randomUUID();
		const canonical = crypto.randomUUID();
		const fixtures = ["Neutral portrait", "Happy portrait"].map((name) => ({
			name,
			recordId: crypto.randomUUID(),
			versionId: crypto.randomUUID(),
		}));
		const [neutral, happy] = fixtures;
		if (!(neutral && happy)) {
			throw new Error("Portrait fixtures missing");
		}
		const contract = getSpecializedProfileContract("portrait_logo_marketing");
		if (!contract) {
			throw new Error("Missing portrait contract");
		}
		const contractStore = createSpecializedProfileContractStore(db);
		const store = createPortraitIdentityReviewStore(db);
		const context = {
			session: { user: { id: owner } },
			assetFamilyStore: createAssetFamilyStore(db),
			assetRecordStore: createAssetRecordStore(db),
			assetVersionStore: createAssetVersionStore(db),
			portraitIdentityReviewStore: store,
			specializedProfileContractStore: contractStore,
			verifyAssetVersionContent: async () => true,
		} as unknown as Context;
		try {
			await db.insert(user).values([
				{
					id: owner,
					name: "Portrait tester",
					email: `portrait-${owner}@example.test`,
				},
				{
					id: outsider,
					name: "Outsider",
					email: `portrait-${outsider}@example.test`,
				},
			]);
			await db.insert(project).values({
				id: projectId,
				ownerUserId: owner,
				name: "Portrait review test",
			});
			await db.insert(visualWorlds).values([
				{
					id: portraitWorld,
					projectId,
					name: "Illustration",
					createdByUserId: owner,
				},
				{
					id: gameplayWorld,
					projectId,
					name: "Gameplay pixels",
					createdByUserId: owner,
				},
			]);
			await db.insert(subjectIdentities).values({
				id: identity,
				projectId,
				name: "Hero",
				createdByUserId: owner,
			});
			await db.insert(assetFamilies).values([
				{
					id: family,
					projectId,
					subjectIdentityId: identity,
					visualWorldId: portraitWorld,
					name: "Hero portraits",
					useContext: "Dialogue",
					createdByUserId: owner,
				},
				{
					id: gameplayFamily,
					projectId,
					subjectIdentityId: identity,
					visualWorldId: gameplayWorld,
					name: "Hero gameplay",
					useContext: "Gameplay",
					createdByUserId: owner,
				},
			]);
			await db.insert(assetRecords).values(
				fixtures.map((f) => ({
					id: f.recordId,
					projectId,
					assetFamilyId: family,
					name: f.name,
					assetCategory: "portrait_logo_marketing" as const,
					supportLevel: "general" as const,
					availability: "active" as const,
					createdByUserId: owner,
				}))
			);
			await db.insert(assetVersions).values(
				fixtures.map((f) => ({
					id: f.versionId,
					projectId,
					assetFamilyId: family,
					assetRecordId: f.recordId,
					versionNumber: 1,
					contentType: "image/png",
					byteSize: 80,
					objectKey: `test/${f.versionId}`,
					contentDigest: "a".repeat(64),
					integrityVerified: true,
					sourceImageWidth: 600,
					sourceImageHeight: 800,
					createdByUserId: owner,
				}))
			);
			await db.insert(assetVersionReviewEvents).values({
				id: crypto.randomUUID(),
				projectId,
				assetRecordId: neutral.recordId,
				versionId: neutral.versionId,
				decision: "approved",
				createdByUserId: owner,
			});
			await db.insert(assetFamilyCanonicalDesigns).values({
				id: canonical,
				projectId,
				assetFamilyId: family,
				assetRecordId: neutral.recordId,
				assetVersionId: neutral.versionId,
				createdByUserId: owner,
			});
			await db.insert(assetFamilyRelationships).values({
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: family,
				sourceAssetRecordId: neutral.recordId,
				sourceAssetVersionId: neutral.versionId,
				targetAssetRecordId: happy.recordId,
				type: "derivative",
				createdByUserId: owner,
			});
			await contractStore.activate(
				owner,
				projectId,
				"portrait_logo_marketing",
				contract
			);
			const activation = await contractStore.getActive(
				owner,
				projectId,
				"portrait_logo_marketing"
			);
			if (!activation) {
				throw new Error("Activation failed");
			}
			const observation = {
				outcome: "passed" as const,
				notes: "Identity and expression remain visible.",
			};
			const input: PortraitIdentityReviewInput = {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: family,
				visualWorldId: portraitWorld,
				subjectIdentityId: identity,
				canonicalDesignId: canonical,
				contractRevisionId: activation.contractRevisionId,
				rationale: "Compared exact dialogue crops.",
				observations: {
					identity: observation,
					expression: observation,
					crop: observation,
				},
				items: fixtures.map((f, index) => ({
					assetRecordId: f.recordId,
					assetVersionId: f.versionId,
					expression: index === 0 ? "Neutral" : "Happy",
					usagePurpose: "dialogue",
					naturalSize: { width: 600, height: 800 },
					crop: { x: 50, y: 80, width: 400, height: 500 },
					targetSize: { width: 137, height: 181 },
					background: "dark",
				})),
			};
			const saved = await call(appRouter.portraitIdentityReviews.save, input, {
				context,
			});
			expect(saved).toMatchObject({
				...input,
				outcome: "passed",
				canonicalAssetVersionId: neutral.versionId,
			});
			expect(
				await call(
					appRouter.portraitIdentityReviews.list,
					{ projectId, assetFamilyId: family },
					{
						context: {
							...context,
							portraitIdentityReviewStore:
								createPortraitIdentityReviewStore(rereadDb),
						},
					}
				)
			).toEqual([saved]);
			expect(
				await call(appRouter.portraitIdentityReviews.save, input, { context })
			).toEqual(saved);
			await expect(
				call(
					appRouter.portraitIdentityReviews.list,
					{ projectId, assetFamilyId: family },
					{
						context: {
							...context,
							session: { user: { id: outsider } } as Context["session"],
						},
					}
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			expect(
				await store.append(owner, {
					...saved,
					id: crypto.randomUUID(),
					visualWorldId: gameplayWorld,
				})
			).toBeNull();
			expect(
				await store.append(owner, {
					...saved,
					id: crypto.randomUUID(),
					canonicalDesignId: crypto.randomUUID(),
				})
			).toBeNull();
			await db
				.update(assetFamilyRelationships)
				.set({
					sourceAssetVersionId: happy.versionId,
					sourceAssetRecordId: happy.recordId,
					targetAssetRecordId: neutral.recordId,
				})
				.where(eq(assetFamilyRelationships.assetFamilyId, family));
			expect(
				await store.append(owner, { ...saved, id: crypto.randomUUID() })
			).toBeNull();
			await db
				.update(assetRecords)
				.set({ availability: "erased" })
				.where(eq(assetRecords.id, happy.recordId));
			expect(
				await call(
					appRouter.portraitIdentityReviews.list,
					{ projectId, assetFamilyId: family },
					{ context }
				)
			).toEqual([]);
			const [historicalReview] = await db
				.select()
				.from(portraitIdentityReviews)
				.where(eq(portraitIdentityReviews.id, saved.id));
			expect(historicalReview?.record).toEqual(saved);
		} finally {
			await connection.close();
			await second.close();
		}
	}
);
