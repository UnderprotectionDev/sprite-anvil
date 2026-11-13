import type { MeasurementEventFamily } from "@sprite-anvil/api/measurement-definitions";
import type { MeasurementEventRecordInput } from "@sprite-anvil/api/measurement-events";

/** The persisted envelope: no user or project id, only their pseudonyms, and no payload beyond labels and counters. */
export interface StoredMeasurementEvent
	extends Pick<
		MeasurementEventRecordInput,
		| "counters"
		| "definitionId"
		| "eventName"
		| "id"
		| "outcomeClass"
		| "recordKind"
		| "surface"
		| "workflowId"
	> {
	definitionVersion: number;
	eventFamily: MeasurementEventFamily;
	metricId: string;
	occurredAt: Date;
	projectPseudonym: string;
	userPseudonym: string;
}

export type InsertEventResult =
	| { event: StoredMeasurementEvent; status: "inserted" }
	| { status: "conflict" };

/** The persistent side of event collection. Rows are only inserted, never updated. */
export interface MeasurementEventStorage {
	findById: (id: string) => Promise<StoredMeasurementEvent | null>;
	/** A conflict means the id was taken, possibly concurrently. */
	insert: (event: StoredMeasurementEvent) => Promise<InsertEventResult>;
}
