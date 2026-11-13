import type { ReadinessPlan } from "@sprite-anvil/api/readiness-plans";
import { Badge } from "@sprite-anvil/ui/components/badge";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { errorCodeOf } from "@/utils/error-code";
import { useReorderReadinessPlan } from "../../hooks/use-reorder-readiness-plan";
import {
	blockerKindLabels,
	deliveryStatusLabels,
	moveWorkId,
	requirementKindLabels,
	targetReadinessLabels,
} from "../../lib/readiness-plan-labels";
import { ReadinessWorkItemCard } from "./readiness-work-item";

const reorderFailureMessages: Record<string, string> = {
	CONFLICT: "The order was not saved because the plan changed.",
	NOT_FOUND: "This Delivery Target was not found, so the order was not saved.",
};

function BlockerList({ plan }: { plan: ReadinessPlan }) {
	if (plan.blockers.length === 0) {
		return <p className="text-muted-foreground">No blockers.</p>;
	}
	return (
		<ul aria-label="Blockers" className="space-y-3">
			{plan.blockers.map((blocker) => (
				<li className="space-y-2 rounded-md border p-4" key={blocker.id}>
					<p className="text-muted-foreground text-xs">
						{blockerKindLabels[blocker.kind]}
					</p>
					<p className="break-words font-medium">
						{blocker.itemName ?? "Whole target"}
					</p>
					{blocker.assetFamilyName ? (
						<p className="text-muted-foreground text-sm">
							Asset Family: {blocker.assetFamilyName}
						</p>
					) : null}
					{blocker.unmetRequirements.length > 0 ? (
						<ul aria-label="Unmet evidence" className="space-y-1 text-sm">
							{blocker.unmetRequirements.map((requirement) => (
								<li key={requirement.id}>
									{requirementKindLabels[requirement.kind]}: {requirement.name}{" "}
									({requirement.result}
									{requirement.isCurrent ? "" : ", not current"})
								</li>
							))}
						</ul>
					) : null}
				</li>
			))}
		</ul>
	);
}

export function ReadinessPlanPanel({
	onReload,
	plan,
	projectId,
}: {
	onReload: () => void;
	plan: ReadinessPlan;
	projectId: string;
}) {
	const reorder = useReorderReadinessPlan();
	const [failure, setFailure] = useState<string | null>(null);
	const workIds = plan.workItems.map((item) => item.id);
	const titleById = new Map(
		plan.workItems.map((item) => [item.id, item.title])
	);
	const recommended = plan.recommendedNext
		? plan.workItems.find((item) => item.id === plan.recommendedNext?.workId)
		: undefined;

	const move = (index: number, offset: -1 | 1) => {
		const orderedWorkIds = moveWorkId(workIds, index, offset);
		if (!orderedWorkIds) {
			return;
		}
		setFailure(null);
		reorder.mutate(
			{
				deliveryTargetId: plan.deliveryTargetId,
				orderedWorkIds,
				projectId,
				revisionId: plan.revisionId,
			},
			{
				onError: (error) =>
					setFailure(
						reorderFailureMessages[errorCodeOf(error) ?? ""] ??
							"The order could not be saved. Try again."
					),
			}
		);
	};

	return (
		<div className="space-y-8">
			<section aria-labelledby="readiness-summary" className="space-y-2">
				<h2 className="sr-only" id="readiness-summary">
					Summary
				</h2>
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-semibold text-lg">
						Target Readiness: {targetReadinessLabels[plan.targetReadiness]}
					</p>
					<Badge variant="outline">Revision {plan.revisionNumber}</Badge>
				</div>
				<p className="font-medium">
					Delivery Status: {deliveryStatusLabels[plan.deliveryStatus]}
				</p>
				<p className="text-muted-foreground text-sm">
					{plan.deliveryStatus === "delivered"
						? "A Delivery Fulfilment exists for this revision. Delivery Status is separate from Target Readiness."
						: "Ready does not mean delivered. Delivery needs a Delivery Fulfilment, which this plan never creates."}
				</p>
			</section>

			{recommended ? (
				<section
					aria-labelledby="suggested-next"
					className="space-y-1 rounded-md border p-4"
				>
					<h2 className="font-medium" id="suggested-next">
						Suggested next step
					</h2>
					<p className="break-words">{recommended.title}</p>
					<p className="text-muted-foreground text-sm">
						{plan.recommendedNext?.basis === "user_order"
							? "Based on your order."
							: "Based on the suggested order."}{" "}
						This is a suggestion only. Nothing starts automatically.
					</p>
				</section>
			) : null}

			<section aria-labelledby="blockers-heading" className="space-y-3">
				<h2 className="font-medium text-lg" id="blockers-heading">
					Blockers
				</h2>
				<BlockerList plan={plan} />
			</section>

			<section aria-labelledby="work-heading" className="space-y-3">
				<h2 className="font-medium text-lg" id="work-heading">
					Dependent work
				</h2>
				<p className="text-muted-foreground text-sm">
					Steps are in the order shown. Use the move buttons to change the
					order; your order is kept and does not change readiness.
				</p>
				{failure ? (
					<div className="space-y-2">
						<StatusMessage tone="error">{failure}</StatusMessage>
						<Button
							className="min-h-11"
							onClick={() => {
								setFailure(null);
								onReload();
							}}
							type="button"
							variant="outline"
						>
							Reload plan
						</Button>
					</div>
				) : null}
				{plan.orderWarnings.length > 0 ? (
					<ul aria-label="Order warnings" className="space-y-1 text-sm">
						{plan.orderWarnings.map((warning) => (
							<li key={`${warning.workId}:${warning.prerequisiteWorkId}`}>
								{titleById.get(warning.workId) ?? warning.workId} is ordered
								before{" "}
								{titleById.get(warning.prerequisiteWorkId) ??
									warning.prerequisiteWorkId}
								, which it waits for. Your order stands.
							</li>
						))}
					</ul>
				) : null}
				{plan.workItems.length === 0 ? (
					<p className="text-muted-foreground">No dependent work.</p>
				) : (
					<ol aria-label="Dependent work" className="space-y-3">
						{plan.workItems.map((item, index) => (
							<ReadinessWorkItemCard
								canMoveDown={index < plan.workItems.length - 1}
								canMoveUp={index > 0}
								disabled={reorder.isPending}
								item={item}
								key={item.id}
								onMove={(offset) => move(index, offset)}
								titleById={titleById}
							/>
						))}
					</ol>
				)}
			</section>
		</div>
	);
}
