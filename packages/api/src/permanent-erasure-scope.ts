import {
	type ErasureContainerKind,
	type ErasureImpactScope,
	erasureImpactContractVersion,
	externalCopiesStatement,
} from "./permanent-erasure";

/** A whole immutable container as stored, with the Asset Versions its files hold. */
interface ContainerSource<File extends { assetVersionId: string | null }> {
	files: File[];
	id: string;
	manifestDigest: string;
}

/** The persisted records one asset's Erasure Impact Report is built from. */
export interface ErasureImpactSource {
	/** Project Archives that list any file of the asset's versions; a file is `included` or only `excluded` from the archive. */
	archives: ContainerSource<{
		assetVersionId: string | null;
		presence: "included" | "excluded";
	}>[];
	assetRecord: { availability: string; id: string };
	/** Export Bundles that list any file of the asset's versions. */
	bundles: ContainerSource<{ assetVersionId: string | null }>[];
	/** Delivery Fulfilments whose requirements pin the asset's versions or use a listed bundle. */
	fulfilments: {
		deliveryTargetId: string;
		id: string;
		requirements: { assetVersionIds: string[]; bundleId: string }[];
		revisionNumber: number;
	}[];
	versions: {
		byteSize: number;
		id: string;
		sha256: string | null;
	}[];
}

export type ErasureImpactRejection =
	| { reason: "already_erased" }
	| { reason: "no_managed_copies" }
	| { assetVersionIds: string[]; reason: "copy_digest_missing" };

export type BuildErasureImpactResult =
	| { ok: true; scope: ErasureImpactScope }
	| ({ ok: false } & ErasureImpactRejection);

export interface RetentionSchedule {
	purgeWindowDays: number;
	version: string;
}

function byText(left: string, right: string) {
	return Number(left > right) - Number(left < right);
}

function byId<T extends { id: string }>(left: T, right: T) {
	return byText(left.id, right.id);
}

/** The whole containers of one kind that hold any of the target versions, by id. */
function embeddingContainers(
	kind: ErasureContainerKind,
	candidates: readonly ContainerSource<{ assetVersionId: string | null }>[],
	targetIds: ReadonlySet<string>
): ErasureImpactScope["containers"] {
	const containers: ErasureImpactScope["containers"] = [];
	for (const candidate of candidates) {
		const embedded = candidate.files.flatMap((file) =>
			file.assetVersionId !== null && targetIds.has(file.assetVersionId)
				? [file.assetVersionId]
				: []
		);
		if (embedded.length > 0) {
			containers.push({
				embeddedAssetVersionIds: [...new Set(embedded)].sort(byText),
				embeddedFileCount: embedded.length,
				id: candidate.id,
				kind,
				manifestDigest: candidate.manifestDigest,
				removal: "whole",
			});
		}
	}
	return containers.sort(byId);
}

/** Builds the exact scope of erasing one asset: its copies, the whole containers holding them, and the fulfilments they touch. */
export function buildErasureImpactScope(
	source: ErasureImpactSource,
	options: { projectId: string; retention: RetentionSchedule | null }
): BuildErasureImpactResult {
	if (source.assetRecord.availability === "erased") {
		return { ok: false, reason: "already_erased" };
	}
	if (source.versions.length === 0) {
		return { ok: false, reason: "no_managed_copies" };
	}
	const unverifiable = source.versions
		.filter((version) => version.sha256 === null)
		.map((version) => version.id)
		.sort(byText);
	if (unverifiable.length > 0) {
		return {
			assetVersionIds: unverifiable,
			ok: false,
			reason: "copy_digest_missing",
		};
	}
	const targetIds = new Set(source.versions.map((version) => version.id));

	const bundles = embeddingContainers(
		"export_bundle",
		source.bundles,
		targetIds
	);
	const archives = embeddingContainers(
		"project_archive",
		source.archives.map((archive) => ({
			...archive,
			// A file the archive only lists as excluded holds no content.
			files: archive.files.filter((file) => file.presence === "included"),
		})),
		targetIds
	);

	const bundleIds = new Set(bundles.map((bundle) => bundle.id));
	const fulfilments: ErasureImpactScope["fulfilments"] = [];
	for (const fulfilment of source.fulfilments) {
		const touching = fulfilment.requirements.filter(
			(requirement) =>
				requirement.assetVersionIds.some((id) => targetIds.has(id)) ||
				bundleIds.has(requirement.bundleId)
		);
		if (touching.length > 0) {
			fulfilments.push({
				bundleIds: [...new Set(touching.map((entry) => entry.bundleId))].sort(
					byText
				),
				deliveryTargetId: fulfilment.deliveryTargetId,
				id: fulfilment.id,
				pinsErasedVersions: touching.some((requirement) =>
					requirement.assetVersionIds.some((id) => targetIds.has(id))
				),
				revisionNumber: fulfilment.revisionNumber,
			});
		}
	}
	fulfilments.sort(byId);

	const containers = [...bundles, ...archives];
	const managedCopies = source.versions
		.map((version) => ({
			assetVersionId: version.id,
			byteSize: version.byteSize,
			sha256: version.sha256 as string,
		}))
		.sort((left, right) => byText(left.assetVersionId, right.assetVersionId));

	return {
		ok: true,
		scope: {
			backup: options.retention
				? {
						purgeWindowDays: options.retention.purgeWindowDays,
						retentionScheduleVersion: options.retention.version,
						status: "scheduled",
					}
				: { status: "unpublished" },
			containers,
			contractVersion: erasureImpactContractVersion,
			counts: {
				archives: archives.length,
				bundles: bundles.length,
				containerFiles: containers.reduce(
					(sum, container) => sum + container.embeddedFileCount,
					0
				),
				fulfilments: fulfilments.length,
				managedCopies: managedCopies.length,
			},
			externalCopies: {
				recallable: false,
				statement: externalCopiesStatement,
			},
			fulfilments,
			managedCopies,
			projectId: options.projectId,
			target: { assetRecordId: source.assetRecord.id },
		},
	};
}
