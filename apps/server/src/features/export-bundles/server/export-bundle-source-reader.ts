import type { AssetFamilyStore } from "@sprite-anvil/api/asset-families";
import type {
	AssetVersion,
	AssetVersionCatalog,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import type {
	ExportBundleSource,
	ExportBundleSourceFamily,
} from "@sprite-anvil/api/export-bundle-manifest";
import type { ExportBundleSourceReader } from "@sprite-anvil/api/export-bundle-store";
import type {
	FamilyReadiness,
	FamilyReadinessStore,
} from "@sprite-anvil/api/family-readiness";
import type { ProjectContextStore } from "@sprite-anvil/api/project-context";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import type { RightsRecordStore } from "@sprite-anvil/api/rights-records";

export interface ExportBundleSourceReaderDependencies {
	assetFamilies: Pick<AssetFamilyStore, "list">;
	assetVersions: Pick<AssetVersionStore, "list">;
	familyReadiness: Pick<FamilyReadinessStore, "list">;
	projectContext: Pick<ProjectContextStore, "listProjects">;
	rights: Pick<RightsRecordStore, "list">;
}

/** What one family's readiness contributes to the bundle's pins. */
interface FamilyPins {
	blockers: ExportBundleSource["blockers"];
	compositeTargetIds: string[];
	family: ExportBundleSourceFamily;
	quality: ExportBundleSource["quality"];
	selectedVersionIds: string[];
	unitTargetIds: string[];
}

type ReadinessEvidence =
	FamilyReadiness["items"][number]["latestEvidence"][number];

function addContractRevisionIds(
	into: Set<string>,
	evidence: ReadinessEvidence
) {
	for (const id of evidence.profileContractRevisionIds) {
		if (id) {
			into.add(id);
		}
	}
}

function pinQuality(
	assetFamilyId: string,
	evidence: ReadinessEvidence
): ExportBundleSource["quality"][number] {
	return {
		assetFamilyId,
		assetVersionIds: evidence.assetVersionIds,
		evidenceId: evidence.id,
		itemId: evidence.itemId,
		kind: evidence.kind,
		observedValue: evidence.observedValue,
		rationale: evidence.rationale,
		result: evidence.result,
		ruleClass: evidence.ruleClass,
		ruleId: evidence.ruleId,
		versionTarget: evidence.versionTarget ?? null,
	};
}

/**
 * Only required items are pinned. A required item that is not complete is a
 * blocker, never a skipped file.
 */
function pinFamily(
	assetFamilyId: string,
	assetFamilyName: string,
	readiness: FamilyReadiness
): FamilyPins | null {
	const { activeRevision } = readiness;
	if (!activeRevision) {
		return null;
	}
	const pins: FamilyPins = {
		blockers: [],
		compositeTargetIds: [],
		family: {
			assetFamilyId,
			assetFamilyName,
			profileContractRevisionIds: [],
			requiredSet: {
				items: activeRevision.items.map((item) => ({
					assetRecordIds: item.assetRecordIds,
					disposition: item.disposition,
					id: item.id,
					kind: item.kind,
					name: item.name,
					...(item.testId ? { testId: item.testId } : {}),
				})),
				revisionId: activeRevision.id,
				revisionNumber: activeRevision.revisionNumber,
			},
			selections: [],
		},
		quality: [],
		selectedVersionIds: [],
		unitTargetIds: [],
	};
	const contractRevisionIds = new Set<string>();
	for (const entry of readiness.items) {
		if (entry.item.disposition !== "required") {
			continue;
		}
		if (entry.status !== "complete") {
			pins.blockers.push({
				assetFamilyId,
				codes: [...entry.blockers],
				itemId: entry.item.id,
			});
			continue;
		}
		pins.family.selections.push({
			assetVersionIds: [...entry.currentAssetVersionIds],
			itemId: entry.item.id,
		});
		pins.selectedVersionIds.push(...entry.currentAssetVersionIds);
		for (const target of entry.qualityVersionTargets ?? []) {
			(target.kind === "unit"
				? pins.unitTargetIds
				: pins.compositeTargetIds
			).push(target.id);
		}
		for (const evidence of entry.latestEvidence.filter((e) => e.isCurrent)) {
			addContractRevisionIds(contractRevisionIds, evidence);
			pins.quality.push(pinQuality(assetFamilyId, evidence));
		}
	}
	pins.family.profileContractRevisionIds = [...contractRevisionIds];
	return pins;
}

async function pinAssetVersion(
	version: AssetVersion
): Promise<ExportBundleSource["assetVersions"][number]> {
	return {
		assetFamilyId: version.assetFamilyId,
		assetRecordId: version.assetRecordId,
		byteSize: version.contentLength,
		contentType: version.contentType,
		id: version.id,
		productionEvidenceDigest: await recordContentDigest({
			productionEvidence: version.productionEvidence,
			productionSource: version.productionSource ?? null,
		}),
		providerGenerationRecordId: version.providerGenerationRecord?.id ?? null,
		sha256: version.contentDigest,
		versionNumber: version.versionNumber,
	};
}

function pinUnitAndCompositeVersions(
	catalog: AssetVersionCatalog,
	selectedVersionIds: Set<string>,
	unitTargetIds: Set<string>,
	compositeTargetIds: Set<string>
) {
	return {
		compositeVersions: catalog.compositeVersions
			.filter((composite) => compositeTargetIds.has(composite.id))
			.map((composite) => ({
				assetRecordId: composite.assetRecordId,
				id: composite.id,
				memberUnitVersionIds: composite.compositionMemberships.map(
					(membership) => membership.unitVersionId
				),
				versionNumber: composite.versionNumber,
			})),
		unitVersions: catalog.unitVersions
			.filter(
				(unit) =>
					selectedVersionIds.has(unit.assetVersionId) ||
					unitTargetIds.has(unit.id)
			)
			.map((unit) => ({
				assetRecordId: unit.assetRecordId,
				assetVersionId: unit.assetVersionId,
				id: unit.id,
				unitKey: unit.unitKey,
				unitType: unit.unitType,
				versionNumber: unit.versionNumber,
			})),
	};
}

/**
 * Reads the pins of a bundle through the stores that own them: the Project
 * Context revision, each family's active Required Set and its readiness
 * evidence, Asset, Unit and Composite Versions, and rights records.
 */
export function createExportBundleSourceReader(
	dependencies: ExportBundleSourceReaderDependencies
): ExportBundleSourceReader {
	async function latestRights(
		userId: string,
		projectId: string,
		assetRecordId: string
	) {
		const records = await dependencies.rights.list(
			userId,
			projectId,
			assetRecordId,
			null
		);
		const [latest] = [...(records ?? [])].sort(
			(left, right) => right.versionNumber - left.versionNumber
		);
		return latest
			? {
					assetRecordId,
					rightsRecordId: latest.id,
					state: latest.state,
					versionNumber: latest.versionNumber,
				}
			: null;
	}

	return {
		async read(userId, { assetFamilyIds, projectId }) {
			const [projects, catalog, familyCatalog, readiness] = await Promise.all([
				dependencies.projectContext.listProjects(userId),
				dependencies.assetVersions.list(userId, projectId),
				dependencies.assetFamilies.list(userId, projectId),
				Promise.all(
					assetFamilyIds.map(async (assetFamilyId) => ({
						assetFamilyId,
						readiness: await dependencies.familyReadiness.list(
							userId,
							projectId,
							assetFamilyId
						),
					}))
				),
			]);
			const project = projects.find((candidate) => candidate.id === projectId);
			if (!(project && catalog && familyCatalog)) {
				return null;
			}
			const familyNames = new Map(
				familyCatalog.assetFamilies.map((family) => [family.id, family.name])
			);

			const pinned = readiness.map(
				({ assetFamilyId, readiness: familyReadiness }) =>
					familyReadiness
						? pinFamily(
								assetFamilyId,
								familyNames.get(assetFamilyId) ?? assetFamilyId,
								familyReadiness
							)
						: null
			);
			const unavailable = assetFamilyIds.filter(
				(_, index) => pinned[index] === null
			);
			if (unavailable.length > 0) {
				return { assetFamilyIds: unavailable, status: "family_unavailable" };
			}
			const pins = pinned.filter((pin) => pin !== null);

			const selectedVersionIds = new Set(
				pins.flatMap((pin) => pin.selectedVersionIds)
			);
			const assetVersions = await Promise.all(
				catalog.assetVersions
					.filter((version) => selectedVersionIds.has(version.id))
					.map(pinAssetVersion)
			);
			const rights = (
				await Promise.all(
					[
						...new Set(assetVersions.map((version) => version.assetRecordId)),
					].map((assetRecordId) =>
						latestRights(userId, projectId, assetRecordId)
					)
				)
			).filter((entry) => entry !== null);

			return {
				source: {
					assetVersions,
					blockers: pins.flatMap((pin) => pin.blockers),
					context: {
						revisionId: project.currentContextRevision.id,
						revisionNumber: project.currentContextRevision.revisionNumber,
					},
					families: pins.map((pin) => pin.family),
					quality: pins.flatMap((pin) => pin.quality),
					rights,
					...pinUnitAndCompositeVersions(
						catalog,
						selectedVersionIds,
						new Set(pins.flatMap((pin) => pin.unitTargetIds)),
						new Set(pins.flatMap((pin) => pin.compositeTargetIds))
					),
				},
				status: "resolved",
			};
		},
	};
}
