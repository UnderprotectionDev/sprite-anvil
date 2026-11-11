import type {
	RuntimeValidationEvidence,
	RuntimeValidationFileEvidenceInput,
	RuntimeValidationRecord,
	RuntimeValidationRecordCreateInput,
	RuntimeValidationRecordList,
	RuntimeValidationStoredEvidenceFile,
	RuntimeValidationTextEvidenceInput,
} from "./runtime-validation";

export type RuntimeValidationRecordCreateResult =
	| { record: RuntimeValidationRecord; status: "created" | "replayed" }
	| { reason: "bundle_not_found"; status: "rejected" };

export interface RuntimeValidationEvidenceResult {
	evidence: RuntimeValidationEvidence;
	status: "created" | "replayed";
}

/** Authorized, project-scoped access to immutable Runtime Validation Records and their evidence. */
export interface RuntimeValidationStore {
	/** Null when the project or record is not found. */
	addFileEvidence: (
		userId: string,
		input: RuntimeValidationFileEvidenceInput
	) => Promise<RuntimeValidationEvidenceResult | null>;
	/** Null when the project or record is not found. */
	addTextEvidence: (
		userId: string,
		input: RuntimeValidationTextEvidenceInput
	) => Promise<RuntimeValidationEvidenceResult | null>;
	/** Null when the project is not found. */
	create: (
		userId: string,
		input: RuntimeValidationRecordCreateInput
	) => Promise<RuntimeValidationRecordCreateResult | null>;
	/** Null when the project or record is not found. */
	get: (
		userId: string,
		projectId: string,
		recordId: string
	) => Promise<RuntimeValidationRecord | null>;
	/** Null when the project, record or evidence file is not found. */
	getEvidenceFile: (
		userId: string,
		projectId: string,
		recordId: string,
		evidenceId: string
	) => Promise<RuntimeValidationStoredEvidenceFile | null>;
	/** Null when the project is not found. */
	list: (
		userId: string,
		projectId: string,
		bundleId?: string
	) => Promise<RuntimeValidationRecordList | null>;
}
