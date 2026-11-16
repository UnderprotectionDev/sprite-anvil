import { expect, test } from "bun:test";
import type { AssetRecordTrackingDetail } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { DeliveryTargetRevision } from "@sprite-anvil/api/delivery-planning-outputs";
import type { FamilyReadiness } from "@sprite-anvil/api/family-readiness";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type { RightsRecord } from "@sprite-anvil/api/rights-records";
import { readReadinessPolicyEvidence } from "../readiness-policy-evidence";

function setup() {
	const revision = {
		productionEvidencePolicy: {
			defaultRequirement: "full_generation_package_history",
			familyRequirements: [],
		},
		rightsEvidencePolicy: {
			acceptableStates: ["documented"],
			requireRecordFor: ["results", "references"],
		},
		families: [
			{
				assetFamilyId: "family",
				requiredItems: [{ id: "item", assetRecordIds: ["record"] }],
			},
		],
	} as unknown as DeliveryTargetRevision;
	const catalog = {
		assetVersions: [
			{
				id: "version",
				projectId: "project",
				assetFamilyId: "family",
				assetRecordId: "record",
				versionNumber: 1,
				productionEvidence: {
					manualImportEvidence: { generationPackageId: "package" },
				},
			},
		],
		unitVersions: [],
		compositeVersions: [],
	} as unknown as AssetVersionCatalog;
	const tracking = {
		record: { id: "record", projectId: "project" },
		tracking: {
			productionHistory: [],
			references: [{ id: "reference", versionId: "reference-version" }],
		},
	} as unknown as AssetRecordTrackingDetail;
	let packages = [
		{
			id: "package",
			projectId: "project",
			assetRecordId: "record",
			referenceRoles: [{ id: "reference", kind: "asset_version" }],
		},
	] as unknown as GenerationPackage[];
	let rights = [
		{
			state: "documented",
			versionNumber: 1,
			projectId: "project",
			assetRecordId: "record",
			referenceId: null,
		},
	] as unknown as RightsRecord[];
	const familyReadiness = new Map([
		[
			"family",
			{
				items: [{ item: { id: "item" }, currentAssetVersionIds: ["version"] }],
			} as unknown as FamilyReadiness,
		],
	]);
	const dependencies = {
		assetVersions: { list: () => Promise.resolve(catalog) },
		tracking: { getTracking: () => Promise.resolve(tracking) },
		generationPackages: { list: () => Promise.resolve(packages) },
		rights: {
			list: (_u: string, _p: string, _a: string, ref: string | null) =>
				Promise.resolve(rights.map((r) => ({ ...r, referenceId: ref }))),
		},
		references: { listImages: () => Promise.resolve([]) },
	};
	return {
		revision,
		catalog,
		tracking,
		familyReadiness,
		dependencies,
		setPackages: (value: GenerationPackage[]) => {
			packages = value;
		},
		setRights: (value: RightsRecord[]) => {
			rights = value;
		},
	};
}

test("actual generation history and acceptable result/reference rights satisfy policies", async () => {
	const s = setup();
	const result = await readReadinessPolicyEvidence(
		s.dependencies,
		"user",
		"project",
		s.revision,
		s.familyReadiness
	);
	expect(result.production.get("family")).toEqual([]);
	expect(result.rights).toEqual([]);
});

test("a missing or foreign Generation Package fails the required history policy", async () => {
	const s = setup();
	s.setPackages([]);
	expect(
		(
			await readReadinessPolicyEvidence(
				s.dependencies,
				"user",
				"project",
				s.revision,
				s.familyReadiness
			)
		).production.get("family")?.length
	).toBeGreaterThan(0);
	s.setPackages([
		{
			id: "package",
			projectId: "foreign",
			assetRecordId: "record",
			referenceRoles: [],
		},
	] as unknown as GenerationPackage[]);
	expect(
		(
			await readReadinessPolicyEvidence(
				s.dependencies,
				"user",
				"project",
				s.revision,
				s.familyReadiness
			)
		).production.get("family")?.length
	).toBeGreaterThan(0);
});

test("the latest rights revision wins and missing rights do not pass", async () => {
	const s = setup();
	s.setRights([
		{
			state: "documented",
			versionNumber: 1,
			projectId: "project",
			assetRecordId: "record",
		},
		{
			state: "restricted",
			versionNumber: 2,
			projectId: "project",
			assetRecordId: "record",
		},
	] as unknown as RightsRecord[]);
	expect(
		(
			await readReadinessPolicyEvidence(
				s.dependencies,
				"user",
				"project",
				s.revision,
				s.familyReadiness
			)
		).rights.length
	).toBeGreaterThan(0);
	s.setRights([]);
	expect(
		(
			await readReadinessPolicyEvidence(
				s.dependencies,
				"user",
				"project",
				s.revision,
				s.familyReadiness
			)
		).rights.length
	).toBeGreaterThan(0);
});

test("an exact-version legacy attestation satisfies only the policy accepting it", async () => {
	const s = setup();
	s.setPackages([]);
	s.tracking.tracking.productionHistory.push({ versionNumber: 1 } as never);
	s.revision.productionEvidencePolicy.defaultRequirement =
		"legacy_asset_attestation_acceptable";
	expect(
		(
			await readReadinessPolicyEvidence(
				s.dependencies,
				"user",
				"project",
				s.revision,
				s.familyReadiness
			)
		).production.get("family")
	).toEqual([]);
	const legacy = s.tracking.tracking.productionHistory.at(0);
	if (!legacy) {
		throw new Error("The test requires its recorded legacy attestation.");
	}
	legacy.versionNumber = 2;
	expect(
		(
			await readReadinessPolicyEvidence(
				s.dependencies,
				"user",
				"project",
				s.revision,
				s.familyReadiness
			)
		).production.get("family")?.length
	).toBeGreaterThan(0);
});
