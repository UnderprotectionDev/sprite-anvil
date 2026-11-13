import type { ErasureImpactScope } from "@sprite-anvil/api/permanent-erasure";

export interface StoredErasureImpactReport {
	assetRecordId: string;
	contractVersion: string;
	createdAt: Date;
	createdByUserId: string;
	id: string;
	projectId: string;
	reportDigest: string;
	/** Digest of the prepare request, so a repeated key with other content is a conflict. */
	requestDigest: string;
	/** The exact scope the digest covers; holds no file content. */
	scope: ErasureImpactScope;
}

/** The persistent side of Erasure Impact Reports. A report is only ever inserted. */
export interface ErasureImpactStorage {
	find: (
		projectId: string,
		reportId: string
	) => Promise<StoredErasureImpactReport | null>;
	insert: (
		row: StoredErasureImpactReport
	) => Promise<{ status: "inserted" } | { status: "conflict" }>;
}
