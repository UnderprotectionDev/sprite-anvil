import { expect, test } from "bun:test";
import { createMeasurementDefinitionStore } from "../measurement-definition-store";
import { createMeasurementEventStore } from "../measurement-event-store";
import { createMeasurementPseudonymizer } from "../measurement-pseudonym";
import { createProductMeasurementRecorder } from "../measurement-workflows";
import { createMemoryMeasurementDefinitionStorage } from "./memory-measurement-definition-storage";
import { createMemoryMeasurementEventStorage } from "./memory-measurement-event-storage";

test("boundaries replay, preserve started versions and reject private content", async () => {
	const userId = crypto.randomUUID();
	const projectId = crypto.randomUUID();
	const workflowId = crypto.randomUUID();
	const definitions = createMemoryMeasurementDefinitionStorage();
	const events = createMemoryMeasurementEventStorage();
	const definitionStore = createMeasurementDefinitionStore({
		storage: definitions.storage,
	});
	const activate = (id: string) =>
		definitionStore.activate(userId, {
			id,
			contractVersion: "1.0",
			decisionUse: "test",
			denominator: { outcomeClass: "workflow_started" },
			numerator: { outcomeClass: "preview_reached" },
			startEvent: "generation_package_prepared",
			endEvent: "candidate_preview_reached",
			eventFamily: "production_workflow",
			exclusions: [],
			metricId: "preview",
			retentionDays: 30,
			scope: {
				projects: { kind: "all_projects" },
				surfaces: ["web"],
				users: "all_users",
			},
			timeWindowDays: 30,
		});
	const first = crypto.randomUUID();
	const second = crypto.randomUUID();
	await activate(first);
	const eventStore = createMeasurementEventStore({
		definitionStorage: definitions.storage,
		storage: events.storage,
		ownsProject: async () => true,
		pseudonymize: createMeasurementPseudonymizer("test"),
	});
	const recorder = createProductMeasurementRecorder({
		definitionStore,
		eventStore,
		storage: events.storage,
	});
	const input = {
		userId,
		projectId,
		workflowId,
		eventFamily: "production_workflow",
		surface: "web",
		recordKind: "generation_package",
		outcomeClass: "workflow_started",
		counters: { regeneration_count: 1 },
	} as const;
	await recorder.record({
		...input,
		eventName: "generation_package_prepared",
		phase: "start",
	});
	await recorder.record({
		...input,
		eventName: "generation_package_prepared",
		phase: "start",
	});
	expect(events.rows()).toHaveLength(1);
	await activate(second);
	await recorder.record({
		...input,
		phase: "finish",
		eventName: "candidate_preview_reached",
		outcomeClass: "preview_reached",
	});
	expect(events.rows().map((e) => e.definitionId)).toEqual([first, first]);
	await recorder.record({
		...input,
		workflowId: crypto.randomUUID(),
		phase: "finish",
		eventName: "candidate_preview_reached",
	});
	expect(events.rows()).toHaveLength(2);
	const nextWorkflow = crypto.randomUUID();
	await recorder.record({
		...input,
		workflowId: nextWorkflow,
		eventName: "generation_package_prepared",
		phase: "start",
	});
	expect(events.rows().at(-1)?.definitionId).toBe(second);
	const rejectedWorkflow = crypto.randomUUID();
	await recorder.record({
		...input,
		workflowId: rejectedWorkflow,
		surface: "desktop",
		eventName: "generation_package_prepared",
		phase: "start",
	});
	await recorder.record({
		...input,
		workflowId: rejectedWorkflow,
		phase: "finish",
		eventName: "candidate_preview_reached",
	});
	expect(events.rows()).toHaveLength(3);
	await recorder.record({
		...input,
		projectId: crypto.randomUUID(),
		phase: "finish",
		eventName: "candidate_preview_reached",
	});
	expect(events.rows()).toHaveLength(3);
	await expect(
		recorder.record({
			...input,
			phase: "start",
			filename: "secret.png",
		} as never)
	).rejects.toThrow();
	expect(JSON.stringify(events.rows())).not.toContain("secret.png");
});

