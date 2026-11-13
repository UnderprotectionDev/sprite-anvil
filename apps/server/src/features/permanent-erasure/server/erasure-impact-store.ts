import {
	buildErasureImpactScope,
	type ErasureImpactReport,
	erasureContractSupport,
	erasureImpactDigest,
	erasureImpactReportSchema,
	erasureImpactRequestDigest,
	erasureImpactScopeSchema,
	type RetentionSchedule,
} from "@sprite-anvil/api/permanent-erasure";
import type {
	ErasureImpactSourceReader,
	ErasureImpactStore,
} from "@sprite-anvil/api/permanent-erasure-store";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	ErasureImpactStorage,
	StoredErasureImpactReport,
} from "./erasure-impact-storage";

export interface ErasureImpactStoreOptions {
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	/**
	 * The published backup retention schedule, supplied by configuration. Null
	 * while none is published: the report then claims no backup clean-up time.
	 */
	retentionSchedule?: () => RetentionSchedule | null;
	sourceReader: ErasureImpactSourceReader;
	storage: ErasureImpactStorage;
}

/** The report as a reader sees it, rebuilt from the stored scope. */
function toReport(stored: StoredErasureImpactReport): ErasureImpactReport {
	return erasureImpactReportSchema.parse({
		...stored.scope,
		createdAt: stored.createdAt.toISOString(),
		id: stored.id,
		reportDigest: stored.reportDigest,
	});
}

/** Failure text when the stored report cannot be trusted or read by this build, else null. */
async function integrityFailure(
	stored: StoredErasureImpactReport
): Promise<string | null> {
	const support = erasureContractSupport(stored.contractVersion);
	if (support.status !== "supported") {
		return "The Erasure Impact Report uses a contract version this build does not read.";
	}
	const parsed = erasureImpactScopeSchema.safeParse(stored.scope);
	if (
		!parsed.success ||
		parsed.data.contractVersion !== stored.contractVersion
	) {
		return "The Erasure Impact Report failed verification: the stored scope breaks its contract.";
	}
	if ((await erasureImpactDigest(parsed.data)) !== stored.reportDigest) {
		return "The Erasure Impact Report failed verification: its scope no longer matches its digest.";
	}
	return null;
}

export function createErasureImpactStore(
	options: ErasureImpactStoreOptions & { db?: Database }
): ErasureImpactStore {
	const { sourceReader, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) => {
			if (!options.db) {
				throw new Error("A database or a project lookup is required.");
			}
			return getProjectForUser(options.db, userId, projectId);
		});
	const now = options.now ?? (() => new Date());

	return {
		async get(userId, projectId, reportId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const stored = await storage.find(projectId, reportId);
			if (!stored) {
				return null;
			}
			const failure = await integrityFailure(stored);
			if (failure) {
				throw new RecordIntegrityError(failure);
			}
			return toReport(stored);
		},

		async prepare(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const reportId = await idempotentRecordId(
				{
					assetRecordId: input.assetRecordId,
					kind: "erasure-impact-report",
					projectId: input.projectId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await erasureImpactRequestDigest(input);
			const replay = () =>
				replayPublishedRecord({
					differs: (row) => row.requestDigest !== requestDigest,
					integrityFailure,
					label: "Erasure Impact Report",
					read: () => storage.find(input.projectId, reportId),
					toResult: toReport,
				});
			const replayed = await replay();
			if (replayed) {
				return { report: replayed, status: "replayed" };
			}

			const source = await sourceReader.read(
				userId,
				input.projectId,
				input.assetRecordId
			);
			if (!source) {
				return null;
			}
			const built = buildErasureImpactScope(source, {
				projectId: input.projectId,
				retention: options.retentionSchedule?.() ?? null,
			});
			if (!built.ok) {
				const { ok: _ok, ...rejection } = built;
				return { ...rejection, status: "rejected" };
			}
			const inserted = await storage.insert({
				assetRecordId: input.assetRecordId,
				contractVersion: built.scope.contractVersion,
				createdAt: now(),
				createdByUserId: userId,
				id: reportId,
				projectId: input.projectId,
				reportDigest: await erasureImpactDigest(built.scope),
				requestDigest,
				scope: built.scope,
			});
			if (inserted.status === "conflict") {
				// A concurrent request with the same key won; its record is the answer.
				const winner = await replay();
				if (!winner) {
					throw new RetryablePublicationError("Erasure Impact Report");
				}
				return { report: winner, status: "replayed" };
			}
			const report = await verifyPublishedRecord({
				integrityFailure,
				label: "Erasure Impact Report",
				read: () => storage.find(input.projectId, reportId),
				toResult: toReport,
			});
			return { report, status: "created" };
		},
	};
}
