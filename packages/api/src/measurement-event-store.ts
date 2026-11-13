import type {
	MeasurementEvent,
	MeasurementEventRecordInput,
} from "./measurement-events";

export type MeasurementEventRejectionReason =
	| "definition_not_found"
	| "event_not_in_definition"
	| "id_conflict"
	| "invalid_event"
	| "project_not_found"
	| "surface_out_of_scope";

export type MeasurementEventRecordResult =
	| { event: MeasurementEvent; status: "recorded" }
	| { reason: MeasurementEventRejectionReason; status: "rejected" };

/** Privacy-preserving collection of workflow events against a user's activated Measurement Definitions. */
export interface MeasurementEventStore {
	/** Stores one event envelope with pseudonymous ids and the server time; it computes nothing. */
	record: (
		userId: string,
		input: MeasurementEventRecordInput
	) => Promise<MeasurementEventRecordResult>;
}
