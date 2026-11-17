import { expect, test } from "bun:test";
import { createDb } from "@sprite-anvil/db";
import { user as userTable } from "@sprite-anvil/db/schema/auth";
import { project as projectTable } from "@sprite-anvil/db/schema/project";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { eq } from "drizzle-orm";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Context Agent permission grants persist and revocation stops new access",
	async () => {
		if (!databaseUrl) {
			throw new Error("DATABASE_URL must point to an isolated test branch");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const store = createProjectAccessStore(db, createProjectContextStore(db));
		const ownerUserId = crypto.randomUUID();
		await db.insert(userTable).values({
			id: ownerUserId,
			name: "Permission Test Owner",
			email: `${ownerUserId}@example.test`,
		});
		let projectId: string | null = null;

		try {
			const project = await store.createProject(ownerUserId, {
				name: "Permission Persistence Check",
				generalArtDirection: "Pixel art with a limited palette",
			});
			projectId = project.id;
			const [initialRevision] = await db
				.select()
				.from(contextRevisions)
				.where(eq(contextRevisions.projectId, project.id));
			expect(initialRevision).toMatchObject({
				revisionNumber: 0,
				state: "baseline",
				contractVersion: "context-rule/1.0.0",
			});
			const granted = await store.grantContextAgentPermission(
				ownerUserId,
				project.id,
				{
					purpose: "Prepare a project context proposal",
					scopes: ["project_context:read"],
				}
			);
			if (!granted) {
				throw new Error("Expected the owner to grant project access");
			}

			const readBack = await store.listContextAgentPermissions(
				ownerUserId,
				project.id
			);
			expect(readBack).toMatchObject([
				{
					id: granted.id,
					purpose: granted.purpose,
					scopes: granted.scopes,
					revokedAt: null,
				},
			]);
			expect(
				await store.hasContextAgentPermission(
					project.id,
					granted.purpose,
					"project_context:read"
				)
			).toBe(true);

			expect(
				await store.revokeContextAgentPermission(
					ownerUserId,
					project.id,
					granted.id
				)
			).toBe(true);
			const readBackAfterRevocation = await store.listContextAgentPermissions(
				ownerUserId,
				project.id
			);
			expect(readBackAfterRevocation?.[0]).toMatchObject({
				id: granted.id,
				revokedAt: expect.any(String),
			});
			expect(
				await store.hasContextAgentPermission(
					project.id,
					granted.purpose,
					"project_context:read"
				)
			).toBe(false);

			const visualPermission =
				await store.grantExternalVisualAnalysisPermission(
					ownerUserId,
					project.id,
					{
						category: "identity",
					}
				);
			expect(visualPermission).toBeNull();
			expect(
				await store.hasExternalVisualAnalysisPermission(project.id, "identity")
			).toBe(false);
			expect(
				await store.hasExternalVisualAnalysisPermission(project.id, "theme")
			).toBe(false);
			expect(
				await store.listExternalVisualAnalysisPermissions(
					ownerUserId,
					project.id
				)
			).toEqual([]);
		} finally {
			if (projectId) {
				await db.delete(projectTable).where(eq(projectTable.id, projectId));
			}
			await db.delete(userTable).where(eq(userTable.id, ownerUserId));
		}
	}
);
