import type {
	PlatformEquivalenceOverview,
	PlatformEquivalenceReport,
	PlatformEquivalenceReportCreateInput,
	PlatformEquivalenceRun,
	PlatformEquivalenceRunRecordInput,
} from "./platform-equivalence";

export type PlatformEquivalenceRunResult =
	| { run: PlatformEquivalenceRun; status: "created" | "replayed" }
	| { reason: "bundle_not_found"; status: "rejected" };

export type PlatformEquivalenceReportResult =
	| { report: PlatformEquivalenceReport; status: "created" | "replayed" }
	| {
			reason: "run_not_found" | "run_surface_mismatch" | "no_runs_chosen";
			status: "rejected";
	  };

/** Authorized, project-scoped access to Platform Equivalence runs and reports. */
export interface PlatformEquivalenceStore {
	/** Null when the project is not found. */
	createReport: (
		userId: string,
		input: PlatformEquivalenceReportCreateInput
	) => Promise<PlatformEquivalenceReportResult | null>;
	/** Null when the project or report is not found. */
	getReport: (
		userId: string,
		projectId: string,
		reportId: string
	) => Promise<PlatformEquivalenceReport | null>;
	/** Null when the project is not found. */
	overview: (
		userId: string,
		projectId: string
	) => Promise<PlatformEquivalenceOverview | null>;
	/** Null when the project is not found. */
	recordRun: (
		userId: string,
		input: PlatformEquivalenceRunRecordInput
	) => Promise<PlatformEquivalenceRunResult | null>;
}
