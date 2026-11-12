import type { DeliveryTargetRevision } from "@sprite-anvil/api/delivery-planning-outputs";
import type { DeliveryTargetStore } from "@sprite-anvil/api/delivery-planning-store";
import type { ReadinessPlanStore } from "@sprite-anvil/api/readiness-plans";

/** Identifies one requirement of a revision across drafts, selections and Fulfilment rows. */
export function requirementKey(assetFamilyId: string, itemId: string) {
	return JSON.stringify([assetFamilyId, itemId]);
}

/** Orders records newest first; the id breaks a tie so the order is stable. */
export function newestFirst(
	left: { createdAt: Date; id: string },
	right: { createdAt: Date; id: string }
) {
	return (
		right.createdAt.getTime() - left.createdAt.getTime() ||
		right.id.localeCompare(left.id)
	);
}

/** The Delivery Target the user may read, or null when the project or target is not visible. */
export async function readDeliveryTarget(
	deliveryTargets: Pick<DeliveryTargetStore, "list">,
	userId: string,
	input: { deliveryTargetId: string; projectId: string }
) {
	const catalog = await deliveryTargets.list(userId, input.projectId);
	return (
		catalog?.deliveryTargets.find(
			(target) => target.id === input.deliveryTargetId
		) ?? null
	);
}

/** Whether the target is Ready for exactly this active revision, per its Readiness Plan. */
export async function isReadyForRevision(
	readinessPlans: Pick<ReadinessPlanStore, "get">,
	userId: string,
	input: { deliveryTargetId: string; projectId: string },
	revision: DeliveryTargetRevision
) {
	const plan = await readinessPlans.get(userId, input);
	return (
		plan?.status === "found" &&
		plan.plan.revisionId === revision.id &&
		plan.plan.targetReadiness === "ready"
	);
}
