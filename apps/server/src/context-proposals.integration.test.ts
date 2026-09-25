import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { ContextRule } from "@sprite-anvil/api/project-context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { eq } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"creates, reviews, and activates a structured proposal through Neon and Drizzle",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const email = `context-proposal-${userId}@example.test`;
		let insertedUser = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Context Proposal Integration Test",
				email,
			});
			insertedUser = true;

			const store = createProjectContextStore(db);
			const scopeStore = createProjectContextScopeStore(db);
			const context: Context = {
				assetFamilyStore: createAssetFamilyStore(db),
				assetVersionStore: createAssetVersionStore(db),
				db,
				projectAccess: createProjectAccessStore(db, store),
				projectContextScopeStore: scopeStore,
				projectContextStore: store,
				session: { user: { id: userId } } as Context["session"],
			};
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Fractional Outline Integration",
					generalArtDirection: "Readable silhouettes with fine outlines",
				},
				{ context }
			);
			const visualWorld = await call(
				appRouter.contextScopes.createVisualWorld,
				{ projectId: project.id, name: "Ridge villages" },
				{ context }
			);
			const theme = await call(
				appRouter.contextScopes.createTheme,
				{
					projectId: project.id,
					visualWorldId: visualWorld.id,
					name: "Lantern festival",
				},
				{ context }
			);
			const scopeCatalog = await call(
				appRouter.contextScopes.list,
				{ projectId: project.id },
				{ context }
			);

			expect(scopeCatalog).toEqual({
				visualWorlds: [visualWorld],
				themes: [theme],
			});

			const activeRevisionId = crypto.randomUUID();
			const activeRule: ContextRule = {
				contractVersion: "context-rule/1.0.0",
				id: "outline.width",
				scope: { kind: "project", id: project.id },
				value: { type: "number", value: 1 },
				source: { kind: "project_setup" },
				rationale: "Initial outline width",
				createdAt: new Date().toISOString(),
				precedenceChain: [{ kind: "project", id: project.id }],
			};
			await db.insert(contextRevisions).values({
				id: activeRevisionId,
				projectId: project.id,
				revisionNumber: 1,
				state: "active",
				contractVersion: "context-rule/1.0.0",
				rules: [activeRule],
				createdByUserId: userId,
			});

			const [currentProject] = await call(
				appRouter.projectContexts.list,
				{},
				{ context }
			);
			expect(currentProject?.currentContextRevision.id).toBe(activeRevisionId);

			const created = await call(
				appRouter.contextProposals.create,
				{
					projectId: project.id,
					baseContextRevisionId: activeRevisionId,
					summary: "Keep a fractional outline width",
					changes: [
						{
							operation: "replace",
							ruleId: "outline.width",
							scope: { kind: "project", id: project.id },
							value: { type: "number", value: 1.5 },
							rationale: "The chosen sprite scale needs a fractional outline.",
							evidence: [
								{
									kind: "user_decision",
									statement: "Use a 1.5 pixel outline.",
								},
							],
						},
					],
				},
				{ context }
			);

			const rereadContext: Context = {
				...context,
				assetFamilyStore: createAssetFamilyStore(
					createDb({ DATABASE_URL: databaseUrl })
				),
				projectContextScopeStore: createProjectContextScopeStore(
					createDb({ DATABASE_URL: databaseUrl })
				),
				projectContextStore: createProjectContextStore(
					createDb({ DATABASE_URL: databaseUrl })
				),
			};
			const review = await call(
				appRouter.contextProposals.review,
				{ projectId: project.id, proposalId: created.id },
				{ context: rereadContext }
			);
			const activated = await call(
				appRouter.contextProposals.activate,
				{
					projectId: project.id,
					proposalId: created.id,
					expectedCurrentRevisionId: review.currentRevisionId,
				},
				{ context: rereadContext }
			);
			const repeatedReview = await call(
				appRouter.contextProposals.review,
				{ projectId: project.id, proposalId: created.id },
				{ context: rereadContext }
			);
			const repeatedActivation = await call(
				appRouter.contextProposals.activate,
				{
					projectId: project.id,
					proposalId: created.id,
					expectedCurrentRevisionId: repeatedReview.currentRevisionId,
				},
				{ context: rereadContext }
			);
			const reread = await call(
				appRouter.contextProposals.list,
				{ projectId: project.id },
				{ context: rereadContext }
			);

			expect(created.baseContextRevisionId).toBe(activeRevisionId);
			expect(created.changes[0]).toMatchObject({
				operation: "replace",
				value: { type: "number", value: 1.5 },
			});
			expect(reread).toEqual([created]);
			expect(review.activationAllowed).toBe(true);
			expect(review.contextCopy).toContain("1.5");
			expect(activated).toMatchObject({
				revisionNumber: 2,
				sourceProposalId: created.id,
				isActive: true,
			});
			expect(repeatedActivation).toEqual(activated);

			const laterProposal = await call(
				appRouter.contextProposals.create,
				{
					projectId: project.id,
					baseContextRevisionId: activated.id,
					summary: "Keep light direction consistent",
					changes: [
						{
							operation: "add",
							ruleId: "light.direction",
							scope: { kind: "project", id: project.id },
							value: { type: "text", value: "north east" },
							rationale: "Keep the environment lighting consistent.",
							evidence: [
								{
									kind: "user_decision",
									statement: "Light comes from the north east.",
								},
							],
						},
					],
				},
				{ context: rereadContext }
			);
			const laterReview = await call(
				appRouter.contextProposals.review,
				{ projectId: project.id, proposalId: laterProposal.id },
				{ context: rereadContext }
			);
			const laterActivation = await call(
				appRouter.contextProposals.activate,
				{
					projectId: project.id,
					proposalId: laterProposal.id,
					expectedCurrentRevisionId: laterReview.currentRevisionId,
				},
				{ context: rereadContext }
			);
			const oldProposalReview = await call(
				appRouter.contextProposals.review,
				{ projectId: project.id, proposalId: created.id },
				{ context: rereadContext }
			);
			expect(oldProposalReview).toMatchObject({
				activationAllowed: false,
				activatedRevisionNumber: 2,
				targetRevisionNumber: 2,
			});
			await expect(
				call(
					appRouter.contextProposals.activate,
					{
						projectId: project.id,
						proposalId: created.id,
						expectedCurrentRevisionId: oldProposalReview.currentRevisionId,
					},
					{ context: rereadContext }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			const currentProjects = await call(
				appRouter.projectContexts.list,
				{},
				{ context: rereadContext }
			);
			const revisions = await db
				.select({
					id: contextRevisions.id,
					revisionNumber: contextRevisions.revisionNumber,
					state: contextRevisions.state,
					sourceProposalId: contextRevisions.sourceProposalId,
				})
				.from(contextRevisions)
				.where(eq(contextRevisions.projectId, project.id));

			expect(laterActivation).toMatchObject({
				revisionNumber: 3,
				sourceProposalId: laterProposal.id,
				isActive: true,
			});
			expect(currentProjects[0]?.currentContextRevision).toEqual(
				laterActivation
			);
			expect(revisions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: activeRevisionId,
						revisionNumber: 1,
						state: "inactive",
					}),
					expect.objectContaining({
						revisionNumber: 2,
						state: "inactive",
						sourceProposalId: created.id,
					}),
					expect.objectContaining({
						revisionNumber: 3,
						state: "active",
						sourceProposalId: laterProposal.id,
					}),
				])
			);
		} finally {
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
