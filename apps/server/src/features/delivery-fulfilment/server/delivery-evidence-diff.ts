import type {
	DeliveryEvidencePin,
	DeliveryEvidenceSection,
	NotRecordedSectionKey,
} from "@sprite-anvil/api/delivery-diff";
import type { ExportBundleStore } from "@sprite-anvil/api/export-bundle-store";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import { deriveRuntimeValidationState } from "@sprite-anvil/api/runtime-validation-decisions";
import type { RuntimeValidationStore } from "@sprite-anvil/api/runtime-validation-store";
import type { StoredDeliveryFulfilment } from "./delivery-fulfilment-storage";

export interface DeliveryEvidenceDependencies {
	bundles: Pick<ExportBundleStore, "get">;
	runtimeValidation?: Pick<RuntimeValidationStore, "list">;
}
type Snapshot = Record<NotRecordedSectionKey, DeliveryEvidencePin[] | null>;
const keys: NotRecordedSectionKey[] = [
	"qualityEvidence",
	"qualityWaiver",
	"rights",
	"runtimeEvidence",
];
const emptySnapshot = (): Snapshot => ({
	qualityEvidence: [],
	qualityWaiver: [],
	rights: [],
	runtimeEvidence: [],
});
const pin = async (
	key: string,
	label: string,
	value: unknown
): Promise<DeliveryEvidencePin> => ({
	key,
	label,
	contentDigest: await recordContentDigest(value),
});

async function runtimePins(
	deps: DeliveryEvidenceDependencies,
	userId: string,
	fulfilment: StoredDeliveryFulfilment,
	bundleId: string,
	digest: string
) {
	const listed = await deps.runtimeValidation?.list(
		userId,
		fulfilment.projectId,
		bundleId
	);
	if (!listed) {
		return null;
	}
	const cutoff = fulfilment.createdAt.getTime();
	return Promise.all(
		listed.records
			.filter(
				(r) =>
					r.projectId === fulfilment.projectId &&
					r.bundleId === bundleId &&
					r.manifestDigest === digest &&
					Date.parse(r.createdAt) <= cutoff
			)
			.map((r) => {
				const decisions = r.decisions.filter(
					(d) => Date.parse(d.createdAt) <= cutoff
				);
				const evidence = r.evidence.filter(
					(e) => Date.parse(e.createdAt) <= cutoff
				);
				const state = deriveRuntimeValidationState(decisions);
				return pin(
					r.id,
					`Runtime Validation ${r.id}: ${state.outcome ?? "not finalized"}`,
					{ ...r, ...state, decisions, evidence }
				);
			})
	);
}

/** Immutable manifests plus time-bounded append-only runtime events; never today's mutable outcome. */
export async function readDeliveryEvidence(
	deps: DeliveryEvidenceDependencies,
	userId: string,
	fulfilment: StoredDeliveryFulfilment
): Promise<Snapshot> {
	const pins = [
		...new Map(fulfilment.requirements.map((r) => [r.bundleId, r])).values(),
	];
	const groups = await Promise.all(
		pins.map(async (requirement) => {
			const bundle = await deps.bundles.get(
				userId,
				fulfilment.projectId,
				requirement.bundleId
			);
			if (!bundle || bundle.manifestDigest !== requirement.manifestDigest) {
				return null;
			}
			const { manifest } = bundle;
			const [qualityEvidence, qualityWaiver, rights, runtimeEvidence] =
				await Promise.all([
					Promise.all(
						manifest.qualityEvidence.map((e) =>
							pin(
								e.evidenceId,
								`Quality evidence ${e.evidenceId}: ${e.result}`,
								e
							)
						)
					),
					Promise.all(
						manifest.waivers.map((e) =>
							pin(e.evidenceId, `Quality Waiver ${e.evidenceId}`, e)
						)
					),
					Promise.all(
						manifest.rightsEvidence.map((e) =>
							pin(
								`${e.assetRecordId}:${e.rightsRecordId}`,
								`Rights Record ${e.rightsRecordId}: ${e.state} (revision ${e.versionNumber})`,
								e
							)
						)
					),
					runtimePins(
						deps,
						userId,
						fulfilment,
						bundle.id,
						bundle.manifestDigest
					),
				]);
			return { qualityEvidence, qualityWaiver, rights, runtimeEvidence };
		})
	);
	if (groups.some((g) => !g)) {
		return {
			qualityEvidence: null,
			qualityWaiver: null,
			rights: null,
			runtimeEvidence: null,
		};
	}
	const result = emptySnapshot();
	for (const key of keys) {
		const values = groups.map((g) => g?.[key] ?? null);
		result[key] = values.some((v) => v === null)
			? null
			: [
					...new Map(
						values
							.flatMap((v) => v ?? [])
							.map((v) => [`${v.key}:${v.contentDigest}`, v])
					).values(),
				];
	}
	return result;
}

function compareSection(
	from: DeliveryEvidencePin[] | null,
	to: DeliveryEvidencePin[] | null
): DeliveryEvidenceSection {
	if (!(from && to)) {
		return {
			status: "not_recorded",
			reason:
				"A pinned manifest or historical evidence source could not be read and verified on both sides.",
		};
	}
	const left = new Map(from.map((v) => [v.key, v]));
	const right = new Map(to.map((v) => [v.key, v]));
	const changes: Extract<
		DeliveryEvidenceSection,
		{ status: "recorded" }
	>["changes"] = [];
	let unchangedCount = 0;
	for (const key of [...new Set([...left.keys(), ...right.keys()])].sort()) {
		const before = left.get(key) ?? null;
		const after = right.get(key) ?? null;
		if (before?.contentDigest === after?.contentDigest) {
			unchangedCount += 1;
			continue;
		}
		let kind: "added" | "removed" | "changed" = "changed";
		if (!before) {
			kind = "added";
		} else if (!after) {
			kind = "removed";
		}
		changes.push({
			key,
			kind,
			from: before,
			to: after,
		});
	}
	return { status: "recorded", changes, unchangedCount };
}

export function compareDeliveryEvidence(
	from: Snapshot,
	to: Snapshot
): Record<NotRecordedSectionKey, DeliveryEvidenceSection> {
	return {
		qualityEvidence: compareSection(from.qualityEvidence, to.qualityEvidence),
		qualityWaiver: compareSection(from.qualityWaiver, to.qualityWaiver),
		rights: compareSection(from.rights, to.rights),
		runtimeEvidence: compareSection(from.runtimeEvidence, to.runtimeEvidence),
	};
}
