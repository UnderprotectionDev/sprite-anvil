import type { HistoricalRiskNotice } from "@sprite-anvil/api/historical-risk-notices";
import { rightsRecordStateLabel as label } from "../../lib/rights-record-state-labels";
import { shortId } from "../../lib/short-id";

function currentPolicyText(notice: HistoricalRiskNotice) {
	if (!notice.currentPolicy) {
		return "This Delivery Target has no activated revision to evaluate against.";
	}
	const { accepted, revisionNumber } = notice.currentPolicy;
	return accepted
		? `The current Rights Evidence Policy (revision ${revisionNumber}) accepts ${label(notice.rightsRecordState)} for new use.`
		: `The current Rights Evidence Policy (revision ${revisionNumber}) does not accept ${label(notice.rightsRecordState)} for new use.`;
}

/**
 * The immutable Historical Risk Notices of a target, newest first. A notice
 * only reports declared Rights Record risk: it is not a legal conclusion and it
 * never changes a Delivery Fulfilment or its pinned evidence.
 */
export function HistoricalRiskNoticeList({
	notices,
}: {
	notices: HistoricalRiskNotice[];
}) {
	if (notices.length === 0) {
		return (
			<p className="text-muted-foreground">
				No Historical Risk Notice exists for this Delivery Target.
			</p>
		);
	}
	return (
		<ul className="space-y-3">
			{notices.map((notice) => (
				<li className="space-y-2 rounded border p-3" key={notice.id}>
					<p className="font-medium">
						Rights Record revision {notice.rightsRecordVersionNumber} (
						{label(notice.rightsRecordState)}) does not match the policy pinned
						by Fulfilment {shortId(notice.fulfilmentId)}
					</p>
					<p className="text-muted-foreground text-sm">
						Risky source: Asset Record {shortId(notice.assetRecordId)}
						{notice.pinnedRights
							? `, pinned at revision ${notice.pinnedRights.versionNumber} (${label(notice.pinnedRights.state)})`
							: ", which the Fulfilment pinned without a Rights Record"}
						. Detected {new Date(notice.detectedAt).toLocaleString()}. The
						pinned policy accepts{" "}
						{notice.pinnedPolicy.acceptableStates.map(label).join(", ")}.
					</p>
					<ul className="space-y-1 text-sm">
						{notice.affectedUsage.map((usage) => (
							<li key={`${usage.assetFamilyId}:${usage.itemId}`}>
								Affected usage: {usage.assetFamilyName}: {usage.itemName} ·
								Export Bundle {shortId(usage.bundleId)}
							</li>
						))}
					</ul>
					<p className="text-sm">{currentPolicyText(notice)}</p>
					<p className="text-muted-foreground text-sm">
						This notice records declared rights evidence only. It is not a legal
						judgment, and the Delivered result and pinned evidence of the
						Fulfilment are unchanged.
					</p>
				</li>
			))}
		</ul>
	);
}
