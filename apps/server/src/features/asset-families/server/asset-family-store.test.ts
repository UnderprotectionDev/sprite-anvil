import { expect, test } from "bun:test";
import { toFamilyAssetRecords } from "./asset-family-store";

test("omits legacy Asset Records that are not assigned to an Asset Family", () => {
	const createdAt = new Date("2026-09-25T08:00:00.000Z");

	const records = toFamilyAssetRecords([
		{
			id: "assigned-asset-record",
			projectId: "project-1",
			assetFamilyId: "family-1",
			name: "Assigned Asset Record",
			createdAt,
		},
		{
			id: "legacy-asset-record",
			projectId: "project-1",
			assetFamilyId: null,
			name: "Legacy Asset Record",
			createdAt,
		},
	]);

	expect(records).toEqual([
		{
			id: "assigned-asset-record",
			projectId: "project-1",
			assetFamilyId: "family-1",
			name: "Assigned Asset Record",
			createdAt: "2026-09-25T08:00:00.000Z",
		},
	]);
});
