import type {
	DeliveryTargetDraft,
	DeliveryTargetRevision,
} from "@sprite-anvil/api/delivery-planning-outputs";
import {
	itemKindLabels,
	productionRequirementLabels,
	rightsStateLabels,
	rightsSubjectLabels,
} from "../../lib/delivery-planning-labels";

type Scope = Pick<
	DeliveryTargetDraft,
	| "contextRevisionNumber"
	| "families"
	| "productionEvidencePolicy"
	| "rightsEvidencePolicy"
	| "runtimeValidationCriterion"
>;

/** The pinned scope as the user reviews it: Context Revision, per-family list revisions with usage tests, and both evidence policies. */
export function DeliveryTargetScope({ scope }: { scope: Scope }) {
	const production = scope.productionEvidencePolicy;
	const rights = scope.rightsEvidencePolicy;
	const familyName = new Map(
		scope.families.map((family) => [
			family.assetFamilyId,
			family.assetFamilyName,
		])
	);
	return (
		<div className="space-y-4">
			<p className="font-medium text-sm">
				Context Revision {scope.contextRevisionNumber}
			</p>
			<ul aria-label="Pinned Asset Families" className="space-y-3">
				{scope.families.map((family) => (
					<li
						className="space-y-2 rounded-md border p-3"
						key={family.assetFamilyId}
					>
						<p className="font-medium">{family.assetFamilyName}</p>
						<p className="text-muted-foreground text-sm">
							Required Items List revision {family.requiredSetRevisionNumber}
						</p>
						<ItemList items={family.requiredItems} label="Required items" />
						<ItemList items={family.usageTests} label="Usage tests" />
					</li>
				))}
			</ul>
			<div className="space-y-1 text-sm">
				<p className="font-medium">Production Evidence Policy</p>
				<p>
					Default: {productionRequirementLabels[production.defaultRequirement]}
				</p>
				{production.familyRequirements.map((entry) => (
					<p key={entry.assetFamilyId}>
						{familyName.get(entry.assetFamilyId) ?? entry.assetFamilyId}:{" "}
						{productionRequirementLabels[entry.requirement]}
					</p>
				))}
			</div>
			<div className="space-y-1 text-sm">
				<p className="font-medium">Rights Evidence Policy</p>
				<p>
					Acceptable states:{" "}
					{rights.acceptableStates
						.map((state) => rightsStateLabels[state])
						.join(", ")}
				</p>
				<p>
					Rights Records required for:{" "}
					{rights.requireRecordFor.length === 0
						? "nothing"
						: rights.requireRecordFor
								.map((subject) => rightsSubjectLabels[subject])
								.join(", ")}
				</p>
			</div>
			<div className="space-y-1 text-sm">
				<p className="font-medium">Runtime validation</p>
				{scope.runtimeValidationCriterion ? (
					<>
						<p>
							Ready only through a current Pass you finalized for the exact
							Export Bundle in each required environment.
						</p>
						<ul aria-label="Required environments" className="space-y-1">
							{scope.runtimeValidationCriterion.environments.map(
								(environment) => (
									<li
										key={`${environment.gameBuild}|${environment.engineVersion}|${environment.adapterVersion ?? ""}`}
									>
										{environment.gameBuild} on {environment.engineVersion}
										{environment.adapterVersion
											? `, adapter ${environment.adapterVersion}`
											: ""}
									</li>
								)
							)}
						</ul>
					</>
				) : (
					<p>Not required.</p>
				)}
			</div>
		</div>
	);
}

function ItemList({
	items,
	label,
}: {
	items: DeliveryTargetRevision["families"][number]["requiredItems"];
	label: string;
}) {
	if (items.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">No {label.toLowerCase()}.</p>
		);
	}
	return (
		<ul aria-label={label} className="space-y-1 text-sm">
			{items.map((item) => (
				<li key={item.id}>
					<span>{item.name}</span>{" "}
					<span className="text-muted-foreground">
						({itemKindLabels[item.kind] ?? item.kind}, {item.disposition})
					</span>
				</li>
			))}
		</ul>
	);
}
