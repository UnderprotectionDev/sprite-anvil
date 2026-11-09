import type { DeliveryTargetDraft } from "@sprite-anvil/api/delivery-planning-outputs";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { errorCodeOf } from "@/utils/error-code";
import { useActivateDeliveryTarget } from "../../hooks/use-delivery-target-writes";
import { DeliveryTargetScope } from "./delivery-target-scope";

const activationFailures: Record<string, string> = {
	CONFLICT: "The revision number was taken repeatedly. Try activating again.",
	NOT_FOUND: "This draft was not found. Reload the Delivery Targets.",
};

/** A draft shown for review; only the user's Activate revision turns it into a revision. */
export function DeliveryDraftReview({
	draft,
	projectId,
}: {
	draft: DeliveryTargetDraft;
	projectId: string;
}) {
	const activate = useActivateDeliveryTarget(projectId);
	const [failure, setFailure] = useState<string | null>(null);
	// Keeps a retry after an uncertain outcome idempotent for this draft.
	const [revisionId, setRevisionId] = useState(() => crypto.randomUUID());

	const onActivate = () => {
		setFailure(null);
		activate.mutate(
			{ draftId: draft.id, id: revisionId, projectId },
			{
				onError: (error) => {
					const code = errorCodeOf(error);
					if (code) {
						setRevisionId(crypto.randomUUID());
					}
					setFailure(
						activationFailures[code ?? ""] ??
							"The revision could not be activated. Try again."
					);
				},
			}
		);
	};

	return (
		<section
			aria-label="Draft review"
			className="space-y-3 rounded-md border border-dashed p-4"
		>
			<h3 className="font-medium">
				Draft saved {new Date(draft.createdAt).toLocaleString("en-US")}
			</h3>
			<DeliveryTargetScope scope={draft} />
			<p className="text-muted-foreground text-sm">
				Target Readiness does not change until a revision is activated, and no
				family's Required Items List is replaced.
			</p>
			{failure ? (
				<p className="text-destructive text-sm" role="alert">
					{failure}
				</p>
			) : null}
			<Button
				className="min-h-11"
				disabled={activate.isPending}
				onClick={onActivate}
				type="button"
			>
				{activate.isPending ? "Activating…" : "Activate revision"}
			</Button>
		</section>
	);
}
