import type { ExportBundle } from "@sprite-anvil/api/export-bundles";
import {
	type PlatformEquivalenceReport,
	type PlatformEquivalenceRun,
	platformEquivalenceOverviewSchema,
	platformEquivalenceReportSchema,
	platformEquivalenceRunSchema,
} from "@sprite-anvil/api/platform-equivalence";
import {
	compareEquivalenceEvidence,
	deriveEquivalenceEvidence,
	type PlatformEquivalenceEvidence,
	platformEquivalenceEvidenceSchema,
	platformEquivalenceNotEvaluated,
} from "@sprite-anvil/api/platform-equivalence-comparison";
import type {
	PlatformEquivalenceReportResult,
	PlatformEquivalenceStore,
} from "@sprite-anvil/api/platform-equivalence-store";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	PlatformEquivalenceStorage,
	StoredPlatformEquivalenceReport,
	StoredPlatformEquivalenceRun,
} from "./platform-equivalence-storage";

export interface PlatformEquivalenceStoreOptions {
	/** Reads one stored Export Bundle for the user; null when it is not found. */
	bundles: {
		get: (
			userId: string,
			projectId: string,
			bundleId: string
		) => Promise<ExportBundle | null>;
	};
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	storage: PlatformEquivalenceStorage;
}

function toRun(stored: StoredPlatformEquivalenceRun): PlatformEquivalenceRun {
	return platformEquivalenceRunSchema.parse({
		bundleId: stored.bundleId,
		createdAt: stored.createdAt.toISOString(),
		evidence: stored.evidence,
		id: stored.id,
		projectId: stored.projectId,
		surface: stored.surface,
		surfaceIdentity: "client_declared",
	});
}

function toReport(
	stored: StoredPlatformEquivalenceReport
): PlatformEquivalenceReport {
	return platformEquivalenceReportSchema.parse({
		claimsFullAcceptance: false,
		comparison: stored.comparison,
		createdAt: stored.createdAt.toISOString(),
		desktopRunId: stored.desktopRunId,
		id: stored.id,
		notEvaluated: [...platformEquivalenceNotEvaluated],
		phase: "phase_3_interim",
		projectId: stored.projectId,
		surfaceIdentity: "client_declared",
		webRunId: stored.webRunId,
	});
}

/** Failure text when a stored run no longer matches its own evidence, else null. */
async function runIntegrityFailure(
	run: StoredPlatformEquivalenceRun
): Promise<string | null> {
	const evidence = platformEquivalenceEvidenceSchema.safeParse(run.evidence);
	if (!evidence.success) {
		return "The Platform Equivalence Run evidence does not match its contract.";
	}
	if (
		(await recordContentDigest(evidence.data.input)) !==
			evidence.data.inputDigest ||
		evidence.data.inputDigest !== run.inputDigest
	) {
		return "The Platform Equivalence Run input digest does not match its record.";
	}
	return null;
}

type ChosenRuns =
	| {
			desktop: PlatformEquivalenceEvidence | null;
			status: "chosen";
			web: PlatformEquivalenceEvidence | null;
	  }
	| {
			reason: "run_not_found" | "run_surface_mismatch";
			status: "rejected";
	  };

/** Reads the chosen runs, checks their surface and integrity, and returns their evidence. */
async function chooseRuns(
	storage: PlatformEquivalenceStorage,
	input: {
		desktopRunId: string | null;
		projectId: string;
		webRunId: string | null;
	}
): Promise<ChosenRuns> {
	const [web, desktop] = await Promise.all([
		input.webRunId ? storage.findRun(input.projectId, input.webRunId) : null,
		input.desktopRunId
			? storage.findRun(input.projectId, input.desktopRunId)
			: null,
	]);
	if ((input.webRunId && !web) || (input.desktopRunId && !desktop)) {
		return { reason: "run_not_found", status: "rejected" };
	}
	if (
		(web && web.surface !== "web") ||
		(desktop && desktop.surface !== "desktop")
	) {
		return { reason: "run_surface_mismatch", status: "rejected" };
	}
	const failures = await Promise.all(
		[web, desktop].map((run) => (run ? runIntegrityFailure(run) : null))
	);
	const failure = failures.find((message) => message !== null);
	if (failure) {
		throw new RecordIntegrityError(failure);
	}
	const evidenceOf = (run: StoredPlatformEquivalenceRun | null) =>
		run ? (run.evidence as unknown as PlatformEquivalenceEvidence) : null;
	return {
		desktop: evidenceOf(desktop),
		status: "chosen",
		web: evidenceOf(web),
	};
}

