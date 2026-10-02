import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { relations } from "@sprite-anvil/db/relations";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
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
import {
	familyReadinessEvidence,
	familyRequiredSetHeads,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import { project } from "@sprite-anvil/db/schema/project";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { createAssetVersionStore } from "../../asset-versions/server/asset-version-store";
import { createFamilyReadinessStore } from "../../family-readiness/server/family-readiness-store";
import { createDependencyRevalidationStore } from "./dependency-revalidation-store";

const databaseUrl = process.env.DEPENDENCY_TEST_DATABASE_URL;

function fixtureId(ids: string[], index: number) {
	const id = ids[index];
	if (!id) {
		throw new Error("Missing test fixture identifier.");
	}
	return id;
}

test.skipIf(!databaseUrl)(
	"determines matching direct and transitive Change Facets and rereads Revalidation Required without changing historical approval",
	async () => {
		if (!databaseUrl) {
			throw new Error("DEPENDENCY_TEST_DATABASE_URL is required.");
		}
		const pool = new SQL(databaseUrl);
		const database = drizzle({
			client: pool,
			relations,
		}) as unknown as Database;
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const visualWorldId = crypto.randomUUID();
		const identityId = crypto.randomUUID();
		const recordIds = Array.from({ length: 5 }, () => crypto.randomUUID());
		const versionIds: string[] = Array.from({ length: 5 }, () =>
			crypto.randomUUID()
		);
		await database.insert(user).values({
			id: userId,
			name: "Change Impact User",
			email: `${userId}@example.test`,
		});
		await database
			.insert(project)
			.values({ id: projectId, name: "Change Impact", ownerUserId: userId });
		await database.insert(visualWorlds).values({
			id: visualWorldId,
			projectId,
			name: "Gameplay",
			createdByUserId: userId,
		});
		await database.insert(subjectIdentities).values({
			id: identityId,
			projectId,
			name: "Knight",
			createdByUserId: userId,
		});
		await database.insert(assetFamilies).values({
			id: familyId,
			projectId,
			visualWorldId,
			subjectIdentityId: identityId,
			name: "Combat",
			useContext: "combat",
			createdByUserId: userId,
		});
		await database.insert(assetRecords).values(
			recordIds.map((id, index) => ({
				id,
				projectId,
				assetFamilyId: familyId,
				name: `Asset ${index}`,
				createdByUserId: userId,
				identityCriteria: ["independent_product_meaning" as const],
				supportLevel: "general" as const,
				availability: "active" as const,
			}))
		);
		await database.insert(assetVersions).values(
			versionIds.map((id, index): typeof assetVersions.$inferInsert => ({
				id,
				projectId,
				assetFamilyId: familyId,
				assetRecordId: fixtureId(recordIds, index),
				versionNumber: 1,
				sourceKind: index === 0 ? "manual_import" : "derived",
				contentType: "image/png",
				byteSize: 1,
				objectKey: `${projectId}/${id}`,
				createdByUserId: userId,
			}))
		);
		await database.insert(assetVersionReviewEvents).values(
			versionIds.map((versionId, index) => ({
				id: crypto.randomUUID(),
				projectId,
				assetRecordId: fixtureId(recordIds, index),
				versionId,
				decision: "approved" as const,
				createdByUserId: userId,
			}))
		);
		await database.insert(assetFamilyCanonicalDesigns).values({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId: familyId,
			assetRecordId: fixtureId(recordIds, 0),
			assetVersionId: fixtureId(versionIds, 0),
			createdByUserId: userId,
		});
		const revisionId = crypto.randomUUID();
		const contextRevisionId = crypto.randomUUID();
		await database.insert(contextRevisions).values({
			id: contextRevisionId,
			projectId,
			revisionNumber: 1,
			state: "active",
			contractVersion: "1",
			rules: [],
			createdByUserId: userId,
		});
		await database.insert(familyRequiredSetRevisions).values({
			id: revisionId,
			projectId,
			assetFamilyId: familyId,
			revisionNumber: 1,
			items: [
				{
					id: "east",
					kind: "direction",
					name: "East",
					disposition: "required",
					assetRecordIds: [fixtureId(recordIds, 1)],
				},
			],
			createdByUserId: userId,
		});
		await database.insert(familyRequiredSetHeads).values({
			projectId,
			assetFamilyId: familyId,
			activeRevisionId: revisionId,
		});
		await database.insert(familyReadinessEvidence).values({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId: familyId,
			revisionId,
			itemId: "east",
			kind: "applicability",
			result: "applicable",
			assetVersionIds: [fixtureId(versionIds, 1)],
			profileContractRevisionIds: [null],
			contextRevisionId,
			visualWorldId,
			useContext: "combat",
			canonicalDesignVersionId: fixtureId(versionIds, 0),
			rationale: "Reviewed",
			createdByUserId: userId,
		});
		const context = {
			dependencyRevalidationStore: createDependencyRevalidationStore(database),
			familyReadinessStore: createFamilyReadinessStore(database),
			session: { user: { id: userId } },
		} as unknown as Context;
		try {
			await Promise.all(
				(
					[
						[0, 1, ["palette"]],
						[1, 2, ["palette"]],
						[0, 3, ["timing"]],
						[0, 4, []],
					] as const
				).map(([sourceIndex, targetIndex, facets]) =>
					call(
						appRouter.dependencyRevalidation.createLink,
						{
							projectId,
							source: {
								kind: "asset_version",
								id: fixtureId(versionIds, sourceIndex),
							},
							targetAssetVersionId: fixtureId(versionIds, targetIndex),
							facets: [...facets],
						},
						{ context }
					)
				)
			);
			const createLinkInput = {
				projectId,
				source: {
					kind: "asset_version" as const,
					id: fixtureId(versionIds, 0),
				},
				targetAssetVersionId: fixtureId(versionIds, 1),
				facets: ["palette"],
			};
			await expect(
				call(appRouter.dependencyRevalidation.createLink, createLinkInput, {
					context,
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.dependencyRevalidation.createLink,
					{
						...createLinkInput,
						targetAssetVersionId: fixtureId(versionIds, 0),
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.dependencyRevalidation.createLink,
					{ ...createLinkInput, targetAssetVersionId: "foreign-version" },
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.dependencyRevalidation.determine,
					{
						projectId,
						source: { kind: "canonical_design", id: fixtureId(versionIds, 3) },
						facets: ["palette"],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.dependencyRevalidation.determine,
					{
						projectId,
						source: { kind: "canonical_design", id: fixtureId(versionIds, 0) },
						facets: [],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.dependencyRevalidation.list,
					{ projectId },
					{
						context: {
							...context,
							session: { user: { id: "outsider" } },
						} as unknown as Context,
					}
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				call(
					appRouter.dependencyRevalidation.determine,
					{
						projectId,
						source: { kind: "canonical_design", id: fixtureId(versionIds, 0) },
						facets: ["palette"],
					},
					{ context: { ...context, session: null } }
				)
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			const catalogBeforeChange = await call(
				appRouter.dependencyRevalidation.list,
				{ projectId },
				{ context }
			);
			expect(catalogBeforeChange.dependencyLinks).toHaveLength(4);
			expect(catalogBeforeChange.changeImpacts).toEqual([]);
			const readinessBefore = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: familyId },
				{ context }
			);
			expect(readinessBefore.items[0]?.blockers).not.toContain("applicability");
			const impact = await call(
				appRouter.dependencyRevalidation.determine,
				{
					projectId,
					source: { kind: "canonical_design", id: fixtureId(versionIds, 0) },
					facets: ["palette"],
				},
				{ context }
			);
			const readinessAfter = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: familyId },
				{ context }
			);
			expect(readinessAfter.items[0]?.blockers).toContain("applicability");
			expect(readinessAfter.items[0]?.qualityReadiness).toBe(
				readinessBefore.items[0]?.qualityReadiness
			);
			expect(
				impact.affectedVersions.map((version) => version.assetVersionId).sort()
			).toEqual(
				[
					fixtureId(versionIds, 1),
					fixtureId(versionIds, 2),
					fixtureId(versionIds, 4),
				].sort()
			);
			expect(
				impact.affectedVersions.find(
					(version) => version.assetVersionId === versionIds[4]
				)?.reason
			).toBe("incomplete_dependency");
			const orphanRecordId = crypto.randomUUID();
			const orphanVersionId = crypto.randomUUID();
			await database.insert(assetRecords).values({
				id: orphanRecordId,
				projectId,
				assetFamilyId: familyId,
				name: "Undeclared derivative",
				createdByUserId: userId,
				identityCriteria: ["delivery_identity"],
				supportLevel: "general",
				availability: "active",
			});
			await database.insert(assetVersions).values({
				id: orphanVersionId,
				projectId,
				assetFamilyId: familyId,
				assetRecordId: orphanRecordId,
				versionNumber: 1,
				sourceKind: "derived",
				contentType: "image/png",
				byteSize: 1,
				objectKey: `${projectId}/${orphanVersionId}`,
				createdByUserId: userId,
			});
			const incompleteImpact = await call(
				appRouter.dependencyRevalidation.determine,
				{
					projectId,
					source: { kind: "canonical_design", id: fixtureId(versionIds, 0) },
					facets: ["equipment"],
				},
				{ context }
			);
			expect(
				incompleteImpact.affectedVersions.find(
					(version) => version.assetVersionId === orphanVersionId
				)?.reason
			).toBe("incomplete_dependency");
			const versionsAfterChange = await createAssetVersionStore(database).list(
				userId,
				projectId
			);
			expect(
				versionsAfterChange?.assetVersions
					.filter((version) => versionIds.includes(version.id))
					.every((version) => version.reviewDisposition === "approved")
			).toBe(true);
			const rereadPool = new SQL(databaseUrl);
			try {
				const rereadDatabase = drizzle({
					client: rereadPool,
					relations,
				}) as unknown as Database;
				const rereadContext = {
					...context,
					dependencyRevalidationStore:
						createDependencyRevalidationStore(rereadDatabase),
				};
				const catalog = await call(
					appRouter.dependencyRevalidation.list,
					{ projectId },
					{ context: rereadContext }
				);
				expect(catalog.changeImpacts).toEqual([impact, incompleteImpact]);
				expect(catalog.revalidationRequiredVersionIds.sort()).toEqual(
					[
						fixtureId(versionIds, 1),
						fixtureId(versionIds, 2),
						fixtureId(versionIds, 4),
						orphanVersionId,
					].sort()
				);
			} finally {
				await rereadPool.close();
			}
			await Promise.all(
				[1, 3].map((index) =>
					call(
						appRouter.dependencyRevalidation.createLink,
						{
							projectId,
							source: { kind: "context_revision", id: contextRevisionId },
							targetAssetVersionId: fixtureId(versionIds, index),
							facets: index === 1 ? ["palette"] : ["timing"],
						},
						{ context }
					)
				)
			);
			const contextImpact = await call(
				appRouter.dependencyRevalidation.determine,
				{
					projectId,
					source: { kind: "context_revision", id: contextRevisionId },
					facets: ["palette"],
				},
				{ context }
			);
			expect(
				contextImpact.affectedVersions
					.map((version) => version.assetVersionId)
					.sort()
			).toEqual(
				[
					fixtureId(versionIds, 1),
					fixtureId(versionIds, 2),
					fixtureId(versionIds, 4),
					orphanVersionId,
				].sort()
			);
			const otherContextRevisionId = crypto.randomUUID();
			await database.insert(contextRevisions).values({
				id: otherContextRevisionId,
				projectId,
				revisionNumber: 2,
				state: "inactive",
				contractVersion: "1",
				rules: [],
				createdByUserId: userId,
			});
			const unrelatedContextImpact = await call(
				appRouter.dependencyRevalidation.determine,
				{
					projectId,
					source: { kind: "context_revision", id: otherContextRevisionId },
					facets: ["identity"],
				},
				{ context }
			);
			expect(
				unrelatedContextImpact.affectedVersions
					.map((version) => version.assetVersionId)
					.sort()
			).toEqual(
				[
					fixtureId(versionIds, 2),
					fixtureId(versionIds, 4),
					orphanVersionId,
				].sort()
			);
			await expect(
				call(
					appRouter.dependencyRevalidation.createLink,
					{
						projectId,
						source: { kind: "asset_version", id: fixtureId(versionIds, 3) },
						targetAssetVersionId: fixtureId(versionIds, 0),
						facets: ["identity"],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await database.insert(assetFamilyCanonicalDesigns).values({
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				assetRecordId: fixtureId(recordIds, 3),
				assetVersionId: fixtureId(versionIds, 3),
				createdByUserId: userId,
			});
			await expect(
				call(
					appRouter.dependencyRevalidation.determine,
					{
						projectId,
						source: { kind: "canonical_design", id: fixtureId(versionIds, 0) },
						facets: ["palette"],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const latestImpact = await call(
				appRouter.dependencyRevalidation.determine,
				{
					projectId,
					source: { kind: "canonical_design", id: fixtureId(versionIds, 3) },
					facets: ["palette"],
				},
				{ context }
			);
			expect(
				latestImpact.affectedVersions.map((version) => version.assetVersionId)
			).toEqual([orphanVersionId]);
			expect(latestImpact.affectedVersions[0]?.reason).toBe(
				"incomplete_dependency"
			);
		} finally {
			await pool`DELETE FROM change_impacts WHERE project_id = ${projectId}`;
			await pool`DELETE FROM dependency_links WHERE project_id = ${projectId}`;
			await pool`DELETE FROM family_readiness_evidence WHERE project_id = ${projectId}`;
			await pool`DELETE FROM family_required_set_heads WHERE project_id = ${projectId}`;
			await pool`DELETE FROM family_required_set_revisions WHERE project_id = ${projectId}`;
			await pool`DELETE FROM asset_family_canonical_designs WHERE project_id = ${projectId}`;
			await pool`DELETE FROM asset_version_review_events WHERE project_id = ${projectId}`;
			await pool`DELETE FROM asset_versions WHERE project_id = ${projectId}`;
			await pool`DELETE FROM asset_records WHERE project_id = ${projectId}`;
			await pool`DELETE FROM asset_families WHERE project_id = ${projectId}`;
			await pool`DELETE FROM subject_identities WHERE project_id = ${projectId}`;
			await pool`DELETE FROM visual_worlds WHERE project_id = ${projectId}`;
			await pool`DELETE FROM context_revisions WHERE project_id = ${projectId}`;
			await pool`DELETE FROM project WHERE id = ${projectId}`;
			await pool`DELETE FROM "user" WHERE id = ${userId}`;
			await pool.close();
		}
	}
);
