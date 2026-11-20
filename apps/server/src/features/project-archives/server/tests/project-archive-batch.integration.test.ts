import { expect, test } from "bun:test";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import { eq } from "drizzle-orm";
import { createDatabaseProjectArchiveStorage } from "../database-project-archive-storage";

const databaseUrl = process.env.ARCHIVE_BATCH_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"publishes a Project Archive atomically and rolls back if a section conflicts",
	async () => {
		if (!databaseUrl || new URL(databaseUrl).hostname !== "db.localtest.me") {
			throw new Error("A disposable Neon proxy database is required.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const storage = createDatabaseProjectArchiveStorage(db);
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const archiveId = crypto.randomUUID();
		const section = {
			digest: "digest",
			group: "foundation" as const,
			name: "assetRecords",
			recordCount: 0,
			records: [],
		};
		const record = {
			archive: {
				createdAt: new Date(),
				createdByUserId: userId,
				id: archiveId,
				manifestDigest: "manifest",
				projectId,
				requestDigest: "request",
				schemaVersion: "1.0.0",
			},
			files: [],
			sections: [section],
		};

		await db.insert(user).values({
			email: `${userId}@example.test`,
			id: userId,
			name: "Archive owner",
		});
		try {
			await db.insert(project).values({
				id: projectId,
				name: "Archive batch test",
				ownerUserId: userId,
			});
			expect(
				await storage.insert({ ...record, sections: [section, section] })
			).toEqual({ status: "conflict" });
			expect(await storage.find(projectId, archiveId)).toBeNull();
			expect(await storage.insert(record)).toEqual({ status: "inserted" });
			expect((await storage.find(projectId, archiveId))?.sections).toEqual([
				section,
			]);
		} finally {
			await db.delete(project).where(eq(project.id, projectId));
			await db.delete(user).where(eq(user.id, userId));
		}
	}
);