function newestFirst<T>(rows: T[]): T[] {
	return [...rows].reverse();
}

export function createPlatformEquivalenceStore(
	db: Database,
	options: PlatformEquivalenceStoreOptions
): PlatformEquivalenceStore {
	const { bundles, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	return {
		async createReport(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			if (!(input.webRunId || input.desktopRunId)) {
				return { reason: "no_runs_chosen", status: "rejected" };
			}
			const reportId = await idempotentRecordId(
				{
					kind: "platform-equivalence-report",
					projectId: input.projectId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await recordContentDigest({
				desktopRunId: input.desktopRunId,
				webRunId: input.webRunId,
			});
			const replay = () =>
				replayPublishedRecord({
					differs: (row) => row.requestDigest !== requestDigest,
					integrityFailure: () => null,
					label: "Platform Equivalence Report",
					read: () => storage.findReport(input.projectId, reportId),
					toResult: toReport,
				});
			const replayed = await replay();
			if (replayed) {
				return { report: replayed, status: "replayed" };
			}

			const chosen = await chooseRuns(storage, input);
			if (chosen.status === "rejected") {
				return chosen;
			}
			const comparison = compareEquivalenceEvidence(chosen.web, chosen.desktop);

			const inserted = await storage.insertReport({
				comparison,
				createdAt: now(),
				createdByUserId: userId,
				desktopRunId: input.desktopRunId,
				id: reportId,
				projectId: input.projectId,
				requestDigest,
				webRunId: input.webRunId,
			});
			if (inserted.status === "conflict") {
				const winner = await replay();
				if (!winner) {
					throw new RetryablePublicationError("Platform Equivalence Report");
				}
				return { report: winner, status: "replayed" };
			}
			const report = await verifyPublishedRecord({
				integrityFailure: () => null,
				label: "Platform Equivalence Report",
				read: () => storage.findReport(input.projectId, reportId),
				toResult: toReport,
			});
			return {
				report,
				status: "created",
			} satisfies PlatformEquivalenceReportResult;
		},

		async getReport(userId, projectId, reportId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const stored = await storage.findReport(projectId, reportId);
			return stored ? toReport(stored) : null;
		},

		async overview(userId, projectId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const [runs, reports] = await Promise.all([
				storage.listRuns(projectId),
				storage.listReports(projectId),
			]);
			return platformEquivalenceOverviewSchema.parse({
				reports: newestFirst(reports).map(toReport),
				runs: newestFirst(runs).map(toRun),
			});
		},

		async recordRun(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const runId = await idempotentRecordId(
				{
					kind: "platform-equivalence-run",
					projectId: input.projectId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await recordContentDigest({
				bundleId: input.bundleId,
				surface: input.surface,
			});
			const replay = () =>
				replayPublishedRecord({
					differs: (row) => row.requestDigest !== requestDigest,
					integrityFailure: runIntegrityFailure,
					label: "Platform Equivalence Run",
					read: () => storage.findRun(input.projectId, runId),
					toResult: toRun,
				});
			const replayed = await replay();
			if (replayed) {
				return { run: replayed, status: "replayed" };
			}

			const bundle = await bundles.get(userId, input.projectId, input.bundleId);
			if (!bundle) {
				return { reason: "bundle_not_found", status: "rejected" };
			}
			const evidence = await deriveEquivalenceEvidence(bundle);
			const inserted = await storage.insertRun({
				bundleId: bundle.id,
				createdAt: now(),
				createdByUserId: userId,
				evidence,
				id: runId,
				inputDigest: evidence.inputDigest,
				projectId: input.projectId,
				requestDigest,
				surface: input.surface,
			});
			if (inserted.status === "conflict") {
				const winner = await replay();
				if (!winner) {
					throw new RetryablePublicationError("Platform Equivalence Run");
				}
				return { run: winner, status: "replayed" };
			}
			const run = await verifyPublishedRecord({
				integrityFailure: runIntegrityFailure,
				label: "Platform Equivalence Run",
				read: () => storage.findRun(input.projectId, runId),
				toResult: toRun,
			});
			return { run, status: "created" };
		},
	};
}
