import type {
	MeasurementEventRecordResult,
	MeasurementEventRejectionReason,
	MeasurementEventStore,
} from "@sprite-anvil/api/measurement-event-store";
import {
	type MeasurementEvent,
	measurementEventRecordInputSchema,
	measurementEventSchema,
	measurementEventVersion,
} from "@sprite-anvil/api/measurement-events";
import type { MeasurementDefinitionStorage } from "./measurement-definition-storage";
import type {
	MeasurementEventStorage,
	StoredMeasurementEvent,
} from "./measurement-event-storage";
import type { Pseudonymize } from "./measurement-pseudonymize";
import { createScopeCheck, type ScopeViolation } from "./measurement-scope";

export interface MeasurementEventStoreOptions {
	definitionStorage: MeasurementDefinitionStorage;
	/** The server clock; it stamps every event, never a client-supplied time. */
	now?: () => Date;
	/** Whether the user owns the project; events for a project the caller cannot access are refused. */
	ownsProject: (userId: string, projectId: string) => Promise<boolean>;
	/** A stable, one-way pseudonym for an id, so the stored envelope never holds the real user or project id. */
	pseudonymize: Pseudonymize;
	storage: MeasurementEventStorage;
}

const scopeRejections = {
	project: "project_out_of_scope",
	surface: "surface_out_of_scope",
	user: "user_out_of_scope",
} as const satisfies Record<ScopeViolation, MeasurementEventRejectionReason>;

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
		...stored,
		occurredAt: stored.occurredAt.toISOString(),
		timeSource: "server_time",
	});
}

export function createMeasurementEventStore({
	definitionStorage,
	now = () => new Date(),
	ownsProject,
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
			if (!(await ownsProject(userId, input.projectId))) {
				return { reason: "project_not_found", status: "rejected" };
			}
			if (
				input.eventName !== definition.startEvent &&
				input.eventName !== definition.endEvent
			) {
				return { reason: "event_not_in_definition", status: "rejected" };
			}

			const { projectId, ...envelope } = input;
			const candidate: StoredMeasurementEvent = {
				...envelope,
				definitionVersion: definition.version,
				eventFamily: definition.eventFamily,
				eventVersion: measurementEventVersion,
				metricId: definition.metricId,
				occurredAt: now(),
				projectPseudonym: pseudonymize("project", projectId),
				userPseudonym: pseudonymize("user", userId),
			};
			// The same rule the measures apply, so an out-of-scope event is never stored.
			const violation = createScopeCheck(definition, pseudonymize)(candidate);
			if (violation) {
				return { reason: scopeRejections[violation], status: "rejected" };
			}

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
