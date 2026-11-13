import { expect, test } from "bun:test";
import { measurementDefinitionActivateInputSchema } from "@sprite-anvil/api/measurement-definitions";
import { measurementEventRecordInputSchema } from "@sprite-anvil/api/measurement-events";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { measurementDefinitions } from "@sprite-anvil/db/schema/measurement-definitions";
import { measurementEvents } from "@sprite-anvil/db/schema/measurement-events";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { createDatabaseMeasurementDefinitionStorage } from "../database-measurement-definition-storage";
import { createDatabaseMeasurementEventStorage } from "../database-measurement-event-storage";
import { createMeasurementDefinitionStore } from "../measurement-definition-store";
import { createMeasurementEventStore } from "../measurement-event-store";
import { createMeasurementPseudonymizer } from "../measurement-pseudonym";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

// Neon HTTP cannot address a loopback PostgreSQL, so test runs against a
// disposable local database use the repository's TCP test adapter instead.
function createTestDb(targetUrl: string) {
	const target = new URL(targetUrl);
	return target.hostname === "127.0.0.1"
		? createLocalTestDb({ DATABASE_URL: targetUrl })
		: createDb({ DATABASE_URL: targetUrl });
}

test.skipIf(!databaseUrl)(
	"persists a pseudonymous event under its definition version and re-reads it from the database",
	async () => {
		const db = createTestDb(databaseUrl as string);
		const userId = `measurement-event-${crypto.randomUUID()}`;
		await db.insert(user).values({
			email: `${userId}@example.test`,
			emailVerified: true,
			id: userId,
			name: "Measurement event tester",
		});
		try {
			const definitionStorage = createDatabaseMeasurementDefinitionStorage(db);
			const definitions = createMeasurementDefinitionStore({
				storage: definitionStorage,
			});
			const activation = await definitions.activate(
				userId,
				measurementDefinitionActivateInputSchema.parse({
					contractVersion: "1.0",
					decisionUse:
						"Decide whether the production preview flow needs rework.",
					denominator: { outcomeClass: "workflow_started" },
					endEvent: "candidate_preview_available",
					eventFamily: "production_workflow",
					exclusions: [],
					id: crypto.randomUUID(),
					metricId: `metric_${crypto.randomUUID().replaceAll("-", "_")}`,
					numerator: { outcomeClass: "preview_reached" },
					retentionDays: 365,
					scope: {
						projects: { kind: "all_projects" },
						surfaces: ["web"],
						users: "owner_only",
					},
					startEvent: "generation_package_preparation_started",
					timeWindowDays: 30,
				})
			);
			if (activation.status !== "activated") {
				throw new Error("definition was not activated");
			}
			const projectId = crypto.randomUUID();
			const store = createMeasurementEventStore({
				definitionStorage,
				ownsProject: () => Promise.resolve(true),
				pseudonymize: createMeasurementPseudonymizer("integration-key"),
				storage: createDatabaseMeasurementEventStorage(db),
			});
			const input = measurementEventRecordInputSchema.parse({
				counters: { regeneration_count: 1 },
				definitionId: activation.definition.id,
				eventName: "generation_package_preparation_started",
				id: crypto.randomUUID(),
				outcomeClass: "workflow_started",
				projectId,
				recordKind: "generation_package",
				surface: "web",
				workflowId: crypto.randomUUID(),
			});

			const result = await store.record(userId, input);
			expect(result.status).toBe("recorded");

			const rows = await db
				.select()
				.from(measurementEvents)
				.where(eq(measurementEvents.id, input.id));
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({
				definitionId: activation.definition.id,
				definitionVersion: 1,
				counters: { regeneration_count: 1 },
			});
			expect(JSON.stringify(rows)).not.toContain(userId);
			expect(JSON.stringify(rows)).not.toContain(projectId);

			// A replay returns the stored event with its original server time.
			expect(await store.record(userId, input)).toEqual(result);

			// The measure computation reads the persisted events of one definition version.
			const listed = await createDatabaseMeasurementEventStorage(
				db
			).listByDefinitionId(activation.definition.id);
			expect(listed.map((event) => event.id)).toEqual([input.id]);
		} finally {
			await db
				.delete(measurementDefinitions)
				.where(eq(measurementDefinitions.ownerUserId, userId));
			await db.delete(user).where(eq(user.id, userId));
		}
	}
);
