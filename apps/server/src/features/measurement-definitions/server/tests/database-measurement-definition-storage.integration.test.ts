import { expect, test } from "bun:test";
import { measurementDefinitionActivateInputSchema } from "@sprite-anvil/api/measurement-definitions";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { measurementDefinitions } from "@sprite-anvil/db/schema/measurement-definitions";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { createDatabaseMeasurementDefinitionStorage } from "../database-measurement-definition-storage";
import { createMeasurementDefinitionStore } from "../measurement-definition-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

// Neon HTTP cannot address a loopback PostgreSQL, so test runs against a
// disposable local database use the repository's TCP test adapter instead.
function createTestDb(targetUrl: string) {
	const target = new URL(targetUrl);
	return target.hostname === "127.0.0.1"
		? createLocalTestDb({ DATABASE_URL: targetUrl })
		: createDb({ DATABASE_URL: targetUrl });
}

function definitionInput(metricId: string, timeWindowDays: number) {
	return measurementDefinitionActivateInputSchema.parse({
		contractVersion: "1.0",
		decisionUse: "Decide whether the production preview flow needs rework.",
		denominator: { outcomeClass: "workflow_started" },
		endEvent: "candidate_preview_available",
		eventFamily: "production_workflow",
		exclusions: ["internal_test_project"],
		id: crypto.randomUUID(),
		metricId,
		numerator: { outcomeClass: "preview_reached" },
		retentionDays: 365,
		scope: {
			projects: { kind: "all_projects" },
			surfaces: ["web"],
			users: "owner_only",
		},
		startEvent: "generation_package_preparation_started",
		timeWindowDays,
	});
}

test.skipIf(!databaseUrl)(
	"persists versions per metric, never rewrites an earlier one and re-reads them from the database",
	async () => {
		const db = createTestDb(databaseUrl as string);
		const userId = `measurement-${crypto.randomUUID()}`;
		await db.insert(user).values({
			email: `${userId}@example.test`,
			emailVerified: true,
			id: userId,
			name: "Measurement tester",
		});
		try {
			const store = createMeasurementDefinitionStore({
				storage: createDatabaseMeasurementDefinitionStorage(db),
			});
			const metricId = `metric_${crypto.randomUUID().replaceAll("-", "_")}`;
			const first = definitionInput(metricId, 30);
			const firstResult = await store.activate(userId, first);
			const secondResult = await store.activate(
				userId,
				definitionInput(metricId, 90)
			);

			expect(firstResult.status).toBe("activated");
			expect(secondResult.status === "activated").toBe(true);

			const { definitions } = await store.list(userId);
			expect(definitions.map((definition) => definition.version)).toEqual([
				1, 2,
			]);
			expect(definitions[0]).toMatchObject({
				id: first.id,
				timeSource: "server_time",
				timeWindowDays: 30,
			});
			expect(definitions[1]?.timeWindowDays).toBe(90);

			// A replay with the same id returns the stored version, not a new one.
			const replay = await store.activate(userId, first);
			expect(replay).toEqual(firstResult);
			expect((await store.list(userId)).definitions).toHaveLength(2);
		} finally {
			await db
				.delete(measurementDefinitions)
				.where(eq(measurementDefinitions.ownerUserId, userId));
			await db.delete(user).where(eq(user.id, userId));
		}
	}
);
