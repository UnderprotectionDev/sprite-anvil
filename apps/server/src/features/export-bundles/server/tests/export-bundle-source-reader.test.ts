import { expect, test } from "bun:test";
import { createExportBundleSourceReader } from "../export-bundle-source-reader";

const projectId = "p-1";
const familyId = "fam-1";

function readiness(status: "complete" | "incomplete") {
	return {
		activeRevision: {
			id: "rs-1",
			items: [
				{
					assetRecordIds: ["rec-1"],
					disposition: "required",
					id: "idle",
					kind: "state",
					name: "Idle",
				},
			],
			revisionNumber: 2,
		},
		items: [
			{
				blockers: status === "complete" ? [] : ["quality"],
				currentAssetVersionIds: ["av-1"],
				item: { disposition: "required", id: "idle" },
				latestEvidence: [
					{
						assetVersionIds: ["av-1"],
						createdAt: "2026-11-01T10:00:00.000Z",
						createdByUserId: "user-1",
						id: "ev-1",
						isCurrent: true,
						itemId: "idle",
						kind: "quality",
						observedValue: null,
						profileContractRevisionIds: [null],
						rationale: "ok",
						result: "passed",
						ruleClass: null,
						ruleId: "r",
						versionTarget: { id: "uv-1", kind: "unit" },
					},
				],
				qualityVersionTargets: [{ id: "uv-1", kind: "unit" }],
				status,
			},
		],
	};
}

function reader(status: "complete" | "incomplete", hasFamily = true) {
	return createExportBundleSourceReader({
		assetFamilies: {
			list: () =>
				Promise.resolve({ assetFamilies: [{ id: familyId, name: "Hero" }] }),
		},
		assetVersions: {
			list: () =>
				Promise.resolve({
					assetVersions: [
						{
							assetFamilyId: familyId,
							assetRecordId: "rec-1",
							contentDigest: "a".repeat(64),
							contentLength: 10,
							contentType: "image/png",
							id: "av-1",
							productionEvidence: { kind: "none" },
							versionNumber: 1,
						},
					],
					compositeVersions: [],
					unitVersions: [
						{
							assetRecordId: "rec-1",
							assetVersionId: "av-1",
							id: "uv-1",
							unitKey: "idle",
							unitType: "state",
							versionNumber: 1,
						},
					],
				}),
		},
		familyReadiness: {
			list: () => Promise.resolve(hasFamily ? readiness(status) : null),
		},
		projectContext: {
			listProjects: () =>
				Promise.resolve([
					{
						currentContextRevision: { id: "ctx-9", revisionNumber: 9 },
						id: projectId,
					},
				]),
		},
		rights: {
			list: () =>
				Promise.resolve([
					{ id: "rr-1", state: "assertion_only", versionNumber: 1 },
					{ id: "rr-2", state: "documented", versionNumber: 2 },
				]),
		},
	} as never);
}

test("pins the active Required Set, current context, exact versions and the latest rights record", async () => {
	const result = await reader("complete").read("u", {
		assetFamilyIds: [familyId],
		projectId,
	});
	if (result?.status !== "resolved") {
		throw new Error("expected a resolved source");
	}
	const { source } = result;
	expect(source.context).toEqual({ revisionId: "ctx-9", revisionNumber: 9 });
	expect(source.blockers).toEqual([]);
	expect(source.families[0]).toMatchObject({
		assetFamilyName: "Hero",
		profileContractRevisionIds: [],
		requiredSet: { revisionId: "rs-1", revisionNumber: 2 },
		selections: [{ assetVersionIds: ["av-1"], itemId: "idle" }],
	});
	expect(source.assetVersions[0]?.sha256).toBe("a".repeat(64));
	expect(source.unitVersions.map((unit) => unit.id)).toEqual(["uv-1"]);
	expect(source.rights).toEqual([
		{
			assetRecordId: "rec-1",
			rightsRecordId: "rr-2",
			state: "documented",
			versionNumber: 2,
		},
	]);
});

test("a required item that is not complete is a blocker, not a skipped file", async () => {
	const result = await reader("incomplete").read("u", {
		assetFamilyIds: [familyId],
		projectId,
	});
	if (result?.status !== "resolved") {
		throw new Error("expected a resolved source");
	}
	expect(result.source.blockers).toEqual([
		{ assetFamilyId: familyId, codes: ["quality"], itemId: "idle" },
	]);
	expect(result.source.families[0]?.selections).toEqual([]);
});

test("a family without an active Required Set is unavailable", async () => {
	expect(
		await reader("complete", false).read("u", {
			assetFamilyIds: [familyId],
			projectId,
		})
	).toEqual({ assetFamilyIds: [familyId], status: "family_unavailable" });
});
