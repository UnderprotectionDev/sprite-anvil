import {
	type FulfilmentMappingDraft,
	summarizeMappingDraft,
} from "@sprite-anvil/api/delivery-fulfilment";
import {
	requirementStatusHints,
	requirementStatusLabels,
} from "../../lib/fulfilment-mapping-labels";
import { shortId } from "../../lib/short-id";

function RequirementRow({
	requirement,
}: {
	requirement: FulfilmentMappingDraft["requirements"][number];
}) {
	return (
		<li className="space-y-1 rounded border p-3">
			<p className="font-medium">
				{requirement.assetFamilyName}: {requirement.itemName}{" "}
				<span className="text-muted-foreground text-sm">
					({requirement.itemKind === "usage_test" ? "usage test" : "required"})
				</span>
			</p>
			<p>
				<strong>{requirementStatusLabels[requirement.status]}</strong>
				<span className="text-muted-foreground text-sm">
					{" "}
					{requirementStatusHints[requirement.status]}
				</span>
			</p>
			{requirement.candidates.length > 0 ? (
				<ul className="space-y-1 text-sm">
					{requirement.candidates.map((candidate) => (
						<li key={candidate.bundleId}>
							Export Bundle {shortId(candidate.bundleId)}
							{requirement.proposedBundleId === candidate.bundleId
								? " (proposed)"
								: ""}
							: Asset Versions {candidate.assetVersionIds.join(", ")}
						</li>
					))}
				</ul>
			) : null}
		</li>
	);
}

/** One persisted mapping draft, re-read from storage; it decides nothing for the user. */
export function FulfilmentMappingDraftPanel({
	draft,
}: {
	draft: FulfilmentMappingDraft;
}) {
	const summary = summarizeMappingDraft(draft);
	return (
		<section aria-label="Mapping draft" className="space-y-4">
			<div className="space-y-1">
				<h2 className="font-semibold text-lg">
					Mapping draft for revision {draft.revisionNumber}
				</h2>
				<p className="text-muted-foreground text-sm">
					Prepared {new Date(draft.createdAt).toLocaleString()}. A mapping draft
					is not a Delivery Fulfilment. Ready does not mean delivered.
				</p>
				<p>
					{summary.total} requirements: {summary.resolved} resolved,{" "}
					{summary.conflict} conflict, {summary.missing} missing.
				</p>
			</div>
			<ul className="space-y-2">
				{draft.requirements.map((requirement) => (
					<RequirementRow
						key={`${requirement.assetFamilyId}:${requirement.itemId}`}
						requirement={requirement}
					/>
				))}
			</ul>
			{draft.bundleChecks.length > 0 ? (
				<div className="space-y-2">
					<h3 className="font-medium">Runtime validation per Export Bundle</h3>
					<ul className="space-y-1 text-sm">
						{draft.bundleChecks.map((check) => (
							<li key={check.bundleId}>
								Export Bundle {shortId(check.bundleId)}: {(() => {
									if (!check.runtimeValidation.required) {
										return "this revision needs no runtime validation.";
									}
									return check.runtimeValidation.ready
										? "runtime validation satisfied."
										: "runtime validation not satisfied.";
								})()}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}
