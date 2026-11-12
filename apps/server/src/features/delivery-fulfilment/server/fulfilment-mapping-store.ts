import {
	type FulfilmentMappingDraft,
	type FulfilmentMappingPrepareResult,
	type FulfilmentMappingStore,
	fulfilmentMappingDraftSchema,
} from "@sprite-anvil/api/delivery-fulfilment";
import { buildFulfilmentMapping } from "@sprite-anvil/api/delivery-fulfilment-mapping";
import type { DeliveryTargetStore } from "@sprite-anvil/api/delivery-planning-store";
import { exportBundleSha256 } from "@sprite-anvil/api/export-bundle-manifest";
import type { ExportBundleStore } from "@sprite-anvil/api/export-bundle-store";
import type { ReadinessPlanStore } from "@sprite-anvil/api/readiness-plans";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import type { RuntimeValidationRecord } from "@sprite-anvil/api/runtime-validation";
import type { RuntimeValidationStore } from "@sprite-anvil/api/runtime-validation-store";
import type {
	FulfilmentMappingStorage,
	StoredFulfilmentMappingDraft,
} from "./fulfilment-mapping-storage";
import {
	isReadyForRevision,
	newestFirst,
	readDeliveryTarget,
} from "./fulfilment-support";

export interface FulfilmentMappingStoreOptions {
	bundles: Pick<ExportBundleStore, "get" | "list">;
	deliveryTargets: Pick<DeliveryTargetStore, "list">;
	now?: () => Date;
	readinessPlans: Pick<ReadinessPlanStore, "get">;
	runtimeValidation: Pick<RuntimeValidationStore, "list">;
	storage: FulfilmentMappingStorage;
}

function toDraft(row: StoredFulfilmentMappingDraft): FulfilmentMappingDraft {
	return fulfilmentMappingDraftSchema.parse({
		bundleChecks: row.bundleChecks,
		createdAt: row.createdAt.toISOString(),
		deliveryTargetId: row.deliveryTargetId,
		id: row.id,
		projectId: row.projectId,
		requirements: row.requirements,
		revisionId: row.revisionId,
		revisionNumber: row.revisionNumber,
	});
}

/**
 * Prepares and re-reads mapping drafts. A draft is a system proposal from the
 * active Delivery Target revision and the bundles started for it; it holds no
 * user decision, never picks among conflicting bundles, and never makes the
 * target Delivered. Reads only the other features and writes only drafts.
 */
export function createFulfilmentMappingStore(
	options: FulfilmentMappingStoreOptions
): FulfilmentMappingStore {
	const { bundles, deliveryTargets, readinessPlans, runtimeValidation } =
		options;
	const { storage } = options;
	const now = options.now ?? (() => new Date());

	const readTarget = (
		userId: string,
		input: { deliveryTargetId: string; projectId: string }
	) => readDeliveryTarget(deliveryTargets, userId, input);

	return {
		async get(userId, input) {
			if (!(await deliveryTargets.list(userId, input.projectId))) {
				return null;
			}
			const row = await storage.findDraft(input.projectId, input.draftId);
			return row ? toDraft(row) : null;
		},
		async list(userId, input) {
			if (!(await readTarget(userId, input))) {
				return null;
			}
			const rows = await storage.listDrafts(
				input.projectId,
				input.deliveryTargetId
			);
			return {
				drafts: rows.sort(newestFirst).map(toDraft),
			};
		},
		async prepare(
			userId,
			input
		): Promise<FulfilmentMappingPrepareResult | null> {
			const target = await readTarget(userId, input);
			if (!target) {
				return null;
			}
			const id = await idempotentRecordId(
				{
					kind: "fulfilment-mapping-draft",
					projectId: input.projectId,
					targetId: input.deliveryTargetId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await exportBundleSha256(
				JSON.stringify({ deliveryTargetId: input.deliveryTargetId })
			);
			const replay =
				async (): Promise<FulfilmentMappingPrepareResult | null> => {
					const existing = await storage.findDraft(input.projectId, id);
					if (!existing) {
						return null;
					}
					if (existing.requestDigest !== requestDigest) {
						throw new IdempotencyConflictError("Fulfilment mapping draft");
					}
					return { draft: toDraft(existing), status: "replayed" };
				};
			// A retry replays the first draft even after the target moved on.
			const replayed = await replay();
			if (replayed) {
				return replayed;
			}
			const revision = target.activeRevision;
			if (!revision) {
				return { reason: "no_active_revision", status: "rejected" };
			}
			if (
				!(await isReadyForRevision(readinessPlans, userId, input, revision))
			) {
				return { reason: "target_not_ready", status: "rejected" };
			}

			const catalog = await bundles.list(userId, input.projectId);
			if (!catalog) {
				return null;
			}
			const forRevision = catalog.bundles.filter(
				(bundle) => bundle.deliveryTargetRevisionId === revision.id
			);
			const full = (
				await Promise.all(
					forRevision.map((bundle) =>
						bundles.get(userId, input.projectId, bundle.id)
					)
				)
			).filter((bundle) => bundle !== null);
			const recordsByBundleId = new Map<string, RuntimeValidationRecord[]>();
			await Promise.all(
				full.map(async (bundle) => {
					const list = await runtimeValidation.list(
						userId,
						input.projectId,
						bundle.id
					);
					recordsByBundleId.set(bundle.id, list?.records ?? []);
				})
			);
			const { bundleChecks, requirements } = buildFulfilmentMapping({
				bundles: full,
				recordsByBundleId,
				revision,
			});
			// An empty mapping would let a Fulfilment cover nothing, so none is proposed.
			if (requirements.length === 0) {
				return { reason: "no_requirements", status: "rejected" };
			}
			const inserted = await storage.insertDraft({
				bundleChecks,
				createdAt: now(),
				createdByUserId: userId,
				deliveryTargetId: input.deliveryTargetId,
				id,
				projectId: input.projectId,
				requestDigest,
				requirements,
				revisionId: revision.id,
				revisionNumber: revision.revisionNumber,
			});
			if (inserted.status === "conflict") {
				const winner = await replay();
				if (winner) {
					return winner;
				}
			}
			const stored = await storage.findDraft(input.projectId, id);
			if (!stored) {
				throw new RecordIntegrityError(
					"The fulfilment mapping draft could not be re-read from the persisted record."
				);
			}
			return { draft: toDraft(stored), status: "created" };
		},
	};
}
