import { expect, test } from "bun:test";
import { deliverySectionSchemas } from "@sprite-anvil/api/project-archive-delivery";
import {
	type DeliveryRows,
	mapDeliveryRows,
} from "../project-archive-delivery-reader";

const at = new Date("2026-11-07T09:00:00.000Z");
const later = new Date("2026-11-08T09:00:00.000Z");
const d = (character: string) => character.repeat(64);
const empty: DeliveryRows = {
	bundleFiles: [],
	bundles: [],
	draftFamilies: [],
	drafts: [],
	fulfilmentRequirements: [],
	fulfilments: [],
	lockFiles: [],
	locks: [],
	notices: [],
	profileRevisions: [],
	profiles: [],
	targetRevisions: [],
	targets: [],
	validationDecisions: [],
	validationEvidence: [],
	validations: [],
};

const fulfilment = (id: string, createdAt: Date) =>
	({
		createdAt,
		createdByUserId: "user-1",
		deliveryTargetId: "target-1",
		draftId: "fdraft-1",
		id,
		projectId: "p",
		requestDigest: d("5"),
		revisionId: "rev-1",
		revisionNumber: 1,
	}) as never;

const requirement = (fulfilmentId: string, versionId: string) =>
	({
		assetFamilyId: "fam-1",
		assetFamilyName: "Hero",
		assetVersionIds: [versionId],
		bundleId: "bundle-1",
		fulfilmentId,
		id: `${fulfilmentId}-req`,
		itemId: "item-1",
		itemKind: "asset_record",
		itemName: "Idle",
		manifestDigest: d("1"),
		position: 0,
		projectId: "p",
		requiredSetRevisionId: "set-1",
		resolution: "only_bundle",
	}) as never;

test("source rows become archive records without the user who made them, a request digest or any storage location", () => {
	const { delivery, files } = mapDeliveryRows({
		...empty,
		bundleFiles: [
			{
				assetVersionId: null,
				byteSize: 30,
				bundleId: "bundle-1",
				content: "{}",
				path: "manifest.json",
				sha256: d("7"),
			},
			{
				assetVersionId: "v-1",
				byteSize: 10,
				bundleId: "bundle-1",
				content: "generated text",
				path: "a.txt",
				sha256: d("8"),
			},
		],
		bundles: [
			{
				adapterVersion: null,
				contextRevisionId: "ctx-1",
				contractVersion: "1.0.0",
				createdAt: at,
				createdByUserId: "user-1",
				deliveryTargetRevisionId: null,
				id: "bundle-1",
				manifestDigest: d("1"),
				profileId: "profile-1",
				profileRevisionId: "prev-1",
				projectId: "p",
				requestDigest: d("4"),
			},
		],
		drafts: [
			{
				contextRevisionId: "ctx-1",
				createdAt: at,
				createdByUserId: "user-1",
				deliveryTargetId: "target-1",
				id: "draft-1",
				productionEvidencePolicy: {
					defaultRequirement: "advisory",
					familyRequirements: [],
				},
				projectId: "p",
				rightsEvidencePolicy: { acceptableStates: [], requireRecordFor: [] },
				runtimeValidationCriterion: null,
			},
		],
		fulfilmentRequirements: [
			requirement("ful-1", "v-1"),
			requirement("ful-2", "v-2"),
		],
		fulfilments: [fulfilment("ful-1", at), fulfilment("ful-2", later)],
		targetRevisions: [
			{
				activatedAt: at,
				activatedByUserId: "user-1",
				deliveryTargetId: "target-1",
				draftId: "draft-1",
				id: "rev-1",
				projectId: "p",
				revisionNumber: 1,
			},
		],
		validationEvidence: [
			{
				byteSize: 5000,
				createdAt: at,
				createdByUserId: "user-1",
				fileName: "run.mp4",
				id: "ev-1",
				kind: "recording",
				objectKey: "projects/p/runtime/run",
				projectId: "p",
				recordId: "val-1",
				requestDigest: d("3"),
				sha256: d("e"),
				source: "manual",
				text: null,
			},
		],
		validations: [
			{
				adapterVersion: null,
				bundleId: "bundle-1",
				createdAt: at,
				createdByUserId: "user-1",
				engineVersion: "4.3",
				gameBuild: "b7",
				id: "val-1",
				manifestDigest: d("1"),
				projectId: "p",
				requestDigest: d("2"),
				supersedesRecordId: null,
			},
		],
	} as never);

	for (const [name, schema] of Object.entries(deliverySectionSchemas)) {
		for (const record of delivery[name as keyof typeof delivery]) {
			expect(schema.safeParse(record).success).toBe(true);
		}
	}
	const text = JSON.stringify(delivery);
	expect(text).not.toContain("user-1");
	expect(text).not.toContain("projects/p/");
	expect(text).not.toContain(d("2"));
	expect(delivery.exportBundles[0]?.files).toEqual([
		expect.objectContaining({ content: null, path: "a.txt" }),
		expect.objectContaining({ content: "{}", path: "manifest.json" }),
	]);
	expect(delivery.deliveryDiffs).toMatchObject([
		{ fromFulfilmentId: "ful-1", toFulfilmentId: "ful-2" },
	]);
	expect(files).toMatchObject([
		{
			kind: "runtime_evidence_file",
			objectKey: "projects/p/runtime/run",
			sha256: d("e"),
			sourceId: "ev-1",
		},
	]);
});
