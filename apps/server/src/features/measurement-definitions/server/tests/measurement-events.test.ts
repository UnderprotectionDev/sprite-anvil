import { expect, test } from "bun:test";
import { measurementDefinitionActivateInputSchema } from "@sprite-anvil/api/measurement-definitions";
import {
	type MeasurementEventRecordInput,
	measurementEventRecordInputSchema,
} from "@sprite-anvil/api/measurement-events";
import { createMeasurementDefinitionStore } from "../measurement-definition-store";
import { createMeasurementEventStore } from "../measurement-event-store";
import { createMeasurementPseudonymizer } from "../measurement-pseudonym";
import { createMemoryMeasurementDefinitionStorage } from "./memory-measurement-definition-storage";
import { createMemoryMeasurementEventStorage } from "./memory-measurement-event-storage";

const ownerId = "user-owner";
const otherUserId = "user-other";
const projectId = crypto.randomUUID();
const pseudonymize = createMeasurementPseudonymizer("test-key");
const serverTime = new Date("2026-11-13T10:00:00.000Z");

async function setup() {
	const definitions = createMemoryMeasurementDefinitionStorage();
	const events = createMemoryMeasurementEventStorage();
	const definitionStore = createMeasurementDefinitionStore({
		storage: definitions.storage,
	});
	const activation = await definitionStore.activate(
		ownerId,
		measurementDefinitionActivateInputSchema.parse({
			contractVersion: "1.0",
			decisionUse: "Decide whether the production preview flow needs rework.",
			denominator: { outcomeClass: "workflow_started" },
			endEvent: "candidate_preview_available",
			eventFamily: "production_workflow",
			exclusions: [],
			id: crypto.randomUUID(),
			metricId: "time_to_first_preview",
			numerator: { outcomeClass: "preview_reached" },
			retentionDays: 365,
			scope: {
				projects: { kind: "all_projects" },
				surfaces: ["web"],
				users: "all_users",
			},
			startEvent: "generation_package_preparation_started",
			timeWindowDays: 30,
		})
	);
	if (activation.status !== "activated") {
		throw new Error("setup definition was not activated");
	}
	let clock = serverTime;
	const store = createMeasurementEventStore({
		definitionStorage: definitions.storage,
		now: () => clock,
		pseudonymize,
		storage: events.storage,
	});
	return {
		definition: activation.definition,
		events,
		setClock: (next: Date) => {
			clock = next;
		},
		store,
	};
}

function eventInput(
	definitionId: string,
	overrides: Record<string, unknown> = {}
): MeasurementEventRecordInput {
	return measurementEventRecordInputSchema.parse({
		counters: { regeneration_count: 2 },
		definitionId,
		eventName: "generation_package_preparation_started",
		id: crypto.randomUUID(),
		outcomeClass: "workflow_started",
		projectId,
		recordKind: "generation_package",
		surface: "web",
		workflowId: crypto.randomUUID(),
		...overrides,
	});
}

test("recording stores a pseudonymous envelope stamped with server time, related to the definition version, and re-reads it from the persisted record", async () => {
	const { definition, events, store } = await setup();
	const input = eventInput(definition.id);

	const result = await store.record(ownerId, input);

	expect(result.status).toBe("recorded");
	if (result.status !== "recorded") {
		return;
	}
	expect(result.event).toEqual({
		counters: { regeneration_count: 2 },
		definitionId: definition.id,
		definitionVersion: definition.version,
		eventFamily: "production_workflow",
		eventName: input.eventName,
		id: input.id,
		metricId: "time_to_first_preview",
		occurredAt: serverTime.toISOString(),
		outcomeClass: "workflow_started",
		projectPseudonym: pseudonymize("project", projectId),
		recordKind: "generation_package",
		surface: "web",
		timeSource: "server_time",
		userPseudonym: pseudonymize("user", ownerId),
		workflowId: input.workflowId,
	});
	const persisted = JSON.stringify(events.rows());
	expect(persisted).not.toContain(ownerId);
	expect(persisted).not.toContain(projectId);
});

test("the client clock never moves an event: time fields are rejected at the boundary and the server clock stamps it", async () => {
	const { definition, setClock, store } = await setup();
	for (const extra of [
		{ occurredAt: "2020-01-01T00:00:00.000Z" },
		{ clientTime: "2020-01-01T00:00:00.000Z" },
		{ timeSource: "client_time" },
	]) {
		expect(
			measurementEventRecordInputSchema.safeParse({
				...eventInput(definition.id),
				...extra,
			}).success
		).toBe(false);
	}
	const later = new Date("2026-11-14T00:00:00.000Z");
	setClock(later);
	const result = await store.record(ownerId, eventInput(definition.id));
	expect(result.status === "recorded" && result.event.occurredAt).toBe(
		later.toISOString()
	);
});

