import type {
	DeliveryFulfilment,
	DeliveryFulfilmentStore,
} from "@sprite-anvil/api/delivery-fulfilment-records";
import type { RightsEvidencePolicy } from "@sprite-anvil/api/delivery-planning-inputs";
import type {
	DeliveryTarget,
	DeliveryTargetRevision,
} from "@sprite-anvil/api/delivery-planning-outputs";
import type { DeliveryTargetStore } from "@sprite-anvil/api/delivery-planning-store";
import type { ExportBundleStore } from "@sprite-anvil/api/export-bundle-store";
import type {
	HistoricalRiskAffectedUsage,
	HistoricalRiskNotice,
	HistoricalRiskNoticeStore,
} from "@sprite-anvil/api/historical-risk-notices";
import { historicalRiskNoticeViewSchema } from "@sprite-anvil/api/historical-risk-notices";
import {
	idempotentRecordId,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import type {
	RightsRecord,
	RightsRecordState,
	RightsRecordStore,
} from "@sprite-anvil/api/rights-records";
import type {
	HistoricalRiskNoticeStorage,
	StoredHistoricalRiskNotice,
} from "./historical-risk-notice-storage";

export interface HistoricalRiskNoticeStoreOptions {
	bundles: Pick<ExportBundleStore, "get">;
	deliveryTargets: Pick<DeliveryTargetStore, "list">;
	fulfilments: Pick<DeliveryFulfilmentStore, "list">;
	now?: () => Date;
	rights: Pick<RightsRecordStore, "list">;
	storage: HistoricalRiskNoticeStorage;
}

/** Whether a Rights Evidence Policy accepts the user-declared state of a result's Rights Record. */
function acceptsResultState(
	policy: RightsEvidencePolicy,
	state: RightsRecordState
) {
	return (
		!policy.requireRecordFor.includes("results") ||
		policy.acceptableStates.includes(state)
	);
}

function currentPolicyOf(target: DeliveryTarget, state: RightsRecordState) {
	const active: DeliveryTargetRevision | null = target.activeRevision;
	return active
		? {
				accepted: acceptsResultState(active.rightsEvidencePolicy, state),
				revisionId: active.id,
				revisionNumber: active.revisionNumber,
			}
		: null;
}

function toView(
	row: StoredHistoricalRiskNotice,
	target: DeliveryTarget | undefined
): HistoricalRiskNotice {
	return historicalRiskNoticeViewSchema.parse({
		...row,
		currentPolicy: target
			? currentPolicyOf(target, row.rightsRecordState)
			: null,
		detectedAt: row.detectedAt.toISOString(),
	});
}

/**
 * Records and re-reads Historical Risk Notices. A notice is written only when a
 * new result-level Rights Record revision is not accepted by the policy that a
 * past Delivery Fulfilment's revision pinned. It never touches the Fulfilment,
 * its bundles or any Rights Record, states no legal conclusion, revokes nothing,
 * and is never changed once written; the current policy is only read beside it.
 */
export function createHistoricalRiskNoticeStore(
	options: HistoricalRiskNoticeStoreOptions
): HistoricalRiskNoticeStore {
	const { bundles, deliveryTargets, fulfilments, rights, storage } = options;
	const now = options.now ?? (() => new Date());

	/** The affected usage and pinned rights of the Fulfilment's bundles for one Asset Record. */
	async function readPins(
		userId: string,
		fulfilment: DeliveryFulfilment,
		assetRecordId: string
	) {
		const affectedUsage: HistoricalRiskAffectedUsage[] = [];
		let pinnedRights: StoredHistoricalRiskNotice["pinnedRights"] = null;
		const manifests = await Promise.all(
			fulfilment.requirements.map(async (requirement) => {
				const bundle = await bundles.get(
					userId,
					fulfilment.projectId,
					requirement.bundleId
				);
				if (!bundle) {
					throw new RecordIntegrityError(
						"A Delivery Fulfilment's Export Bundle could not be re-read."
					);
				}
				return bundle.manifest;
			})
		);
		for (const [index, requirement] of fulfilment.requirements.entries()) {
			const { files, rightsEvidence } = manifests[
				index
			] as (typeof manifests)[number];
			const pinsRecord = files.some(
				(file) =>
					file.assetRecordId === assetRecordId &&
					file.assetFamilyId === requirement.assetFamilyId &&
					file.itemId === requirement.itemId
			);
			if (!pinsRecord) {
				continue;
			}
			affectedUsage.push({
				assetFamilyId: requirement.assetFamilyId,
				assetFamilyName: requirement.assetFamilyName,
				bundleId: requirement.bundleId,
				itemId: requirement.itemId,
				itemName: requirement.itemName,
			});
			const pinned = rightsEvidence.find(
				(entry) => entry.assetRecordId === assetRecordId
			);
			if (pinned && !pinnedRights) {
				pinnedRights = {
					rightsRecordId: pinned.rightsRecordId,
					state: pinned.state,
					versionNumber: pinned.versionNumber,
				};
			}
		}
		return { affectedUsage, pinnedRights };
	}

	async function record(
		userId: string,
		target: DeliveryTarget,
		fulfilment: DeliveryFulfilment,
		rightsRecord: RightsRecord
	): Promise<HistoricalRiskNotice | null> {
		const pinnedPolicy = target.revisions.find(
			(entry) => entry.id === fulfilment.revisionId
		)?.rightsEvidencePolicy;
		if (!pinnedPolicy || acceptsResultState(pinnedPolicy, rightsRecord.state)) {
			return null;
		}
		const findNotice = () =>
			storage.findNotice(fulfilment.projectId, fulfilment.id, rightsRecord.id);
		const existing = await findNotice();
		if (existing) {
			return toView(existing, target);
		}
		const { affectedUsage, pinnedRights } = await readPins(
			userId,
			fulfilment,
			rightsRecord.assetRecordId
		);
		// A revision that is not newer than the pinned one is not new risk, and an unpinned Asset Record is not used.
		if (
			affectedUsage.length === 0 ||
			(pinnedRights && pinnedRights.versionNumber >= rightsRecord.versionNumber)
		) {
			return null;
		}
		const notice: StoredHistoricalRiskNotice = {
			affectedUsage,
			assetRecordId: rightsRecord.assetRecordId,
			deliveryTargetId: fulfilment.deliveryTargetId,
			detectedAt: now(),
			fulfilmentId: fulfilment.id,
			id: await idempotentRecordId(
				{
					kind: "historical-risk-notice",
					projectId: fulfilment.projectId,
					targetId: fulfilment.id,
					userId: "product",
				},
				rightsRecord.id
			),
			pinnedPolicy,
			pinnedRights,
			projectId: fulfilment.projectId,
			revisionId: fulfilment.revisionId,
			revisionNumber: fulfilment.revisionNumber,
			rightsRecordId: rightsRecord.id,
			rightsRecordState: rightsRecord.state,
			rightsRecordVersionNumber: rightsRecord.versionNumber,
		};
		const inserted = await storage.insertNotice(notice);
		const stored = inserted.status === "inserted" ? notice : await findNotice();
		if (!stored) {
			throw new RecordIntegrityError(
				"The historical risk notice could not be re-read from the persisted record."
			);
		}
		return toView(stored, target);
	}

	return {
		async detect(userId, input) {
			const catalog = await deliveryTargets.list(userId, input.projectId);
			const history = await rights.list(
				userId,
				input.projectId,
				input.assetRecordId,
				null
			);
			const rightsRecord = history?.find(
				(entry) => entry.id === input.rightsRecordId
			);
			if (!(catalog && rightsRecord)) {
				return null;
			}
			const perTarget = await Promise.all(
				catalog.deliveryTargets.map(async (target) => {
					const listed = await fulfilments.list(userId, {
						deliveryTargetId: target.id,
						projectId: input.projectId,
					});
					return Promise.all(
						(listed?.fulfilments ?? []).map((fulfilment) =>
							record(userId, target, fulfilment, rightsRecord)
						)
					);
				})
			);
			const notices = perTarget
				.flat()
				.filter((notice): notice is HistoricalRiskNotice => notice !== null);
			return { notices };
		},
		async list(userId, input) {
			const catalog = await deliveryTargets.list(userId, input.projectId);
			const target = catalog?.deliveryTargets.find(
				(entry) => entry.id === input.deliveryTargetId
			);
			if (!target) {
				return null;
			}
			const rows = await storage.listNotices(
				input.projectId,
				input.deliveryTargetId
			);
			return {
				notices: [...rows]
					.sort(
						(left, right) =>
							right.detectedAt.getTime() - left.detectedAt.getTime() ||
							right.id.localeCompare(left.id)
					)
					.map((row) => toView(row, target)),
			};
		},
	};
}
