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

	async function planFor(
		userId: string,
		projectId: string,
		deliveryTargetId: string,
		revision: DeliveryTargetRevision
	) {
		const [dependencies, savedOrder, families] = await Promise.all([
			deps.dependencies.list(userId, projectId),
			deps.storage.findOrder(projectId, revision.id),
			Promise.all(
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
			),
		]);
		return buildReadinessPlan({
			deliveryTargetId,
			dependencies: dependencies ?? {
				dependencyLinks: [],
				revalidationRequiredVersionIds: [],
			},
			familyReadiness: new Map(families),
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
			return {
				plan: await planFor(
					userId,
					input.projectId,
					target.id,
					target.activeRevision
				),
				status: "found",
			};
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
			const current = await planFor(
				userId,
				input.projectId,
				target.id,
				revision
			);
			const known = new Set(current.workItems.map((work) => work.id));
			if (input.orderedWorkIds.some((id) => !known.has(id))) {
				return { reason: "work_not_in_plan", status: "rejected" };
			}
			if (input.orderedWorkIds.length !== known.size) {
				return { reason: "work_missing_from_order", status: "rejected" };
			}
			await deps.storage.saveOrder({
				orderedWorkIds: input.orderedWorkIds,
				projectId: input.projectId,
				revisionId: revision.id,
				updatedAt: now(),
				updatedByUserId: userId,
			});
			return {
				plan: await planFor(userId, input.projectId, target.id, revision),
				status: "saved",
			};
		},
	};
}