test("payloads carrying file content, pixels, raw instructions, notes, local paths, asset names or secrets are rejected and never persisted", async () => {
	const { definition, events, store } = await setup();
	const forbidden: Record<string, unknown>[] = [
		{ fileContent: "iVBORw0KGgo=" },
		{ pixels: [0, 255, 0, 255] },
		{ rawInstruction: "draw a red knight" },
		{ note: "looks off" },
		{ localPath: "/Users/me/art/knight.png" },
		{ assetName: "knight_idle" },
		{ accessSecret: "sk_live_abcdef" },
		// Free text smuggled into the allowed string fields.
		{ outcomeClass: "Draw a red knight with a sword" },
		{ recordKind: "/Users/me/art/knight.png" },
		{ recordKind: "C:\\art\\knight.png" },
		{ outcomeClass: "ghp_0123456789abcdefghijklmnopqrstuvwxyz" },
		{ outcomeClass: "a3f9c2d41b7e8a06c5d2e1f09b8a7c6d" },
		{ counters: { "knight idle.png": 1 } },
		{ counters: { regeneration_count: "two" } },
		{ counters: { regeneration_count: -1 } },
		{ counters: { regeneration_count: 1.5 } },
	];
	for (const extra of forbidden) {
		expect(
			measurementEventRecordInputSchema.safeParse({
				...eventInput(definition.id),
				...extra,
			}).success
		).toBe(false);
	}
	expect(events.rows()).toHaveLength(0);
	// A payload that bypassed the boundary still never reaches storage.
	const rejected = await store.record(ownerId, {
		...eventInput(definition.id),
		note: "x",
	} as MeasurementEventRecordInput);
	expect(rejected).toEqual({ reason: "invalid_event", status: "rejected" });
	expect(events.rows()).toHaveLength(0);
});

test("an event must relate to one of the user's activated definitions, its start or end event, its family and its scope", async () => {
	const { definition, events, store } = await setup();

	const unknown = await store.record(ownerId, eventInput(crypto.randomUUID()));
	expect(unknown).toEqual({
		reason: "definition_not_found",
		status: "rejected",
	});

	const foreign = await store.record(otherUserId, eventInput(definition.id));
	expect(foreign).toEqual({
		reason: "definition_not_found",
		status: "rejected",
	});

	const wrongEvent = await store.record(
		ownerId,
		eventInput(definition.id, { eventName: "export_started" })
	);
	expect(wrongEvent).toEqual({
		reason: "event_not_in_definition",
		status: "rejected",
	});

	const wrongSurface = await store.record(
		ownerId,
		eventInput(definition.id, { surface: "desktop" })
	);
	expect(wrongSurface).toEqual({
		reason: "surface_out_of_scope",
		status: "rejected",
	});
	expect(events.rows()).toHaveLength(0);
});

test("the end event and the same id are accepted idempotently; the same id with different content conflicts", async () => {
	const { definition, events, store } = await setup();
	const input = eventInput(definition.id);

	const first = await store.record(ownerId, input);
	const again = await store.record(ownerId, input);
	expect(again).toEqual(first);
	expect(events.rows()).toHaveLength(1);

	const conflicting = await store.record(ownerId, {
		...input,
		outcomeClass: "preview_reached",
	});
	expect(conflicting).toEqual({ reason: "id_conflict", status: "rejected" });

	const end = await store.record(
		ownerId,
		eventInput(definition.id, {
			eventName: "candidate_preview_available",
			outcomeClass: "preview_reached",
			workflowId: input.workflowId,
		})
	);
	expect(end.status).toBe("recorded");
	expect(events.rows()).toHaveLength(2);
});

test("pseudonyms are stable per key, differ by kind and key, and do not contain the id", () => {
	const keyed = createMeasurementPseudonymizer("key-one");
	const other = createMeasurementPseudonymizer("key-two");
	expect(keyed("user", ownerId)).toBe(keyed("user", ownerId));
	expect(keyed("user", ownerId)).not.toBe(keyed("project", ownerId));
	expect(keyed("user", ownerId)).not.toBe(other("user", ownerId));
	expect(keyed("user", ownerId)).not.toContain(ownerId);
	expect(() => createMeasurementPseudonymizer("")).toThrow();
});
