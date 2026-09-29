import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import {
	familyReadinessEvidence,
	familyRequiredSetActivations,
	familyRequiredSetHeads,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import { project } from "@sprite-anvil/db/schema/project";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { and, eq } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createCollectionStore } from "./features/collections/server/collection-store";
import { createFamilyReadinessStore } from "./features/family-readiness/server/family-readiness-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

function createContext(database: ReturnType<typeof createDb>, userId: string) {
	const projectContextStore = createProjectContextStore(database);
	return {
		assetFamilyStore: createAssetFamilyStore(database),
		familyReadinessStore: createFamilyReadinessStore(database),
		assetRecordStore: createAssetRecordStore(database),
		assetRecordTrackingStore: createAssetRecordTrackingStore(database, null),
		assetVersionStore: createAssetVersionStore(database),
		collectionStore: createCollectionStore(database),
		db: database,
		projectAccess: createProjectAccessStore(database, projectContextStore),
		projectContextScopeStore: createProjectContextScopeStore(database),
		projectContextStore,
		session: { user: { id: userId } } as Context["session"],
	} satisfies Context;
}

test.skipIf(!databaseUrl)(
	"persists an active Required Set and keeps a saved draft from changing its completion",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		let insertedUser = false;
		let projectId: string | undefined;
		let familyId: string | undefined;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Family Readiness Integration Test",
				email: `family-readiness-${userId}@example.test`,
			});
			insertedUser = true;

			const context = createContext(db, userId);
			const createdProject = await call(
				appRouter.projectContexts.create,
				{
					name: "Family Readiness Integration Project",
					generalArtDirection: "Clear silhouettes and a limited palette",
				},
				{ context }
			);
			projectId = createdProject.id;
			const visualWorld = await call(
				appRouter.contextScopes.createVisualWorld,
				{
					projectId,
					name: "Gameplay",
					description: "In-game assets",
				},
				{ context }
			);
			const identity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId, name: "Ash Knight" },
				{ context }
			);
			const family = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId,
					subjectIdentityId: identity.id,
					name: "Combat Sprite",
					visualWorldId: visualWorld.id,
					useContext: "combat",
				},
				{ context }
			);
			familyId = family.id;
			const assetRecord = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId,
					assetFamilyId: family.id,
					name: "East-facing sprite",
					identityCriteria: ["delivery_identity"],
				},
				{ context }
			);
			const firstRevision = await call(
				appRouter.familyReadiness.saveDraft,
				{
					projectId,
					assetFamilyId: family.id,
					items: [
						{
							id: "east-facing",
							kind: "direction",
							name: "East-facing sprite",
							disposition: "required",
							assetRecordIds: [assetRecord.id],
						},
					],
				},
				{ context }
			);

			const beforeActivation = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context }
			);
			expect(beforeActivation.status).toBe("not_configured");
			const activated = await call(
				appRouter.familyReadiness.activate,
				{
					projectId,
					assetFamilyId: family.id,
					revisionId: firstRevision.id,
				},
				{ context }
			);
			expect(activated.activeRevision?.id).toBe(firstRevision.id);
			expect(activated.status).toBe("incomplete");
			expect(activated.items[0]?.blockers).toContain("asset_version");

			const secondRevision = await call(
				appRouter.familyReadiness.saveDraft,
				{
					projectId,
					assetFamilyId: family.id,
					items: [],
				},
				{ context }
			);
			const afterDraft = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context }
			);
			expect(afterDraft.activeRevision?.id).toBe(firstRevision.id);
			expect(afterDraft.revisions.at(-1)?.id).toBe(secondRevision.id);
			expect(afterDraft.status).toBe("incomplete");

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadContext = createContext(rereadDb, userId);
			const reread = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context: rereadContext }
			);
			expect(reread.activeRevision?.id).toBe(firstRevision.id);
			expect(reread.items[0]?.item.id).toBe("east-facing");
			expect(reread.items[0]?.blockers).toContain("quality_contract");
		} finally {
			if (insertedUser && projectId) {
				if (familyId) {
					await db
						.delete(familyReadinessEvidence)
						.where(
							and(
								eq(familyReadinessEvidence.projectId, projectId),
								eq(familyReadinessEvidence.assetFamilyId, familyId)
							)
						);
					await db
						.delete(familyRequiredSetActivations)
						.where(
							and(
								eq(familyRequiredSetActivations.projectId, projectId),
								eq(familyRequiredSetActivations.assetFamilyId, familyId)
							)
						);
					await db
						.delete(familyRequiredSetHeads)
						.where(eq(familyRequiredSetHeads.projectId, projectId));
					await db
						.delete(familyRequiredSetRevisions)
						.where(
							and(
								eq(familyRequiredSetRevisions.projectId, projectId),
								eq(familyRequiredSetRevisions.assetFamilyId, familyId)
							)
						);
					await db
						.delete(assetRecords)
						.where(
							and(
								eq(assetRecords.projectId, projectId),
								eq(assetRecords.assetFamilyId, familyId)
							)
						);
					await db
						.delete(assetFamilies)
						.where(
							and(
								eq(assetFamilies.projectId, projectId),
								eq(assetFamilies.id, familyId)
							)
						);
				}
				await db
					.delete(subjectIdentities)
					.where(eq(subjectIdentities.projectId, projectId));
				await db
					.delete(visualWorlds)
					.where(eq(visualWorlds.projectId, projectId));
				await db
					.delete(contextRevisions)
					.where(eq(contextRevisions.projectId, projectId));
				await db.delete(project).where(eq(project.id, projectId));
				await db.delete(user).where(eq(user.id, userId));
			} else if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
