import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { sql } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

function reviewContext(db: ReturnType<typeof createDb>, userId: string) {
	return {
		assetFamilyStore: createAssetFamilyStore(db),
		assetVersionStore: createAssetVersionStore(db),
		projectContextStore: createProjectContextStore(db),
		projectContextScopeStore: createProjectContextScopeStore(db),
		session: { user: { id: userId } } as Context["session"],
		verifyAssetVersionContent: async () => true,
	};
}

test.skipIf(!databaseUrl)(
	"persists separate batch Review Events atomically, preserves history, and safely replays concurrent requests",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		let projectId: string | undefined;
		await db.insert(user).values({
			id: userId,
			name: "Batch Reviewer",
			email: `${userId}@example.test`,
		});
		try {
			const context = reviewContext(db, userId);
			const options = { context: context as never };
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Batch Review Integration",
					generalArtDirection: "Clear silhouettes",
				},
				options
			);
			projectId = project.id;
			const world = await call(
				appRouter.contextScopes.createVisualWorld,
				{ projectId, name: "Gameplay", description: "In-game art" },
				options
			);
			const identity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId, name: "Batch Character" },
				options
			);
			const family = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId,
					subjectIdentityId: identity.id,
					name: "Batch Family",
					visualWorldId: world.id,
					useContext: "combat",
				},
				options
			);
			const record = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId,
					assetFamilyId: family.id,
					name: "Batch Result",
					identityCriteria: ["delivery_identity"],
				},
				options
			);
			const versionIds = [
				crypto.randomUUID(),
				crypto.randomUUID(),
				crypto.randomUUID(),
			];
			await db.insert(assetVersions).values(
				versionIds.map((id, index) => ({
					id,
					projectId: project.id,
					assetRecordId: record.id,
					assetFamilyId: family.id,
					versionNumber: index + 1,
					contentType: "image/png" as const,
					byteSize: 68,
					sha256: "a".repeat(64),
					contentDigest: "a".repeat(64),
					integrityVerified: index < 2,
					idempotencyKey: crypto.randomUUID(),
					objectKey: `review/${id}.png`,
					createdByUserId: userId,
				}))
			);
			const previewInput = {
				projectId,
				assetVersionIds: versionIds,
				decision: "approved" as const,
			};
			const blocked = await call(
				appRouter.assetVersions.previewBatchReview,
				previewInput,
				options
			);
			expect(blocked.items.map((item) => item.blockers.length > 0)).toEqual([
				false,
				false,
				true,
			]);
			const batchInput = {
				projectId,
				idempotencyKey: crypto.randomUUID(),
				decision: "approved" as const,
				rationale: "The user reviewed each selected exact version.",
				targets: blocked.items.map(
					({ assetVersionId, expectedReviewEventId }) => ({
						assetVersionId,
						expectedReviewEventId,
					})
				),
			};
			await expect(
				call(appRouter.assetVersions.reviewBatch, batchInput, options)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const untouched = await call(
				appRouter.assetVersions.list,
				{ projectId },
				options
			);
			expect(
				untouched.assetVersions.every(
					(version) => version.reviewEvents.length === 0
				)
			).toBe(true);
			const eligiblePreview = await call(
				appRouter.assetVersions.previewBatchReview,
				{ ...previewInput, assetVersionIds: versionIds.slice(0, 2) },
				options
			);
			const approvedInput = {
				...batchInput,
				idempotencyKey: crypto.randomUUID(),
				targets: eligiblePreview.items.map(
					({ assetVersionId, expectedReviewEventId }) => ({
						assetVersionId,
						expectedReviewEventId,
					})
				),
			};
			const [first, retry] = await Promise.all([
				call(appRouter.assetVersions.reviewBatch, approvedInput, options),
				call(appRouter.assetVersions.reviewBatch, approvedInput, options),
			]);
			expect(retry).toEqual(first);
			expect(first.reviewEvents.map((event) => event.assetVersionId)).toEqual(
				versionIds.slice(0, 2)
			);
			expect(new Set(first.reviewEvents.map((event) => event.id)).size).toBe(2);
			expect(
				first.reviewEvents.every(
					(event) =>
						Boolean(event.createdAt) &&
						event.rationale === approvedInput.rationale
				)
			).toBe(true);
			const rereadOptions = {
				context: reviewContext(
					createDb({ DATABASE_URL: databaseUrl }),
					userId
				) as never,
			};
			const reread = await call(
				appRouter.assetVersions.list,
				{ projectId },
				rereadOptions
			);
			expect(
				versionIds.map(
					(id) =>
						reread.assetVersions.find((version) => version.id === id)
							?.reviewEvents.length
				)
			).toEqual([1, 1, 0]);
			expect(reread.canonicalDesigns).toEqual(untouched.canonicalDesigns);
			expect(
				reread.assetVersions.map((version) => version.contentDigest)
			).toEqual(
				untouched.assetVersions.map((version) => version.contentDigest)
			);
			await expect(
				call(
					appRouter.assetVersions.reviewBatch,
					{ ...approvedInput, rationale: "Different decision" },
					options
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			const rejectionPreview = await call(
				appRouter.assetVersions.previewBatchReview,
				{
					...previewInput,
					assetVersionIds: versionIds.slice(0, 2),
					decision: "rejected",
				},
				options
			);
			await call(
				appRouter.assetVersions.review,
				{
					projectId,
					assetVersionId: versionIds[0] ?? "",
					decision: "candidate",
					rationale: "Reconsider this version",
				},
				options
			);
			const rejectionInput = {
				...approvedInput,
				idempotencyKey: crypto.randomUUID(),
				decision: "rejected" as const,
				targets: rejectionPreview.items.map(
					({ assetVersionId, expectedReviewEventId }) => ({
						assetVersionId,
						expectedReviewEventId,
					})
				),
			};
			await expect(
				call(appRouter.assetVersions.reviewBatch, rejectionInput, options)
			).rejects.toMatchObject({ code: "CONFLICT" });
			expect(
				await call(appRouter.assetVersions.reviewBatch, approvedInput, options)
			).toEqual(first);
			const afterRetry = await call(
				appRouter.assetVersions.list,
				{ projectId },
				rereadOptions
			);
			expect(
				afterRetry.assetVersions.find((version) => version.id === versionIds[0])
					?.reviewDisposition
			).toBe("candidate");
			expect(
				afterRetry.assetVersions.find((version) => version.id === versionIds[1])
					?.reviewEvents
			).toEqual(
				first.reviewEvents.filter(
					(event) => event.assetVersionId === versionIds[1]
				)
			);
			const freshRejection = await call(
				appRouter.assetVersions.previewBatchReview,
				{
					...previewInput,
					assetVersionIds: versionIds.slice(0, 2),
					decision: "rejected",
				},
				options
			);
			await call(
				appRouter.assetVersions.reviewBatch,
				{
					...rejectionInput,
					idempotencyKey: crypto.randomUUID(),
					targets: freshRejection.items.map(
						({ assetVersionId, expectedReviewEventId }) => ({
							assetVersionId,
							expectedReviewEventId,
						})
					),
				},
				options
			);
			const candidatePreview = await call(
				appRouter.assetVersions.previewBatchReview,
				{
					...previewInput,
					assetVersionIds: versionIds.slice(0, 2),
					decision: "candidate",
				},
				options
			);
			const candidateInput = {
				...approvedInput,
				decision: "candidate" as const,
				targets: candidatePreview.items.map(
					({ assetVersionId, expectedReviewEventId }) => ({
						assetVersionId,
						expectedReviewEventId,
					})
				),
			};
			const concurrentDecisions = await Promise.allSettled([
				call(
					appRouter.assetVersions.reviewBatch,
					{ ...candidateInput, idempotencyKey: crypto.randomUUID() },
					options
				),
				call(
					appRouter.assetVersions.reviewBatch,
					{ ...candidateInput, idempotencyKey: crypto.randomUUID() },
					options
				),
			]);
			expect(
				concurrentDecisions.filter((result) => result.status === "fulfilled")
			).toHaveLength(1);
			expect(
				concurrentDecisions.filter((result) => result.status === "rejected")
			).toHaveLength(1);
			const beforeContextChange = await call(
				appRouter.assetVersions.list,
				{ projectId },
				options
			);
			const proposal = await call(
				appRouter.contextProposals.create,
				{
					projectId,
					baseContextRevisionId: project.currentContextRevision.id,
					summary: "Change outlines",
					changes: [
						{
							operation: "add",
							ruleId: "outline",
							scope: { kind: "project", id: projectId },
							value: { type: "text", value: "Selective outline" },
							rationale: "Updated direction",
							evidence: [
								{
									kind: "user_decision",
									statement: "The user changed the outline.",
								},
							],
						},
					],
				},
				options
			);
			await call(
				appRouter.contextProposals.activate,
				{
					projectId,
					proposalId: proposal.id,
					expectedCurrentRevisionId: project.currentContextRevision.id,
				},
				options
			);
			expect(
				(
					await call(appRouter.assetVersions.list, { projectId }, rereadOptions)
				).assetVersions.map((version) => version.reviewEvents)
			).toEqual(
				beforeContextChange.assetVersions.map((version) => version.reviewEvents)
			);
			await expect(
				call(appRouter.assetVersions.reviewBatch, approvedInput, {
					context: { ...context, session: null } as never,
				})
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await expect(
				call(appRouter.assetVersions.reviewBatch, approvedInput, {
					context: reviewContext(db, "another-user") as never,
				})
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		} finally {
			if (projectId) {
				await [
					"asset_version_review_events",
					"asset_versions",
					"asset_records",
					"asset_families",
					"subject_identities",
					"visual_worlds",
					"context_proposals",
					"context_revisions",
				].reduce(async (previous, table) => {
					await previous;
					await db.execute(
						sql`DELETE FROM ${sql.identifier(table)} WHERE project_id = ${projectId}`
					);
				}, Promise.resolve());
				await db.execute(sql`DELETE FROM project WHERE id = ${projectId}`);
			}
			await db.execute(sql`DELETE FROM "user" WHERE id = ${userId}`);
		}
	}
);
