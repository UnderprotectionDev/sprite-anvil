import type {
	MeasurementEventRecordResult,
	MeasurementEventStore,
} from "@sprite-anvil/api/measurement-event-store";
import {
	type MeasurementEvent,
	measurementEventRecordInputSchema,
	measurementEventSchema,
} from "@sprite-anvil/api/measurement-events";
import type { MeasurementDefinitionStorage } from "./measurement-definition-storage";
import type {
	MeasurementEventStorage,
	StoredMeasurementEvent,
} from "./measurement-event-storage";

export type PseudonymKind = "project" | "user";

export interface MeasurementEventStoreOptions {
	definitionStorage: MeasurementDefinitionStorage;
	/** The server clock; it stamps every event, never a client-supplied time. */
	now?: () => Date;
	/** A stable, one-way pseudonym for an id, so the stored envelope never holds the real user or project id. */
	pseudonymize: (kind: PseudonymKind, id: string) => string;
	storage: MeasurementEventStorage;
}

/** Key-order independent form of the fields an event's identity covers (everything but the time). */
function contentKey(event: StoredMeasurementEvent): string {
	return JSON.stringify({
		counters: Object.entries(event.counters).sort(([left], [right]) =>
			left.localeCompare(right)
		),
		definitionId: event.definitionId,
		eventName: event.eventName,
		outcomeClass: event.outcomeClass,
		projectPseudonym: event.projectPseudonym,
		recordKind: event.recordKind,
		surface: event.surface,
		userPseudonym: event.userPseudonym,
		workflowId: event.workflowId,
	});
}

function toEvent(stored: StoredMeasurementEvent): MeasurementEvent {
	return measurementEventSchema.parse({
		counters: stored.counters,
		definitionId: stored.definitionId,
		definitionVersion: stored.definitionVersion,
		eventFamily: stored.eventFamily,
		eventName: stored.eventName,
		id: stored.id,
		metricId: stored.metricId,
		occurredAt: stored.occurredAt.toISOString(),
		outcomeClass: stored.outcomeClass,
		projectPseudonym: stored.projectPseudonym,
		recordKind: stored.recordKind,
		surface: stored.surface,
		timeSource: "server_time",
		userPseudonym: stored.userPseudonym,
		workflowId: stored.workflowId,
	});
}

export function createMeasurementEventStore({
	definitionStorage,
	now = () => new Date(),
	pseudonymize,
	storage,
}: MeasurementEventStoreOptions): MeasurementEventStore {
	function resolveExisting(
		existing: StoredMeasurementEvent,
		candidate: StoredMeasurementEvent
	): MeasurementEventRecordResult {
		return contentKey(existing) === contentKey(candidate)
			? { event: toEvent(existing), status: "recorded" }
			: { reason: "id_conflict", status: "rejected" };
	}

	return {
		async record(userId, rawInput) {
			// The boundary schema already ran; parsing again keeps a caller that
			// skipped it from persisting anything outside the strict envelope.
			const parsed = measurementEventRecordInputSchema.safeParse(rawInput);
			if (!parsed.success) {
				return { reason: "invalid_event", status: "rejected" };
			}
			const input = parsed.data;

			const definition = await definitionStorage.findById(input.definitionId);
			if (!definition || definition.ownerUserId !== userId) {
				return { reason: "definition_not_found", status: "rejected" };
			}
			if (
				input.eventName !== definition.startEvent &&
				input.eventName !== definition.endEvent
			) {
				return { reason: "event_not_in_definition", status: "rejected" };
			}
			if (!definition.scope.surfaces.includes(input.surface)) {
				return { reason: "surface_out_of_scope", status: "rejected" };
			}

			const candidate: StoredMeasurementEvent = {
				counters: input.counters,
				definitionId: definition.id,
				definitionVersion: definition.version,
				eventFamily: definition.eventFamily,
				eventName: input.eventName,
				id: input.id,
				metricId: definition.metricId,
				occurredAt: now(),
				outcomeClass: input.outcomeClass,
				projectPseudonym: pseudonymize("project", input.projectId),
				recordKind: input.recordKind,
				surface: input.surface,
				userPseudonym: pseudonymize("user", userId),
				workflowId: input.workflowId,
			};

			const existing = await storage.findById(candidate.id);
			if (existing) {
				return resolveExisting(existing, candidate);
			}
			const result = await storage.insert(candidate);
			if (result.status === "inserted") {
				return { event: toEvent(result.event), status: "recorded" };
			}
			// Lost a race for the same id: resolve from what was stored.
			const winner = await storage.findById(candidate.id);
			return winner
				? resolveExisting(winner, candidate)
				: { reason: "id_conflict", status: "rejected" };
		},
	};
}
