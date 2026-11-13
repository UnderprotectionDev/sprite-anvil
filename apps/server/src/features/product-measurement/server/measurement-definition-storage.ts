import type { MeasurementDefinitionActivateInput } from "@sprite-anvil/api/measurement-definitions";

/** The user-fixed fields of a definition; the id is the idempotency key. */
export type MeasurementDefinitionContent = MeasurementDefinitionActivateInput;

export interface StoredMeasurementDefinition
	extends MeasurementDefinitionContent {
	activatedAt: Date;
	ownerUserId: string;
	version: number;
}

export type NewMeasurementDefinition = Omit<
	StoredMeasurementDefinition,
	"version"
>;

export type InsertDefinitionResult =
	| { definition: StoredMeasurementDefinition; status: "inserted" }
	| { status: "conflict" };

/** The persistent side of Measurement Definitions. Rows are only inserted, never updated. */
export interface MeasurementDefinitionStorage {
	findById: (id: string) => Promise<StoredMeasurementDefinition | null>;
	/** Inserts the metric's next version number; a conflict means the id or the number was taken concurrently. */
	insert: (
		definition: NewMeasurementDefinition
	) => Promise<InsertDefinitionResult>;
	listForOwner: (ownerUserId: string) => Promise<StoredMeasurementDefinition[]>;
}
