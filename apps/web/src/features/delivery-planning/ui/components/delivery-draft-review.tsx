import type { DeliveryTargetDraft } from "@sprite-anvil/api/delivery-planning-outputs";
import { Button } from "@sprite-anvil/ui/components/button";
import { StatusMessage } from "@/components/status-message";
import { errorCodeOf } from "@/utils/error-code";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";
import { useActivateDeliveryTarget } from "../../hooks/use-delivery-target-writes";
import { DeliveryTargetScope } from "./delivery-target-scope";

const activationFailures: Record<string, string> = {
	CONFLICT: "The revision number was taken repeatedly. Try activating again.",
	NOT_FOUND: "This draft was not found. Reload the Delivery Targets.",
};

function activationFailure(error: unknown) {
	return isWriteOutcomeUncertain(error)
		? "The activation result could not be confirmed. Retry the same revision."
		: (activationFailures[errorCodeOf(error) ?? ""] ??
				"The revision could not be activated. Try again.");
}

/** A draft shown for review; only the user's Activate revision turns it into a revision. */
export function DeliveryDraftReview({
	draft,
	projectId,
}: {
	draft: DeliveryTargetDraft;
	projectId: string;
}) {
	const activate = useActivateDeliveryTarget(projectId);
	const activationKey = usePendingIdempotencyKey();
	const failure = activate.isError ? activationFailure(activate.error) : null;

	const onActivate = () => {
		activate.mutate(
			{
				draftId: draft.id,
				id: activationKey.keyFor(JSON.stringify([projectId, draft.id])),
				projectId,
			},
			{
				onError: (error) => {
					if (!isWriteOutcomeUncertain(error)) {
						activationKey.clear();
					}
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
			{failure ? <StatusMessage tone="error">{failure}</StatusMessage> : null}
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
