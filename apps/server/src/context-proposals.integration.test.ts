import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type { ContextRule } from "@sprite-anvil/api/project-context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { eq } from "drizzle-orm";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextStore } from "./project-context-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"creates and rereads a structured proposal through Neon and Drizzle",
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
			const context: Context = {
				db,
				projectAccess: createProjectAccessStore(db, store),
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
				projectContextStore: createProjectContextStore(
					createDb({ DATABASE_URL: databaseUrl })
				),
			};
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
		} finally {
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