test("best effort boundary ignores recorder errors", async () => {
	const { recordProductBoundary } = await import(
		"@sprite-anvil/api/measurement-workflows"
	);
	const original = console.error;
	const messages: unknown[][] = [];
	console.error = (...args: unknown[]) => {
		messages.push(args);
	};
	try {
		await recordProductBoundary(
			{
				surface: "web",
				productMeasurementRecorder: {
					record: () => Promise.reject(new Error("private content")),
				},
			},
			{
				userId: crypto.randomUUID(),
				projectId: crypto.randomUUID(),
				workflowId: crypto.randomUUID(),
				eventFamily: "production_workflow",
				eventName: "generation_package_prepared",
				phase: "start",
				recordKind: "generation_package",
				outcomeClass: "workflow_started",
				counters: {},
			}
		);
		expect(messages).toEqual([["product_measurement_boundary_failed"]]);
	} finally {
		console.error = original;
	}
});

test("records Ready and Delivered only for their matching definition boundaries", async () => {
	const userId = crypto.randomUUID();
	const projectId = crypto.randomUUID();
	const workflowId = crypto.randomUUID();
	const definitions = createMemoryMeasurementDefinitionStorage();
	const events = createMemoryMeasurementEventStorage();
	const definitionStore = createMeasurementDefinitionStore({
		storage: definitions.storage,
	});
	await Promise.all(
		(
			[
				["ready", "delivery_target_ready"],
				["delivered", "delivery_target_delivered"],
			] as const
		).map(([metricId, endEvent]) =>
			definitionStore.activate(userId, {
				id: crypto.randomUUID(),
				contractVersion: "1.0",
				decisionUse: "test",
				denominator: { outcomeClass: "workflow_started" },
				numerator: { outcomeClass: "ready" },
				startEvent: "delivery_target_activated",
				endEvent,
				eventFamily: "export_delivery",
				exclusions: [],
				metricId,
				retentionDays: 30,
				scope: {
					projects: { kind: "all_projects" },
					surfaces: ["web"],
					users: "all_users",
				},
				timeWindowDays: 30,
			})
		)
	);
	const recorder = createProductMeasurementRecorder({
		definitionStore,
		storage: events.storage,
		eventStore: createMeasurementEventStore({
			definitionStorage: definitions.storage,
			storage: events.storage,
			ownsProject: async () => true,
			pseudonymize: createMeasurementPseudonymizer("test"),
		}),
	});
	const input = {
		userId,
		projectId,
		workflowId,
		eventFamily: "export_delivery",
		surface: "web",
		recordKind: "delivery_target",
		counters: {},
	} as const;
	await recorder.record({
		...input,
		phase: "start",
		eventName: "delivery_target_activated",
		outcomeClass: "workflow_started",
	});
	await recorder.record({
		...input,
		phase: "finish",
		eventName: "delivery_target_ready",
		outcomeClass: "ready",
	});
	expect(
		events
			.rows()
			.filter((event) => event.eventName === "delivery_target_delivered")
	).toHaveLength(0);
	expect(
		events.rows().filter((event) => event.eventName === "delivery_target_ready")
	).toHaveLength(1);
	await recorder.record({
		...input,
		phase: "finish",
		eventName: "delivery_target_delivered",
		outcomeClass: "delivered",
	});
	expect(
		events
			.rows()
			.filter((event) => event.eventName === "delivery_target_delivered")
	).toHaveLength(1);
});

