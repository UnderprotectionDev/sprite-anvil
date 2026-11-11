export interface StoredRuntimeValidationRecord {
	adapterVersion: string | null;
	bundleId: string;
	createdAt: Date;
	createdByUserId: string;
	engineVersion: string;
	gameBuild: string;
	id: string;
	manifestDigest: string;
	projectId: string;
	requestDigest: string;
	supersedesRecordId: string | null;
}

export interface StoredRuntimeValidationDecision {
	createdAt: Date;
	decidedByUserId: string;
	failureSource:
		| "asset_content"
		| "engine_adapter"
		| "game_configuration"
		| "multiple_sources"
		| null;
	id: string;
	kind: "outcome" | "failure_source";
	outcome: "pass" | "fail" | "inconclusive" | null;
	projectId: string;
	recordId: string;
	requestDigest: string;
	/** Assigned by the storage in insert order; decisions are read in this order. */
	sequence: number;
}

/** A decision as inserted; the storage assigns its `sequence`. */
export type NewRuntimeValidationDecision = Omit<
	StoredRuntimeValidationDecision,
	"sequence"
>;

export interface StoredRuntimeValidationEvidence {
	byteSize: number | null;
	createdAt: Date;
	createdByUserId: string;
	fileName: string | null;
	id: string;
	kind: "screenshot" | "recording" | "test_result" | "observation";
	objectKey: string | null;
	projectId: string;
	recordId: string;
	requestDigest: string;
	sha256: string | null;
	source: "manual" | "adapter_draft";
	text: string | null;
}

export type InsertRuntimeValidationResult =
	| { status: "inserted" }
	/** The id already exists. */
	| { status: "conflict" };

export type InsertRuntimeValidationEvidenceResult =
	| InsertRuntimeValidationResult
	/** The record already has an outcome decision, so its evidence is closed. */
	| { status: "closed" };

/** The persistent side of Runtime Validation Records. Rows are only ever inserted. */
export interface RuntimeValidationStorage {
	findDecision: (
		projectId: string,
		decisionId: string
	) => Promise<StoredRuntimeValidationDecision | null>;
	findEvidence: (
		projectId: string,
		evidenceId: string
	) => Promise<StoredRuntimeValidationEvidence | null>;
	findRecord: (
		projectId: string,
		recordId: string
	) => Promise<StoredRuntimeValidationRecord | null>;
	/** A conflict is a taken id or, for an outcome, an outcome the record already has. */
	insertDecision: (
		decision: NewRuntimeValidationDecision
	) => Promise<InsertRuntimeValidationResult>;
	/**
	 * Closed, atomically with the check, when the record has an outcome decision:
	 * evidence and the outcome cannot both land after each other's check.
	 */
	insertEvidence: (
		evidence: StoredRuntimeValidationEvidence
	) => Promise<InsertRuntimeValidationEvidenceResult>;
	insertRecord: (
		record: StoredRuntimeValidationRecord
	) => Promise<InsertRuntimeValidationResult>;
	/** In the order made (by `sequence`). */
	listDecisions: (
		projectId: string,
		recordIds: string[]
	) => Promise<StoredRuntimeValidationDecision[]>;
	/** In the order added. */
	listEvidence: (
		projectId: string,
		recordIds: string[]
	) => Promise<StoredRuntimeValidationEvidence[]>;
	/** Oldest first; filtered to one bundle when `bundleId` is given. */
	listRecords: (
		projectId: string,
		bundleId?: string
	) => Promise<StoredRuntimeValidationRecord[]>;
}
