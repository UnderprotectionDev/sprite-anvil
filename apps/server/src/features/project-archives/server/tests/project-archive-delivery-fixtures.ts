import { createHash } from "node:crypto";
import {
	exportBundleManifestSchema,
	renderExportBundleChecksums,
	renderExportBundleManifest,
} from "@sprite-anvil/api/export-bundle-manifest";
import { emptyDeliveryRecords } from "@sprite-anvil/api/project-archive-delivery";
import { buildFixtureBundleFiles } from "@sprite-anvil/api/test-support/export-bundle-verification-fixture";

const templateFiles = await buildFixtureBundleFiles();
const templateManifestFile = templateFiles.find(
	(file) => file.path === "manifest.json"
);
if (!templateManifestFile) {
	throw new Error("Missing fixture manifest");
}
const templateManifest = exportBundleManifestSchema.parse(
	JSON.parse(new TextDecoder().decode(templateManifestFile.bytes))
);
const hashText = (text: string) =>
	createHash("sha256").update(text).digest("hex");

import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import { digest, ids, projectId } from "./project-archive-fixtures";
import { historyIds, historySource } from "./project-archive-history-fixtures";

export const deliveryIds = {
	bundle1: "a1000000-0000-4000-8000-000000000001",
	bundle2: "a1000000-0000-4000-8000-000000000002",
	decision: "a6000000-0000-4000-8000-000000000001",
	draft: "a3000000-0000-4000-8000-000000000001",
	evidence: "a7000000-0000-4000-8000-000000000002",
	fulfilment1: "a4000000-0000-4000-8000-000000000001",
	fulfilment2: "a4000000-0000-4000-8000-000000000002",
	lock: "a2000000-0000-4000-8000-000000000001",
	notice: "a5000000-0000-4000-8000-000000000001",
	profile: "a0000000-0000-4000-8000-000000000001",
	profileRevision: "a0000000-0000-4000-8000-000000000002",
	revision: "a3000000-0000-4000-8000-000000000002",
	target: "a3000000-0000-4000-8000-000000000003",
	validation: "a7000000-0000-4000-8000-000000000001",
};

const requirement = (
	bundleId: string,
	versionId: string,
	manifestDigest: string
) => ({
	assetFamilyId: ids.family,
	assetFamilyName: "Hero",
	assetVersionIds: [versionId],
	bundleId,
	itemId: "item-idle",
	itemKind: "asset_record",
	itemName: "Hero idle",
	manifestDigest,
	position: 0,
	requiredSetRevisionId: "required-set-1",
	resolution: "only_bundle" as const,
});

function bundle(id: string, _manifestDigest: string, versionId: string) {
	const manifest = structuredClone(templateManifest);
	manifest.context = { revisionId: ids.contextRevision, revisionNumber: 1 };
	manifest.deliveryTargetRevisionId = deliveryIds.revision;
	manifest.profile = {
		...manifest.profile,
		profileId: deliveryIds.profile,
		revisionId: deliveryIds.profileRevision,
		revisionNumber: 1,
	};
	manifest.families = [
		{
			...manifest.families[0],
			assetFamilyId: ids.family,
			assetFamilyName: "Hero",
			profileContractRevisionIds: [],
			support: "general_asset_support",
		},
	];
	manifest.files = [
		{
			assetFamilyId: ids.family,
			assetRecordId: ids.record,
			assetVersionId: versionId,
			byteSize: 120,
			contentType: "image/png",
			itemId: "item-idle",
			path: "images/hero.png",
			sha256: digest("a"),
		},
	];
	manifest.requiredSets = [
		{
			assetFamilyId: ids.family,
			revisionId: "required-set-1",
			revisionNumber: 1,
			items: [
				{
					assetRecordIds: [ids.record],
					disposition: "required",
					id: "item-idle",
					kind: "asset_record",
					name: "Hero idle",
					testId: null,
				},
			],
		},
	];
	manifest.productionEvidence = [
		{
			assetVersionId: versionId,
			evidenceDigest: digest("b"),
			providerGenerationRecordId: null,
		},
	];
	manifest.rightsEvidence = [];
	const manifestText = renderExportBundleManifest(manifest);
	const manifestDigest = hashText(manifestText);
	const checksumsText = renderExportBundleChecksums([
		...manifest.files,
		{ path: "manifest.json", sha256: manifestDigest },
	]);
	const textFile = (path: string, content: string) => ({
		path,
		content,
		assetVersionId: null,
		byteSize: new TextEncoder().encode(content).length,
		sha256: hashText(content),
	});
	const files = [
		{
			assetVersionId: versionId,
			byteSize: 120,
			content: null,
			path: "images/hero.png",
			sha256: digest("a"),
		},
		textFile("manifest.json", manifestText),
		textFile("checksums.txt", checksumsText),
		textFile("verification-kit/checksums.txt", checksumsText),
		...templateFiles
			.filter(
				(file) =>
					file.path.startsWith("verification-kit/") &&
					file.path !== "verification-kit/checksums.txt"
			)
			.map((file) => textFile(file.path, new TextDecoder().decode(file.bytes))),
	];
	return {
		adapterVersion: null,
		contextRevisionId: ids.contextRevision,
		contractVersion: manifest.contractVersion,
		createdAt: "2026-11-07T07:00:00.000Z",
		deliveryTargetRevisionId: deliveryIds.revision,
		files,
		id,
		manifestDigest,
		profileId: deliveryIds.profile,
		profileRevisionId: deliveryIds.profileRevision,
	};
}

