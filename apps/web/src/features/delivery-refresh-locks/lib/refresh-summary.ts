import type { DeliveryRefreshPlan } from "@sprite-anvil/api/delivery-refresh-classification";

/** One sentence on what the plan allows; a halted or partial plan is never a completed delivery. */
export function refreshSummary(plan: DeliveryRefreshPlan): string {
	if (plan.outcome === "halted") {
		return `Refresh halted: ${plan.halted.length} diverged ${plan.halted.length === 1 ? "path waits" : "paths wait"} for your decision. Nothing is written for them.`;
	}
	if (plan.outcome === "partial") {
		return `Partial refresh: ${plan.applied.length} paths will be written and ${plan.held.length} kept out. This is not a completed delivery.`;
	}
	return `Ready: ${plan.applied.length} paths will be written and no divergence waits.`;
}
