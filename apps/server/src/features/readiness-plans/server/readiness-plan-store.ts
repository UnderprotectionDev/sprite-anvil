import type { DeliveredRevisionLookup } from "@sprite-anvil/api/delivery-fulfilment-records";
import type { DeliveryTargetRevision } from "@sprite-anvil/api/delivery-planning-outputs";
import type { DeliveryTargetStore } from "@sprite-anvil/api/delivery-planning-store";
import type { DependencyRevalidationStore } from "@sprite-anvil/api/dependency-revalidation";
import type { FamilyReadinessStore } from "@sprite-anvil/api/family-readiness";
import type {
	ReadinessPlanGetResult,
	ReadinessPlanReorderResult,
	ReadinessPlanStore,
} from "@sprite-anvil/api/readiness-plans";
import { buildReadinessPlan } from "./readiness-plan-builder";
import type { ReadinessPlanStorage } from "./readiness-plan-storage";

export interface ReadinessPlanStoreDependencies {
	deliveryTargets: DeliveryTargetStore;
	dependencies: DependencyRevalidationStore;
	familyReadiness: FamilyReadinessStore;
	/** Delivery Status reads only whether a Fulfilment exists for the revision. */
	fulfilments: DeliveredRevisionLookup;
	now?: () => Date;
	storage: ReadinessPlanStorage;
}

/**
 * Computes a Readiness Plan from the active Delivery Target revision and the
 * current readiness of its families. It only reads those features; the one
 * thing it writes is the user's ordering of the plan's work.
 */
export function createReadinessPlanStore(
	deps: ReadinessPlanStoreDependencies
): ReadinessPlanStore {
	const now = deps.now ?? (() => new Date());

	/** Null when the project or target is unavailable to the user. */
	async function readTarget(
		userId: string,
		input: { deliveryTargetId: string; projectId: string }
	) {
		const catalog = await deps.deliveryTargets.list(userId, input.projectId);
		return (
			catalog?.deliveryTargets.find(
				(target) => target.id === input.deliveryTargetId
			) ?? null
		);
	}

	/**
	 * A family whose readiness cannot be read is a blocker only while the user
	 * still has access to the project; once they have lost it, the whole read is
	 * unauthorized and returns null instead of a plan that hides the reason.
	 */
	async function readFamilies(
		userId: string,
		projectId: string,
		revision: DeliveryTargetRevision
	) {
		const families = await Promise.all(
			revision.families.map(
				async (family) =>
					[
						family.assetFamilyId,
						await deps.familyReadiness.list(
							userId,
							projectId,
							family.assetFamilyId
						),
					] as const
			)
		);
		const unreadable = families.some(([, readiness]) => readiness === null);
		if (unreadable && !(await deps.deliveryTargets.list(userId, projectId))) {
			return null;
		}
		return new Map(families);
	}

	/** Null when access to the project was lost while the plan was being read. */
	async function planFor(
		userId: string,
		projectId: string,
		target: { id: string },
		revision: DeliveryTargetRevision
	) {
		const [dependencies, savedOrder, familyReadiness, hasFulfilment] =
			await Promise.all([
				deps.dependencies.list(userId, projectId),
				deps.storage.findOrder(projectId, revision.id),
				readFamilies(userId, projectId, revision),
				deps.fulfilments.hasFulfilment(projectId, revision.id),
			]);
		// An unavailable dependency catalog is access lost, not an empty catalog.
		if (!(familyReadiness && dependencies)) {
			return null;
		}
		return buildReadinessPlan({
			deliveryTargetId: target.id,
			dependencies,
			familyReadiness,
			hasFulfilment,
			revision,
			savedOrder,
		});
	}

	return {
		async get(userId, input): Promise<ReadinessPlanGetResult | null> {
			const target = await readTarget(userId, input);
			if (!target) {
				return null;
			}
			if (!target.activeRevision) {
				return { status: "no_active_revision" };
			}
			const plan = await planFor(
				userId,
				input.projectId,
				target,
				target.activeRevision
			);
			return plan && { plan, status: "found" };
		},

		async reorder(userId, input): Promise<ReadinessPlanReorderResult | null> {
			const target = await readTarget(userId, input);
			if (!target) {
				return null;
			}
			const revision = target.activeRevision;
			if (!revision) {
				return { status: "no_active_revision" };
			}
			if (revision.id !== input.revisionId) {
				return { reason: "revision_not_active", status: "rejected" };
			}
			const current = await planFor(userId, input.projectId, target, revision);
			if (!current) {
				return null;
			}
			const known = new Set(current.workItems.map((work) => work.id));
			if (input.orderedWorkIds.some((id) => !known.has(id))) {
				return { reason: "work_not_in_plan", status: "rejected" };
			}
			if (input.orderedWorkIds.length !== known.size) {
				return { reason: "work_missing_from_order", status: "rejected" };
			}
			// The order was validated against a plan that may have gone stale while it
			// was computed, so the write itself only lands while this revision is
			// still the active one.
			const wasSaved = await deps.storage.saveOrder({
				deliveryTargetId: target.id,
				orderedWorkIds: input.orderedWorkIds,
				projectId: input.projectId,
				revisionId: revision.id,
				updatedAt: now(),
				updatedByUserId: userId,
			});
			if (!wasSaved) {
				return { reason: "revision_not_active", status: "rejected" };
			}
			const saved = await planFor(userId, input.projectId, target, revision);
			return saved && { plan: saved, status: "saved" };
		},
	};
}
