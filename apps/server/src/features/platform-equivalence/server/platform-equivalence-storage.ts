export interface StoredPlatformEquivalenceRun {
	bundleId: string;
	createdAt: Date;
	createdByUserId: string;
	/** Input and per-section evidence derived from the bundle. */
	evidence: Record<string, unknown>;
	id: string;
	inputDigest: string;
	projectId: string;
	/** Digest of the record request, so a repeated key with other content is a conflict. */
	requestDigest: string;
	surface: "desktop" | "web";
}

export interface StoredPlatformEquivalenceReport {
	comparison: Record<string, unknown>;
	createdAt: Date;
	createdByUserId: string;
	desktopRunId: string | null;
	id: string;
	projectId: string;
	requestDigest: string;
	webRunId: string | null;
}

export type InsertPlatformEquivalenceResult =
	| { status: "inserted" }
	/** The id already exists. */
	| { status: "conflict" };

/** The persistent side of Platform Equivalence. Runs and reports are only ever inserted. */
export interface PlatformEquivalenceStorage {
	findReport: (
		projectId: string,
		reportId: string
	) => Promise<StoredPlatformEquivalenceReport | null>;
	findRun: (
		projectId: string,
		runId: string
	) => Promise<StoredPlatformEquivalenceRun | null>;
	insertReport: (
		report: StoredPlatformEquivalenceReport
	) => Promise<InsertPlatformEquivalenceResult>;
	insertRun: (
		run: StoredPlatformEquivalenceRun
	) => Promise<InsertPlatformEquivalenceResult>;
	/** Oldest first. */
	listReports: (
		projectId: string
	) => Promise<StoredPlatformEquivalenceReport[]>;
	/** Oldest first. */
	listRuns: (projectId: string) => Promise<StoredPlatformEquivalenceRun[]>;
}
