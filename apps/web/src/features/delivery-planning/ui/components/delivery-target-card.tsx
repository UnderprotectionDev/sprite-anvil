import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import { Badge } from "@sprite-anvil/ui/components/badge";
import { Button } from "@sprite-anvil/ui/components/button";
import { Link } from "@tanstack/react-router";
import { purposeLabels } from "../../lib/delivery-planning-labels";
import { DeliveryDraftReview } from "./delivery-draft-review";
import { DeliveryScopeDiff } from "./delivery-scope-diff";
import { DeliveryTargetScope } from "./delivery-target-scope";

export function DeliveryTargetCard({
	onNewRevision,
	projectId,
	target,
}: {
	onNewRevision: () => void;
	projectId: string;
	target: DeliveryTarget;
}) {
	const active = target.activeRevision;
	const pendingDrafts = target.drafts.filter(
		(draft) => draft.activatedRevisionId === null
	);
	const olderRevisions = [...target.revisions].sort(
		(a, b) => b.revisionNumber - a.revisionNumber
	);
	return (
		<article
			aria-label={target.name}
			className="space-y-4 rounded-lg border p-4"
		>
			<header className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="font-semibold text-lg">{target.name}</h2>
					<Badge variant="outline">{purposeLabels[target.purpose]}</Badge>
					<Badge variant={active ? "secondary" : "outline"}>
						{active
							? `Revision ${active.revisionNumber} active`
							: "Not activated"}
					</Badge>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button
						className="min-h-11"
						onClick={onNewRevision}
						type="button"
						variant="outline"
					>
						New revision
					</Button>
					{active ? (
						<Link
							className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
							params={{ projectId }}
							search={{ deliveryTargetId: target.id }}
							to="/projects/$projectId/readiness-plan"
						>
							Open Readiness Plan
						</Link>
					) : (
						<p className="text-muted-foreground text-sm">
							Activate a draft to get a Readiness Plan.
						</p>
					)}
				</div>
			</header>

			{pendingDrafts.map((draft) => (
				<DeliveryDraftReview
					draft={draft}
					key={draft.id}
					projectId={projectId}
				/>
			))}

			{active ? (
				<section className="space-y-3">
					<h3 className="font-medium">
						Active revision {active.revisionNumber}
					</h3>
					<DeliveryTargetScope scope={active} />
					{active.scopeDiff ? (
						<DeliveryScopeDiff diff={active.scopeDiff} />
					) : null}
				</section>
			) : null}

			{olderRevisions.length > 0 ? (
				<section className="space-y-2">
					<h3 className="font-medium">Revision history</h3>
					<ol aria-label="Revisions" className="space-y-2 text-sm">
						{olderRevisions.map((revision) => (
							<li key={revision.id}>
								Revision {revision.revisionNumber}, activated{" "}
								{new Date(revision.activatedAt).toLocaleString("en-US")}
								{revision.id !== active?.id && revision.scopeDiff ? (
									<DeliveryScopeDiff diff={revision.scopeDiff} />
								) : null}
							</li>
						))}
					</ol>
				</section>
			) : null}
		</article>
	);
}