/** A history source plus a populated delivery and validation group. */
export function deliverySource(): ProjectArchiveSource {
	const source = historySource();
	source.history.requiredSetRevisions = [
		{
			id: "required-set-1",
			assetFamilyId: ids.family,
			revisionNumber: 1,
			items: [
				{
					id: "item-idle",
					kind: "animation",
					name: "Hero idle",
					disposition: "required",
					assetRecordIds: [ids.record],
				},
			],
			createdAt: "2026-11-06T05:00:00.000Z",
		},
	];
	source.delivery = {
		...emptyDeliveryRecords(),
		exportBundleMarkers: [
			{
				id: projectId,
				bundleId: deliveryIds.bundle2,
				updatedAt: "2026-11-08T00:00:00.000Z",
			},
		],
		deliveryDiffs: [
			{
				assetVersions: {
					added: [],
					changed: [
						{
							assetFamilyId: ids.family,
							assetFamilyName: "Hero",
							fromAssetVersionIds: [ids.version1],
							itemId: "item-idle",
							itemKind: "asset_record",
							itemName: "Hero idle",
							toAssetVersionIds: [ids.version2],
						},
					],
					removed: [],
					unchangedCount: 0,
				},
				bundleMappings: {
					changes: [
						{
							assetFamilyId: ids.family,
							assetFamilyName: "Hero",
							from: {
								bundleId: deliveryIds.bundle1,
								manifestDigest: digest("1"),
								resolution: "only_bundle",
							},
							itemId: "item-idle",
							itemKind: "asset_record",
							itemName: "Hero idle",
							to: {
								bundleId: deliveryIds.bundle2,
								manifestDigest: digest("2"),
								resolution: "only_bundle",
							},
						},
					],
				},
				context: {
					changed: false,
					fromContextRevisionId: ids.contextRevision,
					toContextRevisionId: ids.contextRevision,
				},
				deliveryTargetId: deliveryIds.target,
				fromFulfilmentId: deliveryIds.fulfilment1,
				id: `${deliveryIds.fulfilment1}..${deliveryIds.fulfilment2}`,
				toFulfilmentId: deliveryIds.fulfilment2,
			},
		],
		deliveryFulfilments: [
			{
				createdAt: "2026-11-07T08:00:00.000Z",
				deliveryTargetId: deliveryIds.target,
				draftId: "fulfilment-draft-not-archived",
				id: deliveryIds.fulfilment1,
				requirements: [
					requirement(deliveryIds.bundle1, ids.version1, digest("1")),
				],
				revisionId: deliveryIds.revision,
				revisionNumber: 1,
			},
			{
				createdAt: "2026-11-08T08:00:00.000Z",
				deliveryTargetId: deliveryIds.target,
				draftId: "fulfilment-draft-not-archived-2",
				id: deliveryIds.fulfilment2,
				requirements: [
					requirement(deliveryIds.bundle2, ids.version2, digest("2")),
				],
				revisionId: deliveryIds.revision,
				revisionNumber: 1,
			},
		],
		deliveryRefreshLocks: [
			{
				bundleId: deliveryIds.bundle1,
				bundleManifestDigest: digest("1"),
				contractVersion: "1.0.0",
				createdAt: "2026-11-07T09:00:00.000Z",
				destinationLabel: "Godot project",
				files: [
					{ byteSize: 120, path: "images/hero.png", sha256: digest("a") },
				],
				id: deliveryIds.lock,
				lockDigest: digest("9"),
				profileId: deliveryIds.profile,
				profileRevisionId: deliveryIds.profileRevision,
			},
		],
		deliveryTargetDrafts: [
			{
				contextRevisionId: ids.contextRevision,
				createdAt: "2026-11-06T08:00:00.000Z",
				deliveryTargetId: deliveryIds.target,
				families: [
					{
						assetFamilyId: ids.family,
						position: 0,
						requiredSetRevisionId: "required-set-1",
					},
				],
				id: deliveryIds.draft,
				productionEvidencePolicy: {
					defaultRequirement: "advisory",
					familyRequirements: [],
				},
				rightsEvidencePolicy: {
					acceptableStates: ["documented"],
					requireRecordFor: ["results"],
				},
				runtimeValidationCriterion: {
					environments: [
						{
							adapterVersion: null,
							engineVersion: "4.3",
							gameBuild: "build-7",
						},
					],
					freshness: "not_superseded",
				},
			},
		],
		deliveryTargetRevisions: [
			{
				activatedAt: "2026-11-06T09:00:00.000Z",
				deliveryTargetId: deliveryIds.target,
				draftId: deliveryIds.draft,
				id: deliveryIds.revision,
				revisionNumber: 1,
			},
		],
		deliveryTargets: [
			{
				createdAt: "2026-11-06T07:00:00.000Z",
				id: deliveryIds.target,
				name: "Demo",
				purpose: "demo",
			},
		],
		exportBundles: [
			bundle(deliveryIds.bundle1, digest("1"), ids.version1),
			bundle(deliveryIds.bundle2, digest("2"), ids.version2),
		],
		exportProfileRevisions: [
			{
				contentDigest: digest("8"),
				contractVersion: "1.0.0",
				createdAt: "2026-11-06T06:30:00.000Z",
				definition: { engine: "godot" },
				id: deliveryIds.profileRevision,
				profileId: deliveryIds.profile,
				revisionNumber: 1,
			},
		],
		exportProfiles: [
			{
				createdAt: "2026-11-06T06:00:00.000Z",
				id: deliveryIds.profile,
				name: "Godot 4",
			},
		],
		historicalRiskNotices: [
			{
				affectedUsage: [
					{
						assetFamilyId: ids.family,
						assetFamilyName: "Hero",
						bundleId: deliveryIds.bundle1,
						itemId: "item-idle",
						itemName: "Hero idle",
					},
				],
				assetRecordId: ids.record,
				deliveryTargetId: deliveryIds.target,
				detectedAt: "2026-11-09T08:00:00.000Z",
				fulfilmentId: deliveryIds.fulfilment1,
				id: deliveryIds.notice,
				pinnedPolicy: {
					acceptableStates: ["documented"],
					requireRecordFor: ["results"],
				},
				pinnedRights: {
					rightsRecordId: historyIds.rights,
					state: "documented",
					versionNumber: 1,
				},
				revisionId: deliveryIds.revision,
				revisionNumber: 1,
				rightsRecordId: historyIds.rights,
				rightsRecordState: "restricted",
				rightsRecordVersionNumber: 2,
			},
		],
		runtimeValidations: [
			{
				adapterVersion: null,
				bundleId: deliveryIds.bundle1,
				createdAt: "2026-11-07T10:00:00.000Z",
				decisions: [
					{
						createdAt: "2026-11-07T11:00:00.000Z",
						failureSource: null,
						id: deliveryIds.decision,
						kind: "outcome",
						outcome: "pass",
						sequence: 1,
					},
				],
				engineVersion: "4.3",
				evidence: [
					{
						createdAt: "2026-11-07T10:30:00.000Z",
						file: {
							byteSize: 5_000_000,
							fileName: "run.mp4",
							sha256: digest("e"),
						},
						id: deliveryIds.evidence,
						kind: "recording",
						source: "manual",
						text: null,
					},
				],
				gameBuild: "build-7",
				id: deliveryIds.validation,
				manifestDigest: digest("1"),
				supersedesRecordId: null,
			},
		],
	};
	source.files.push({
		assetRecordId: null,
		assetVersionId: null,
		byteSize: 5_000_000,
		contentType: null,
		fileName: "run.mp4",
		kind: "runtime_evidence_file",
		objectKey: "projects/p/runtime/run",
		sha256: digest("e"),
		sourceId: deliveryIds.evidence,
	});
	const [first, second] = source.delivery.exportBundles;
	if (!(first && second)) {
		throw new Error("Missing fixture bundles");
	}
	source.delivery = JSON.parse(
		JSON.stringify(source.delivery)
			.replaceAll(digest("1"), first.manifestDigest)
			.replaceAll(digest("2"), second.manifestDigest)
	);
	return source;
}