test("review and repair pairs only the original workflow and preserves its first start", async () => {
	const userId = crypto.randomUUID();
	const projectId = crypto.randomUUID();
	const workflowId = crypto.randomUUID();
	const definitions = createMemoryMeasurementDefinitionStorage();
	const events = createMemoryMeasurementEventStorage();
	const definitionStore = createMeasurementDefinitionStore({
		storage: definitions.storage,
	});
	await definitionStore.activate(userId, {
		id: crypto.randomUUID(),
		contractVersion: "1.0",
		decisionUse: "test",
		denominator: { outcomeClass: "workflow_started" },
		numerator: { outcomeClass: "completed" },
		startEvent: "review_issue_recorded",
		endEvent: "repaired_version_reviewed",
		eventFamily: "review_and_repair",
		exclusions: [],
		metricId: "repair",
		retentionDays: 30,
		scope: {
			projects: { kind: "all_projects" },
			surfaces: ["web"],
			users: "all_users",
		},
		timeWindowDays: 30,
	});
	const recorder = createProductMeasurementRecorder({
		definitionStore,
		storage: events.storage,
		eventStore: createMeasurementEventStore({
			definitionStorage: definitions.storage,
			storage: events.storage,
			ownsProject: async () => true,
			pseudonymize: createMeasurementPseudonymizer("test"),
		}),
	});
	const input = {
		userId,
		projectId,
		workflowId,
		eventFamily: "review_and_repair",
		surface: "web",
		recordKind: "unit_version",
		counters: {},
	} as const;
	await recorder.record({
		...input,
		phase: "start",
		eventName: "review_issue_recorded",
		outcomeClass: "workflow_started",
	});
	const [first] = events.rows();
	await recorder.record({
		...input,
		phase: "start",
		eventName: "review_issue_recorded",
		outcomeClass: "workflow_started",
	});
	await recorder.record({
		...input,
		workflowId: crypto.randomUUID(),
		phase: "finish",
		eventName: "repaired_version_reviewed",
		outcomeClass: "completed",
	});
	expect(events.rows()).toHaveLength(1);
	await recorder.record({
		...input,
		phase: "finish",
		eventName: "repaired_version_reviewed",
		outcomeClass: "completed",
	});
	expect(events.rows()).toHaveLength(2);
	expect(events.rows()[0]).toEqual(first);
});

test("offline verification records only a matched started workflow", async () => {
	const userId = crypto.randomUUID();
	const projectId = crypto.randomUUID();
	const workflowId = crypto.randomUUID();
	const definitions = createMemoryMeasurementDefinitionStorage();
	const events = createMemoryMeasurementEventStorage();
	const definitionStore = createMeasurementDefinitionStore({
		storage: definitions.storage,
	});
	await definitionStore.activate(userId, {
		id: crypto.randomUUID(),
		contractVersion: "1.0",
		decisionUse: "test",
		denominator: { outcomeClass: "workflow_started" },
		numerator: { outcomeClass: "verified" },
		startEvent: "bundle_verification_started",
		endEvent: "bundle_verification_finished",
		eventFamily: "offline_verification",
		exclusions: [],
		metricId: "verify",
		retentionDays: 30,
		scope: {
			projects: { kind: "all_projects" },
			surfaces: ["web"],
			users: "all_users",
		},
		timeWindowDays: 30,
	});
	const recorder = createProductMeasurementRecorder({
		definitionStore,
		storage: events.storage,
		eventStore: createMeasurementEventStore({
			definitionStorage: definitions.storage,
			storage: events.storage,
			ownsProject: async () => true,
			pseudonymize: createMeasurementPseudonymizer("test"),
		}),
	});
	const input = {
		userId,
		projectId,
		workflowId,
		eventFamily: "offline_verification",
		surface: "web",
		recordKind: "offline_verification",
		counters: {},
	} as const;
	await recorder.record({
		...input,
		phase: "finish",
		eventName: "bundle_verification_finished",
		outcomeClass: "verified",
	});
	expect(events.rows()).toHaveLength(0);
	await recorder.record({
		...input,
		phase: "start",
		eventName: "bundle_verification_started",
		outcomeClass: "workflow_started",
	});
	await recorder.record({
		...input,
		phase: "finish",
		eventName: "bundle_verification_finished",
		outcomeClass: "verified",
	});
	expect(events.rows().map((event) => event.eventName)).toEqual([
		"bundle_verification_started",
		"bundle_verification_finished",
	]);
});
