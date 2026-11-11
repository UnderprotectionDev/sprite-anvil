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
}

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

/** The persistent side of Runtime Validation Records. Rows are only ever inserted. */
export interface RuntimeValidationStorage {
	findEvidence: (
		projectId: string,
		evidenceId: string
	) => Promise<StoredRuntimeValidationEvidence | null>;
	findRecord: (
		projectId: string,
		recordId: string
	) => Promise<StoredRuntimeValidationRecord | null>;
	insertEvidence: (
		evidence: StoredRuntimeValidationEvidence
	) => Promise<InsertRuntimeValidationResult>;
	insertRecord: (
		record: StoredRuntimeValidationRecord
	) => Promise<InsertRuntimeValidationResult>;
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
