import { expect, test } from "bun:test";
import {
	assetFamilySummarySchema,
	assetVersionSummarySchema,
	trackingVersionOptionSchema,
} from "@sprite-anvil/api/asset-record-tracking";
import { assetRecordSearchVersionSchema } from "@sprite-anvil/api/asset-records";

const recordId = "1e7ecf9a-73c6-4f41-9103-e189c2f1f6ab";
const versionId = "19bed7c1-4b5c-43d5-a3bf-f9d253e9112e";
const worldId = "02b966ed-b5a8-470a-84cb-74b44295cc3f";

test("accepts legacy Asset Version fields whose values were never recorded", () => {
	expect(
		assetRecordSearchVersionSchema.safeParse({
			fileName: null,
			id: versionId,
			sourceImageHeight: 256,
			sourceImageWidth: 256,
			versionNumber: 1,
		}).success
	).toBe(true);

	expect(
		assetVersionSummarySchema.safeParse({
			createdAt: "2026-09-25T00:00:00.000Z",
			fileName: null,
			id: versionId,
			reviewDisposition: "approved",
			sha256: null,
			versionNumber: 1,
		}).success
	).toBe(true);

	expect(
		trackingVersionOptionSchema.safeParse({
			assetRecordId: recordId,
			assetRecordName: "Legacy record",
			fileName: null,
			id: versionId,
			reviewDisposition: "approved",
			versionNumber: 1,
		}).success
	).toBe(true);

	expect(
		assetFamilySummarySchema.safeParse({
			canonicalVersionId: null,
			id: recordId,
			name: "Legacy family",
			useContext: "Legacy usage",
			visualWorldId: worldId,
			visualWorldName: "Legacy world",
		}).success
	).toBe(true);
});
