import {
	type ErasureImpactReport,
	type ErasureImpactScope,
	erasureImpactDigest,
} from "@sprite-anvil/api/permanent-erasure";
import { buildErasureImpactScope } from "@sprite-anvil/api/permanent-erasure-scope";
import type {
	ErasureImpactSourceReader,
	ErasureImpactStore,
} from "@sprite-anvil/api/permanent-erasure-store";
import { RecordIntegrityError } from "@sprite-anvil/api/record-publication";

export type ErasureReportRead =
	| { report: ErasureImpactReport; status: "found" }
	| { status: "not_found" }
	| { status: "unreadable" };

export interface ErasureScopeProofOptions {
	impactStore: ErasureImpactStore;
	sourceReader: ErasureImpactSourceReader;
}

/**
 * Reads an approved Erasure Impact Report and proves the records still hold
 * exactly the scope it describes: the approval and the Deletion Job both rest
 * on this proof.
 */
export function createErasureScopeProof(options: ErasureScopeProofOptions) {
	const { impactStore, sourceReader } = options;

	/** The exact scope of the report as the records stand now; null when it can no longer be built. */
	async function currentScope(
		userId: string,
		report: ErasureImpactReport
	): Promise<ErasureImpactScope | null> {
		const source = await sourceReader.read(
			userId,
			report.projectId,
			report.target.assetRecordId
		);
		if (!source) {
			return null;
		}
		const built = buildErasureImpactScope(source, {
			projectId: report.projectId,
			// The report's own schedule, so a later schedule change is not mistaken for a scope change.
			retention:
				report.backup.status === "scheduled"
					? {
							purgeWindowDays: report.backup.purgeWindowDays,
							version: report.backup.retentionScheduleVersion,
						}
					: null,
		});
		return built.ok ? built.scope : null;
	}

	return {
		/** The scope the records hold now when it still digests to `reportDigest`; null when it changed. */
		async provenScope(
			userId: string,
			report: ErasureImpactReport,
			reportDigest: string
		): Promise<ErasureImpactScope | null> {
			if (report.reportDigest !== reportDigest) {
				return null;
			}
			const scope = await currentScope(userId, report);
			return scope && (await erasureImpactDigest(scope)) === reportDigest
				? scope
				: null;
		},

		async readReport(
			userId: string,
			projectId: string,
			reportId: string
		): Promise<ErasureReportRead> {
			try {
				const report = await impactStore.get(userId, projectId, reportId);
				return report ? { report, status: "found" } : { status: "not_found" };
			} catch (error) {
				if (error instanceof RecordIntegrityError) {
					return { status: "unreadable" };
				}
				throw error;
			}
		},
	};
}

export type ErasureScopeProof = ReturnType<typeof createErasureScopeProof>;
