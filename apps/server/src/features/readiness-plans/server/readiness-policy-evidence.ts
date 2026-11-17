import type { AssetRecordTrackingStore } from "@sprite-anvil/api/asset-record-tracking";
import type {
	AssetVersion,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import type { DeliveryTargetRevision } from "@sprite-anvil/api/delivery-planning-outputs";
import type { FamilyReadiness } from "@sprite-anvil/api/family-readiness";
import type { GenerationPackageStore } from "@sprite-anvil/api/generation-packages";
import type { ReferenceProductionStore } from "@sprite-anvil/api/reference-production";
import type { RightsRecordStore } from "@sprite-anvil/api/rights-records";

export interface ReadinessPolicyDependencies {
	assetVersions: Pick<AssetVersionStore, "list">;
	generationPackages: Pick<GenerationPackageStore, "list">;
	references: Pick<ReferenceProductionStore, "listImages">;
	rights: Pick<RightsRecordStore, "list">;
	tracking: Pick<AssetRecordTrackingStore, "getTracking">;
}

export interface ReadinessPolicyEvidence {
	production: Map<string, string[]>;
	rights: string[];
}

/** Reads only authorized, exact versions selected by the pinned required items. */
export async function readReadinessPolicyEvidence(
	deps: ReadinessPolicyDependencies,
	userId: string,
	projectId: string,
	revision: DeliveryTargetRevision,
	familyReadiness: Map<string, FamilyReadiness | null>
): Promise<ReadinessPolicyEvidence> {
	const result: ReadinessPolicyEvidence = { production: new Map(), rights: [] };
	const catalog = await deps.assetVersions.list(userId, projectId);
	const versions = new Map(
		catalog?.assetVersions
			.filter((v) => v.projectId === projectId)
			.map((v) => [v.id, v])
	);
	const records = new Map<
		string,
		Promise<Awaited<ReturnType<typeof readRecord>>>
	>();
	function readRecord(assetRecordId: string) {
		return Promise.all([
			deps.tracking.getTracking(userId, projectId, assetRecordId),
			deps.generationPackages.list(userId, projectId, assetRecordId),
			deps.references.listImages(userId, projectId, assetRecordId),
		]);
	}
	function record(assetRecordId: string) {
		let pending = records.get(assetRecordId);
		if (!pending) {
			pending = readRecord(assetRecordId);
			records.set(assetRecordId, pending);
		}
		return pending;
	}
	async function history(
		version: AssetVersion,
		visited = new Set<string>()
	): Promise<boolean> {
		if (visited.has(version.id)) {
			return false;
		}
		visited.add(version.id);
		const [, packages] = await record(version.assetRecordId);
		const packageId =
			version.productionEvidence.manualImportEvidence?.generationPackageId;
		if (
			packageId &&
			packages?.some(
				(p) =>
					p.id === packageId &&
					p.projectId === projectId &&
					p.assetRecordId === version.assetRecordId
			)
		) {
			return true;
		}
		const sources =
			catalog?.unitVersions.filter((u) => u.assetVersionId === version.id) ??
			[];
		if (!sources.length) {
			return false;
		}
		const results = await Promise.all(
			sources.map((unit) => {
				const source = versions.get(unit.sourceAssetVersionId);
				return source && source.assetRecordId === version.assetRecordId
					? history(source, new Set(visited))
					: false;
			})
		);
		return results.every(Boolean);
	}
	const checkedRights = new Set<string>();
	async function checkRights(
		assetRecordId: string,
		referenceId: string | null
	) {
		const key = JSON.stringify([assetRecordId, referenceId]);
		if (checkedRights.has(key)) {
			return;
		}
		checkedRights.add(key);
		const rights = await deps.rights.list(
			userId,
			projectId,
			assetRecordId,
			referenceId
		);
		const latest = rights
			?.filter(
				(r) =>
					r.projectId === projectId &&
					r.assetRecordId === assetRecordId &&
					(r.referenceId ?? null) === referenceId
			)
			.sort((a, b) => b.versionNumber - a.versionNumber)[0];
		if (
			!(
				latest &&
				revision.rightsEvidencePolicy.acceptableStates.includes(latest.state)
			)
		) {
			result.rights.push(
				`${referenceId ? "Reference" : "Result"} ${referenceId ?? assetRecordId}: ${latest ? `rights state ${latest.state} is not accepted` : "Rights Record is missing"}.`
			);
		}
	}
	async function checkFamily(
		family: DeliveryTargetRevision["families"][number]
	) {
		const failures: string[] = [];
		result.production.set(family.assetFamilyId, failures);
		const requirement =
			revision.productionEvidencePolicy.familyRequirements.find(
				(p) => p.assetFamilyId === family.assetFamilyId
			)?.requirement ?? revision.productionEvidencePolicy.defaultRequirement;
		const readiness = familyReadiness.get(family.assetFamilyId);
		const selected = new Set<string>();
		for (const item of family.requiredItems) {
			const versionIds =
				readiness?.items.find((i) => i.item.id === item.id)
					?.currentAssetVersionIds ?? [];
			if (!versionIds.length && requirement !== "advisory") {
				failures.push(
					`${item.id}: an exact current Asset Version is required to evaluate production evidence.`
				);
			}
			if (
				!versionIds.length &&
				revision.rightsEvidencePolicy.requireRecordFor.length
			) {
				result.rights.push(
					`${item.id}: an exact current Asset Version is required to evaluate rights evidence.`
				);
			}
			for (const id of versionIds) {
				selected.add(id);
			}
		}
		async function checkReferences(
			version: AssetVersion,
			detail: Awaited<ReturnType<typeof readRecord>>
		) {
			const [trackingDetail, packages, images] = detail;
			const tracking =
				trackingDetail?.record.id === version.assetRecordId &&
				trackingDetail.record.projectId === projectId
					? trackingDetail.tracking
					: null;
			if (
				revision.rightsEvidencePolicy.requireRecordFor.includes("references")
			) {
				if (!(tracking && images && packages)) {
					result.rights.push(
						`${version.assetRecordId}: reference evidence is unavailable.`
					);
					return;
				}
				const refs = new Set([
					...tracking.references.map((r) => r.id),
					...images.map((r) => r.id),
				]);
				const packageId =
					version.productionEvidence.manualImportEvidence?.generationPackageId;
				for (const ref of packages.find(
					(p) =>
						p.id === packageId &&
						p.projectId === projectId &&
						p.assetRecordId === version.assetRecordId
				)?.referenceRoles ?? []) {
					refs.add(ref.id);
				}
				await [...refs].reduce(
					(pending, ref) =>
						pending.then(() => checkRights(version.assetRecordId, ref)),
					Promise.resolve()
				);
			}
		}
		async function checkProduction(
			id: string,
			version: AssetVersion,
			tracking:
				| NonNullable<Awaited<ReturnType<typeof readRecord>>[0]>["tracking"]
				| null
		) {
			if (requirement !== "advisory") {
				const legacy =
					requirement === "legacy_asset_attestation_acceptable" &&
					tracking?.productionHistory.some(
						(a) => a.versionNumber === version.versionNumber
					);
				if (!(legacy || (await history(version)))) {
					failures.push(
						`${id}: ${requirement === "full_generation_package_history" ? "full Generation Package history" : "Generation Package history or an exact-version Legacy Asset Attestation"} is missing.`
					);
				}
			}
		}
		async function checkVersion(id: string) {
			const version = versions.get(id);
			if (!version || version.assetFamilyId !== family.assetFamilyId) {
				if (requirement !== "advisory") {
					failures.push(
						`${id}: the selected Asset Version is unavailable in this family and project.`
					);
				}
				if (revision.rightsEvidencePolicy.requireRecordFor.length) {
					result.rights.push(
						`${id}: the selected Asset Version is unavailable for rights evaluation.`
					);
				}
				return;
			}
			const [detail, packages, images] = await record(version.assetRecordId);
			const tracking =
				detail?.record.id === version.assetRecordId &&
				detail.record.projectId === projectId
					? detail.tracking
					: null;
			await checkProduction(id, version, tracking);
			if (revision.rightsEvidencePolicy.requireRecordFor.includes("results")) {
				await checkRights(version.assetRecordId, null);
			}
			await checkReferences(version, [detail, packages, images]);
		}
		await [...selected].reduce(
			(pending, id) => pending.then(() => checkVersion(id)),
			Promise.resolve()
		);
	}
	await revision.families.reduce(
		(pending, family) => pending.then(() => checkFamily(family)),
		Promise.resolve()
	);
	return result;
}
