import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import { eq } from "drizzle-orm";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"persists a profile activation per project and rereads its immutable contract revision",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const firstProjectId = crypto.randomUUID();
		const secondProjectId = crypto.randomUUID();
		let insertedUser = false;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Specialized Profile Contract Integration Test",
				email: `profile-contracts-${userId}@example.test`,
			});
			insertedUser = true;
			await db.insert(project).values([
				{
					id: firstProjectId,
					ownerUserId: userId,
					name: "Profile Contract Project One",
				},
				{
					id: secondProjectId,
					ownerUserId: userId,
					name: "Profile Contract Project Two",
				},
			]);

			const context = {
				specializedProfileContractStore:
					createSpecializedProfileContractStore(db),
				session: { user: { id: userId } } as Context["session"],
			} as Context;
			const activation = await call(
				appRouter.specializedProfileContracts.activate,
				{ projectId: firstProjectId, profileId: "icon" },
				{ context }
			);

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadContext = {
				specializedProfileContractStore:
					createSpecializedProfileContractStore(rereadDb),
				session: { user: { id: userId } } as Context["session"],
			} as Context;
			const activeInFirstProject = await call(
				appRouter.specializedProfileContracts.getActive,
				{ projectId: firstProjectId, profileId: "icon" },
				{ context: rereadContext }
			);
			const secondProjectCatalog = await call(
				appRouter.specializedProfileContracts.list,
				{ projectId: secondProjectId },
				{ context: rereadContext }
			);

			expect(activeInFirstProject).toEqual(activation);
			expect(activeInFirstProject?.contract.profileId).toBe("icon");
			expect(activeInFirstProject?.contractRevisionId).toBe("icon@1.0.0");
			expect(
				secondProjectCatalog.profiles.every(
					(profile) => profile.activeContract === null
				)
			).toBe(true);
		} finally {
			if (insertedUser) {
				await db.delete(project).where(eq(project.ownerUserId, userId));
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
