import type { DeliveryFulfilment } from "@sprite-anvil/api/delivery-fulfilment-records";
import { shortId } from "../../lib/fulfilment-mapping-labels";

/** The immutable Delivery Fulfilments of a target, newest first; the first of a revision is current and the rest stay as history. */
export function DeliveryFulfilmentList({
	fulfilments,
}: {
	fulfilments: DeliveryFulfilment[];
}) {
	if (fulfilments.length === 0) {
		return (
			<p className="text-muted-foreground">
				No Delivery Fulfilment exists for this Delivery Target yet. A Ready
				target is not delivered until you finalize one.
			</p>
		);
	}
	return (
		<ul className="space-y-3">
			{fulfilments.map((fulfilment) => (
				<li className="space-y-1 rounded border p-3" key={fulfilment.id}>
					<p className="font-medium">
						{fulfilment.isCurrent ? "Current Fulfilment" : "Earlier Fulfilment"}
					</p>
					<p className="text-muted-foreground text-sm">
						Revision {fulfilment.revisionNumber}, created{" "}
						{new Date(fulfilment.createdAt).toLocaleString()}. Fulfilments never
						change; a new one for the same revision becomes current.
					</p>
					<ul className="space-y-1 text-sm">
						{fulfilment.requirements.map((requirement) => (
							<li key={`${requirement.assetFamilyId}:${requirement.itemId}`}>
								{requirement.assetFamilyName}: {requirement.itemName} · Export
								Bundle {shortId(requirement.bundleId)} · Asset Versions{" "}
								{requirement.assetVersionIds.join(", ")}
							</li>
						))}
					</ul>
				</li>
			))}
		</ul>
	);
}
