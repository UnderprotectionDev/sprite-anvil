import type { ReadinessWorkItem } from "@sprite-anvil/api/readiness-plans";
import { Button } from "@sprite-anvil/ui/components/button";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
	plural,
	targetRequirementSourceLabels,
} from "../../lib/readiness-plan-labels";

function Rationale({
	children,
	term,
}: {
	children: React.ReactNode;
	term: string;
}) {
	return (
		<div className="space-y-0.5">
			<dt className="font-medium text-sm">{term}</dt>
			<dd className="text-muted-foreground text-sm">{children}</dd>
		</div>
	);
}

function titlesOf(ids: string[], titleById: Map<string, string>) {
	return ids.map((id) => titleById.get(id) ?? id).join(", ");
}

export function ReadinessWorkItemCard({
	canMoveDown,
	canMoveUp,
	disabled,
	item,
	onMove,
	titleById,
}: {
	canMoveDown: boolean;
	canMoveUp: boolean;
	disabled: boolean;
	item: ReadinessWorkItem;
	onMove: (offset: -1 | 1) => void;
	titleById: Map<string, string>;
}) {
	const { revalidationImpact, targetRequirement, unlocksDependentWork } =
		item.rationales;
	const { userPriority } = item.rationales;
	return (
		<li className="space-y-3 rounded-md border p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="text-muted-foreground text-xs">Step {item.position}</p>
					<h4 className="break-words font-medium">{item.title}</h4>
					{item.dependsOnWorkIds.length > 0 ? (
						<p className="text-muted-foreground text-sm">
							Waits for: {titlesOf(item.dependsOnWorkIds, titleById)}
						</p>
					) : null}
				</div>
				<div className="flex gap-1">
					<Button
						aria-label={`Move ${item.title} up`}
						className="min-h-11 min-w-11"
						disabled={disabled || !canMoveUp}
						onClick={() => onMove(-1)}
						size="icon"
						type="button"
						variant="outline"
					>
						<ArrowUp aria-hidden="true" />
					</Button>
					<Button
						aria-label={`Move ${item.title} down`}
						className="min-h-11 min-w-11"
						disabled={disabled || !canMoveDown}
						onClick={() => onMove(1)}
						size="icon"
						type="button"
						variant="outline"
					>
						<ArrowDown aria-hidden="true" />
					</Button>
				</div>
			</div>
			<dl className="grid gap-3 sm:grid-cols-2">
				<Rationale term="Target requirement">
					{targetRequirementSourceLabels[targetRequirement.source]}
					{targetRequirement.requiredSetRevisionNumber === null
						? ""
						: `, revision ${targetRequirement.requiredSetRevisionNumber}`}
				</Rationale>
				<Rationale term="Work opened">
					{unlocksDependentWork.count === 0
						? "Opens no further work."
						: `Unlocks ${plural(unlocksDependentWork.count, "dependent work item")}${
								item.opensWorkIds.length > 0
									? `: ${titlesOf(item.opensWorkIds, titleById)}`
									: ""
							}.`}
				</Rationale>
				<Rationale term="User priority">
					{item.orderSource === "user" && userPriority.position !== null
						? `Ordered by you at position ${userPriority.position}`
						: "Not set by you; suggested order"}
				</Rationale>
				<Rationale term="Revalidation impact">
					{plural(revalidationImpact.requiredNowVersionIds.length, "version")}{" "}
					waiting for revalidation;{" "}
					{plural(
						revalidationImpact.derivativeVersionIds.length,
						"derivative version"
					)}{" "}
					at risk.
				</Rationale>
			</dl>
		</li>
	);
}
