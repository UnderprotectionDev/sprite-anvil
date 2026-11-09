import type { DeliveryTargetScopeDiff } from "@sprite-anvil/api/delivery-planning-outputs";

function changed(label: string, didChange: boolean) {
	return `${label} ${didChange ? "changed" : "unchanged"}`;
}

/** What this revision's base changed against the previous revision; the previous revision itself stays as it was. */
export function DeliveryScopeDiff({ diff }: { diff: DeliveryTargetScopeDiff }) {
	return (
		<section
			aria-label={`Scope diff against revision ${diff.previousRevisionNumber}`}
			className="space-y-2 rounded-md border p-3 text-sm"
		>
			<h4 className="font-medium">
				Scope diff against revision {diff.previousRevisionNumber}
			</h4>
			<p>
				{diff.contextChange
					? `Context Revision ${diff.contextChange.fromRevisionNumber} to ${diff.contextChange.toRevisionNumber}`
					: "Context Revision unchanged"}
			</p>
			{diff.familiesAdded.length > 0 ? (
				<p>
					Asset Families added:{" "}
					{diff.familiesAdded
						.map((family) => family.assetFamilyName)
						.join(", ")}
				</p>
			) : null}
			{diff.familiesRemoved.length > 0 ? (
				<p>
					Asset Families removed:{" "}
					{diff.familiesRemoved
						.map((family) => family.assetFamilyName)
						.join(", ")}
				</p>
			) : null}
			{diff.requiredSetChanges.map((change) => (
				<div className="space-y-1" key={change.assetFamilyId}>
					<p>
						{change.assetFamilyName}: Required Items List revision{" "}
						{change.fromRevisionNumber} to {change.toRevisionNumber}
					</p>
					{change.itemsAdded.length > 0 ? (
						<p className="text-muted-foreground">
							Items added:{" "}
							{change.itemsAdded.map((item) => item.name).join(", ")}
						</p>
					) : null}
					{change.itemsRemoved.length > 0 ? (
						<p className="text-muted-foreground">
							Items removed:{" "}
							{change.itemsRemoved.map((item) => item.name).join(", ")}
						</p>
					) : null}
				</div>
			))}
			<p>
				{changed(
					"Production Evidence Policy",
					diff.productionEvidencePolicyChanged
				)}
			</p>
			<p>
				{changed("Rights Evidence Policy", diff.rightsEvidencePolicyChanged)}
			</p>
		</section>
	);
}
