import type { HistoricalRiskNoticeRecord } from "@sprite-anvil/api/historical-risk-notices";

/** A Historical Risk Notice as persisted, with its detection time as a Date. */
export type StoredHistoricalRiskNotice = Omit<
	HistoricalRiskNoticeRecord,
	"detectedAt"
> & { detectedAt: Date };

export type InsertHistoricalRiskNoticeResult =
	| { status: "inserted" }
	/** A notice for the same Delivery Fulfilment and Rights Record revision already exists. */
	| { status: "conflict" };

/** The persistent side of Historical Risk Notices. Rows are only ever inserted; there is no update or delete. */
export interface HistoricalRiskNoticeStorage {
	findNotice: (
		projectId: string,
		fulfilmentId: string,
		rightsRecordId: string
	) => Promise<StoredHistoricalRiskNotice | null>;
	insertNotice: (
		notice: StoredHistoricalRiskNotice
	) => Promise<InsertHistoricalRiskNoticeResult>;
	listNotices: (
		projectId: string,
		deliveryTargetId: string
	) => Promise<StoredHistoricalRiskNotice[]>;
}
