import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import { projectArchiveRestores } from "@sprite-anvil/db/schema/project-archives";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import {
	createLocalTestDb,
	isLoopbackTestDatabaseUrl,
} from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"unverified and legacy restored Projects are hidden until canonical verification",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const sourceId = crypto.randomUUID();
		const pendingId = crypto.randomUUID();
		const legacyId = crypto.randomUUID();
		const rollback = new Error("rollback");
		try {
			await expect(
				db.transaction(async (tx) => {
					await tx.insert(user).values({
						id: userId,
						name: "Owner",
						email: `${userId}@example.test`,
					});
					await tx.insert(project).values(
						[sourceId, pendingId, legacyId].map((id) => ({
							id,
							ownerUserId: userId,
							name: id,
						}))
					);
					await tx.insert(contextRevisions).values(
						[sourceId, pendingId, legacyId].map((projectId) => ({
							id: crypto.randomUUID(),
							projectId,
							revisionNumber: 0,
							state: "active" as const,
							contractVersion: "context-rule/1.0.0",
							rules: [],
							createdByUserId: userId,
						}))
					);
					await tx.insert(projectArchiveRestores).values([
						{
							id: "pending",
							restoredProjectId: pendingId,
							sourceProjectId: sourceId,
							archiveId: "archive",
							manifestDigest: "m",
							requestDigest: "r",
							createdByUserId: userId,
							canonicalVerified: false,
						},
						{
							id: "legacy",
							restoredProjectId: legacyId,
							sourceProjectId: sourceId,
							archiveId: "archive",
							manifestDigest: "m",
							requestDigest: "r",
							createdByUserId: userId,
						},
					]);
					const dbTx = tx as unknown as Database;
					const contextStore = createProjectContextStore(dbTx);
					const access = createProjectAccessStore(dbTx, contextStore);
					const context = {
						session: { user: { id: userId } },
						projectAccess: access,
						projectContextStore: contextStore,
						assetRecordStore: createAssetRecordStore(dbTx),
					} as unknown as Context;
					expect(
						(await call(appRouter.projects.list, {}, { context })).map(
							(item) => item.id
						)
					).toEqual([sourceId]);
					expect(
						(await call(appRouter.projectContexts.list, {}, { context })).map(
							(item) => item.id
						)
					).toEqual([sourceId]);
					expect(await access.getProject(userId, pendingId)).toBeNull();
					expect(await access.getProject(userId, legacyId)).toBeNull();
					await expect(
						call(
							appRouter.assetRecords.list,
							{ projectId: pendingId },
							{ context }
						)
					).rejects.toMatchObject({ code: "NOT_FOUND" });
					await tx
						.update(projectArchiveRestores)
						.set({ canonicalVerified: true })
						.where(eq(projectArchiveRestores.restoredProjectId, pendingId));
					expect((await access.getProject(userId, pendingId))?.id).toBe(
						pendingId
					);
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.close();
		}
	}
);
