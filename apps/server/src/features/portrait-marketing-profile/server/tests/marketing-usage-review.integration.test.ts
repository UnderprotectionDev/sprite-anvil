import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import {
	createMarketingUsageReviewPackage,
	marketingUsageReviewPackageSchema,
} from "@sprite-anvil/api/marketing-usage-reviews";
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
import { project } from "@sprite-anvil/db/schema/project";
import { CryptoHasher, SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import sharp from "sharp";
import { withDisposablePostgres } from "../../../../../../../packages/db/scripts/disposable-postgres";
import { createAssetFamilyStore } from "../../../asset-families/server/asset-family-store";
import { createAssetRecordStore } from "../../../asset-records/server/asset-record-store";
import { createAssetVersionStore } from "../../../asset-versions/server/asset-version-store";
import { createSpecializedProfileContractStore } from "../../../quality-evidence/server/specialized-profile-contract-store";
import { createMarketingUsageReviewStore } from "../marketing-usage-review-store";

test.skipIf(process.env.DB_TEST_POSTGRES !== "true")(
	"saves and rereads exact marketing usage evidence through independent PostgreSQL connections",
	async () => {
		await withDisposablePostgres(async ({ url }) => {
			const connection = new SQL(url);
			const second = new SQL(url);
			const db = drizzle({ client: connection });
			const rereadDb = drizzle({ client: second });
			await migrate(db, {
				migrationsFolder: fileURLToPath(
					new URL(
						"../../../../../../../packages/db/src/migrations",
						import.meta.url
					)
				),
			});
			const userId = crypto.randomUUID();
			const projectId = crypto.randomUUID();
			const familyId = crypto.randomUUID();
			const subjectIdentityId = crypto.randomUUID();
			const worldId = crypto.randomUUID();
			const recordId = crypto.randomUUID();
			const sourceId = crypto.randomUUID();
			const versionId = crypto.randomUUID();

			const bytes = await sharp({
				create: { width: 3, height: 2, channels: 4, background: "#117744" },
			})
				.png()
				.toBuffer();
			const contentDigest = new CryptoHasher("sha256")
				.update(bytes)
				.digest("hex");
			try {
				await db.insert(user).values({
					id: userId,
					name: "Marketing reviewer",
					email: `${userId}@example.test`,
				});
				await db.insert(project).values({
					id: projectId,
					name: "Marketing usage evidence",
					ownerUserId: userId,
				});
				await db.insert(visualWorlds).values({
					id: worldId,
					projectId,
					name: "Marketing",
					createdByUserId: userId,
				});
				await db.insert(subjectIdentities).values({
					id: subjectIdentityId,
					projectId,
					name: "Marketing identity",
					createdByUserId: userId,
				});
				await db.insert(assetFamilies).values({
					subjectIdentityId,
					id: familyId,
					projectId,
					visualWorldId: worldId,
					name: "Logo family",
					useContext: "Store",
					createdByUserId: userId,
				});
				await db.insert(assetRecords).values({
					id: recordId,
					projectId,
					assetFamilyId: familyId,
					name: "Anvil logo",
					supportLevel: "general",
					availability: "active",
					assetCategory: "portrait_logo_marketing",
					createdByUserId: userId,
				});
				await db.insert(assetVersions).values(
					[sourceId, versionId].map((id, index) => ({
						id,
						projectId,
						assetRecordId: recordId,
						assetFamilyId: familyId,
						versionNumber: index + 1,
						contentType: "image/png",
						byteSize: bytes.length,
						contentDigest,
						sourceImageWidth: 3,
						sourceImageHeight: 2,
						integrityVerified: true,
						objectKey: `test/${id}`,
						createdByUserId: userId,
					}))
				);
				const contract = specializedProfileContractCatalog.find(
					(item) => item.profileId === "portrait_logo_marketing"
				);
				if (!contract) {
					throw new Error("Missing marketing contract");
				}
				const contracts = createSpecializedProfileContractStore(
					db as unknown as Database
				);
				await contracts.activate(
					userId,
					projectId,
					"portrait_logo_marketing",
					contract
				);
				const activation = await contracts.getActive(
					userId,
					projectId,
					"portrait_logo_marketing"
				);
				if (!activation) {
					throw new Error("Missing marketing activation");
				}
				const context = {
					session: { user: { id: userId } },
					marketingUsageReviewStore: createMarketingUsageReviewStore(
						db as unknown as Database
					),
					assetVersionStore: createAssetVersionStore(db as unknown as Database),
					assetRecordStore: createAssetRecordStore(db as unknown as Database),
					specializedProfileContractStore: contracts,
					assetFamilyStore: createAssetFamilyStore(db as unknown as Database),
					verifyAssetVersionContent: async () => true,
				} as unknown as Context;
				const input = {
					id: crypto.randomUUID(),
					projectId,
					assetFamilyId: familyId,
					contractRevisionId: activation.contractRevisionId,
					visualWorldId: worldId,
					canonicalDesignId: null,
					items: [
						{
							assetRecordId: recordId,
							assetVersionId: versionId,
							usePurpose: "store" as const,
							naturalSize: { width: 3, height: 2 },
							displaySize: { width: 77, height: 51 },
							crop: { x: 0, y: 0, width: 3, height: 2 },
							safeArea: { x: 0, y: 0, width: 2, height: 1 },
							presentation: "opaque" as const,
							opaqueColor: "#ffcc00",
							observations: (["light", "dark"] as const).map((background) => ({
								background,
								readability: "inconclusive" as const,
								safeArea: "failed" as const,
								crop: "passed" as const,
								notes: "Logo crosses the safe area.",
							})),
						},
					],
				};
				const saved = await call(appRouter.marketingUsageReviews.save, input, {
					context,
				});
				const reread = await call(
					appRouter.marketingUsageReviews.list,
					{ projectId, assetFamilyId: familyId },
					{
						context: {
							...context,
							marketingUsageReviewStore: createMarketingUsageReviewStore(
								rereadDb as unknown as Database
							),
						},
					}
				);
				expect(reread).toEqual([saved]);
				expect(
					await call(appRouter.marketingUsageReviews.save, input, {
						context,
					})
				).toEqual(saved);
				const packaged = marketingUsageReviewPackageSchema.parse(
					JSON.parse(JSON.stringify(createMarketingUsageReviewPackage(saved)))
				);
				expect(packaged.record).toEqual(saved);
				await expect(
					call(
						appRouter.marketingUsageReviews.save,
						{
							...input,
							id: crypto.randomUUID(),
							items: input.items.map((item) => ({
								...item,
								assetVersionId: "foreign-version",
							})),
						},
						{ context }
					)
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
				await expect(
					call(
						appRouter.marketingUsageReviews.list,
						{ projectId, assetFamilyId: familyId },
						{
							context: {
								...context,
								session: { user: { id: "outsider" } },
							} as Context,
						}
					)
				).rejects.toMatchObject({ code: "NOT_FOUND" });
				await db
					.update(assetRecords)
					.set({ availability: "erased" })
					.where(eq(assetRecords.id, recordId));
				expect(
					await call(
						appRouter.marketingUsageReviews.list,
						{ projectId, assetFamilyId: familyId },
						{ context }
					)
				).toEqual([]);
			} finally {
				await connection.close();
				await second.close();
			}
		});
	},
	120_000
);
