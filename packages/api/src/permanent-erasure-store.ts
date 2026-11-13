import type {
	ErasureImpactPrepareInput,
	ErasureImpactReport,
} from "./permanent-erasure";
import type {
	ErasureImpactRejection,
	ErasureImpactSource,
} from "./permanent-erasure-scope";

export type ErasureImpactPrepareResult =
	| { report: ErasureImpactReport; status: "created" | "replayed" }
	| ({ status: "rejected" } & ErasureImpactRejection);

/** Reads the persisted records one asset's Erasure Impact Report is built from. */
export interface ErasureImpactSourceReader {
	/** Null when the project or Asset Record is not found. */
	read: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<ErasureImpactSource | null>;
}

/** Authorized, project-scoped access to persisted Erasure Impact Reports. */
export interface ErasureImpactStore {
	/** Null when the project or Asset Record is not found. */
	get: (
		userId: string,
		projectId: string,
		reportId: string
	) => Promise<ErasureImpactReport | null>;
	/** Atomic and idempotent: the same key never yields a second report. Null when the project or Asset Record is not found. */
	prepare: (
		userId: string,
		input: ErasureImpactPrepareInput
	) => Promise<ErasureImpactPrepareResult | null>;
}
