import { expect, test } from "bun:test";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import {
	deliveryTargetDrafts,
	deliveryTargetRevisions,
	deliveryTargets,
} from "@sprite-anvil/db/schema/delivery-planning";
import { project } from "@sprite-anvil/db/schema/project";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { createDatabaseReadinessPlanStorage } from "../database-readiness-plan-storage";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

// Neon HTTP cannot address a loopback PostgreSQL, so test runs against a
// disposable local database use the repository's TCP test adapter instead.
function createTestDb(targetUrl: string) {
	const target = new URL(targetUrl);
	return target.hostname === "127.0.0.1"
		? createLocalTestDb({ DATABASE_URL: targetUrl })
		: createDb({ DATABASE_URL: targetUrl });
}

type TestDatabase = ReturnType<typeof createDb>;

/**
 * Inserts a project, one Delivery Target and a revision row per requested
 * number straight into the planning tables (without Asset Families, which the
 * stored order never reads), so the guard is tested against real rows.
 */
async function seedTarget(db: TestDatabase, userId: string) {
	const projectId = crypto.randomUUID();
	const contextRevisionId = crypto.randomUUID();
	const deliveryTargetId = crypto.randomUUID();
	await db.insert(project).values({
		id: projectId,
		name: "Readiness Plan Storage",
		ownerUserId: userId,
	});
	await db.insert(contextRevisions).values({
		contractVersion: "test",
		createdByUserId: userId,
		id: contextRevisionId,
		projectId,
		revisionNumber: 1,
		rules: [],
		state: "baseline",
	});
	await db.insert(deliveryTargets).values({
		createdByUserId: userId,
		id: deliveryTargetId,
		name: "Demo build",
		projectId,
		purpose: "demo",
	});
	const addRevision = async (revisionNumber: number) => {
		const draftId = crypto.randomUUID();
		const revisionId = crypto.randomUUID();
		await db.insert(deliveryTargetDrafts).values({
			contextRevisionId,
			createdByUserId: userId,
			deliveryTargetId,
			id: draftId,
			productionEvidencePolicy: {
				defaultRequirement: "advisory",
				familyRequirements: [],
			},
			projectId,
			rightsEvidencePolicy: {
				acceptableStates: ["documented"],
				requireRecordFor: [],
			},
		});
		await db.insert(deliveryTargetRevisions).values({
			activatedByUserId: userId,
			deliveryTargetId,
			draftId,
			id: revisionId,
			projectId,
			revisionNumber,
		});
		return revisionId;
	};
	return { addRevision, deliveryTargetId, projectId };
}

/** Runs `body` with a test user, then deletes the user, which cascades to its projects and every planning row seeded under them. */
async function withTestUser(
	body: (setup: { db: TestDatabase; userId: string }) => Promise<void>
) {
	if (!databaseUrl) {
		throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
	}
	const db = createTestDb(databaseUrl);
	const userId = crypto.randomUUID();
	await db.insert(user).values({
		id: userId,
		name: "Readiness Plan Integration Test",
		email: `readiness-plan-${userId}@example.test`,
	});
	try {
		await body({ db, userId });
	} finally {
		await db.delete(user).where(eq(user.id, userId));
	}
}

test.skipIf(!databaseUrl)(
	"saves an order only while its revision is the target's latest",
	async () => {
		await withTestUser(async ({ db, userId }) => {
			const { addRevision, deliveryTargetId, projectId } = await seedTarget(
				db,
				userId
			);
			const storage = createDatabaseReadinessPlanStorage(db);
			const order = (revisionId: string, orderedWorkIds: string[]) => ({
				deliveryTargetId,
				orderedWorkIds,
				projectId,
				revisionId,
				updatedAt: new Date("2026-11-09T10:00:00.000Z"),
				updatedByUserId: userId,
			});

			const firstRevisionId = await addRevision(1);
			expect(await storage.saveOrder(order(firstRevisionId, ["a", "b"]))).toBe(
				true
			);
			expect(await storage.saveOrder(order(firstRevisionId, ["b", "a"]))).toBe(
				true
			);
			expect(await storage.findOrder(projectId, firstRevisionId)).toEqual([
				"b",
				"a",
			]);

			const secondRevisionId = await addRevision(2);
			expect(await storage.saveOrder(order(firstRevisionId, ["a", "b"]))).toBe(
				false
			);
			expect(await storage.findOrder(projectId, firstRevisionId)).toEqual([
				"b",
				"a",
			]);
			expect(await storage.saveOrder(order(secondRevisionId, ["a"]))).toBe(
				true
			);
			expect(await storage.findOrder(projectId, secondRevisionId)).toEqual([
				"a",
			]);

			// A revision id paired with another project or target never writes.
			expect(
				await storage.saveOrder({
					...order(secondRevisionId, ["z"]),
					projectId: crypto.randomUUID(),
				})
			).toBe(false);
			expect(
				await storage.saveOrder({
					...order(secondRevisionId, ["z"]),
					deliveryTargetId: crypto.randomUUID(),
				})
			).toBe(false);
			expect(await storage.findOrder(projectId, secondRevisionId)).toEqual([
				"a",
			]);
		});
	}
);
