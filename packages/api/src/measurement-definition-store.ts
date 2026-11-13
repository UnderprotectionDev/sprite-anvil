import type {
	MeasurementDefinition,
	MeasurementDefinitionActivateInput,
	MeasurementDefinitionCatalog,
} from "./measurement-definitions";

export type MeasurementDefinitionRejectionReason =
	| "id_conflict"
	| "unsupported_contract_version";

export type MeasurementDefinitionActivateResult =
	| { definition: MeasurementDefinition; status: "activated" }
	| { reason: MeasurementDefinitionRejectionReason; status: "rejected" }
	| { status: "version_conflict" };

/** A user's own Measurement Definitions; no one reads or activates another user's. */
export interface MeasurementDefinitionStore {
	/** Records the metric's next immutable version; it changes no earlier version and computes nothing. */
	activate: (
		userId: string,
		input: MeasurementDefinitionActivateInput
	) => Promise<MeasurementDefinitionActivateResult>;
	/** Every version of every metric, read from the persisted records. */
	list: (userId: string) => Promise<MeasurementDefinitionCatalog>;
}
