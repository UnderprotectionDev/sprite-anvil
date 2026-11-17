import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { getTableName } from "drizzle-orm";
import { insertArchiveHistory } from "../project-archive-history-materialization";
import type { StoredProjectArchiveRestoreRecord } from "../project-archive-restore-storage";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function restoreRecord(): StoredProjectArchiveRestoreRecord {
	return {
		files: [],
		ids: [],
		projectName: "Restored",
		restore: {
			archiveId: "archive",
			createdAt: new Date("2026-01-01T00:00:00Z"),
			createdByUserId: "owner",
			id: "restore",
			manifestDigest: "digest",
			requestDigest: "request",
			restoredProjectId: "restored",
			sourceProjectId: "source",
		},
		sections: [
			{
				group: "history",
				name: "generationPackages",
				digest: "d",
				sourceDigest: "d",
				recordCount: 1,
				records: [
					{
						id: "package",
						assetRecordId: "record",
						createdAt: "2026-01-01T00:00:00.000Z",
						snapshot: { instruction: "draw" },
					},
				],
			},
		],
	};
}

test("materializes archive generation packages as canonical rows under the restored project", async () => {
	const inserted: { table: string; rows: unknown[] }[] = [];
	const tx = {
		insert: (table: Parameters<typeof getTableName>[0]) => ({
			values: (rows: unknown[]) => {
				inserted.push({ table: getTableName(table), rows });
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveHistory(tx, restoreRecord());
	expect(inserted).toEqual([
		{
			table: "generation_packages",
			rows: [
				{
					id: "package",
					projectId: "restored",
					assetRecordId: "record",
					createdByUserId: "owner",
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					snapshot: { instruction: "draw" },
				},
			],
		},
	]);
});

test("rejects metadata whose Import Inbox source is absent before writing any history", async () => {
	const record = restoreRecord();
	record.sections.push({
		group: "history",
		name: "metadataProposals",
		digest: "d",
		sourceDigest: "d",
		recordCount: 1,
		records: [
			{
				id: "proposal",
				sourceEntryId: "missing",
				proposal: {},
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
	});
	let writes = 0;
	const tx = {
		insert: () => {
			writes += 1;
			throw new Error("unexpected write");
		},
	} as unknown as Tx;
	await expect(insertArchiveHistory(tx, record)).rejects.toThrow(
		"Import Inbox"
	);
	expect(writes).toBe(0);
});

test("refuses rights evidence when its archived file was not copied", async () => {
	const record = restoreRecord();
	record.sections.push({
		group: "history",
		name: "rightsRecords",
		digest: "d",
		sourceDigest: "d",
		recordCount: 1,
		records: [
			{
				id: "rights",
				assetRecordId: "record",
				referenceId: null,
				versionNumber: 1,
				state: "documented",
				assertedScope: null,
				evidence: null,
				evidenceFile: {
					byteSize: 3,
					contentType: "application/pdf",
					fileName: "rights.pdf",
					sha256: "a".repeat(64),
				},
				restrictions: null,
				rightsHolderOrProvider: null,
				source: null,
				uncertainty: null,
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
	});
	let writes = 0;
	const tx = {
		insert: () => {
			writes += 1;
			throw new Error("unexpected write");
		},
	} as unknown as Tx;
	await expect(insertArchiveHistory(tx, record)).rejects.toThrow(
		"rights evidence file"
	);
	expect(writes).toBe(0);
});

test("writes Required Set and review evidence in dependency order with their preserved payloads", async () => {
	const record = restoreRecord();
	const at = "2026-01-01T00:00:00.000Z";
	const section = (name: string, rows: unknown[]) => ({
		group: "history",
		name,
		digest: "d",
		sourceDigest: "d",
		recordCount: rows.length,
		records: rows,
	});
	record.sections.push(
		section("requiredSetRevisions", [
			{
				id: "revision",
				assetFamilyId: "family",
				revisionNumber: 1,
				items: [
					{
						id: "item",
						name: "Idle",
						kind: "animation",
						disposition: "required",
						assetRecordIds: ["record"],
					},
				],
				createdAt: at,
			},
		]),
		section("requiredSetHeads", [
			{
				id: "family",
				assetFamilyId: "family",
				activeRevisionId: "revision",
				updatedAt: at,
			},
		]),
		section("requiredSetActivations", [
			{
				id: "activation",
				assetFamilyId: "family",
				revisionId: "revision",
				activatedAt: at,
			},
		]),
		section("assetVersionReviews", [
			{
				id: "event",
				assetRecordId: "record",
				versionId: "version",
				decision: "approved",
				rationale: "reviewed",
				createdAt: at,
			},
		]),
		section("assetVersionQuality", [
			{
				id: "quality",
				versionId: "version",
				gate: "format_signature",
				result: "matched",
				sha256: "a".repeat(64),
				byteSize: 3,
				createdAt: at,
			},
		]),
		section("familyReadinessEvidence", [
			{
				id: "evidence",
				assetFamilyId: "family",
				revisionId: "revision",
				itemId: "item",
				kind: "quality",
				result: "passed",
				assetVersionIds: ["version"],
				profileContractRevisionIds: [],
				contextRevisionId: null,
				visualWorldId: "world",
				useContext: "game",
				canonicalDesignVersionId: null,
				ruleId: "rule",
				ruleClass: "integrity_gate",
				testId: null,
				usageTestContext: null,
				usageVariant: null,
				targetWidth: null,
				targetHeight: null,
				grayscaleReviewed: null,
				observedValue: null,
				unitVersionId: null,
				compositeVersionId: null,
				method: "manual",
				rationale: "checked",
				createdAt: at,
			},
		])
	);
	const inserted: { table: string; rows: Record<string, unknown>[] }[] = [];
	const tx = {
		insert: (table: Parameters<typeof getTableName>[0]) => ({
			values: (rows: Record<string, unknown>[]) => {
				inserted.push({ table: getTableName(table), rows });
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveHistory(tx, record);
	expect(inserted.map((entry) => entry.table)).toEqual([
		"family_required_set_revisions",
		"family_required_set_heads",
		"family_required_set_activations",
		"asset_version_review_events",
		"asset_version_quality_evidence",
		"family_readiness_evidence",
		"generation_packages",
	]);
	expect(
		inserted.find((entry) => entry.table === "family_readiness_evidence")
			?.rows[0]
	).toMatchObject({
		itemId: "item",
		assetVersionIds: ["version"],
		projectId: "restored",
		createdByUserId: "owner",
		rationale: "checked",
	});
});

test("preserves excluded Rights Record file metadata without inventing an object key", async () => {
	const { historySource } = await import("./project-archive-history-fixtures");
	const source = historySource();
	const rights = source.history.rightsRecords;
	const file = source.files.find(
		(item) => item.kind === "rights_evidence_file"
	);
	if (!file) {
		throw new Error("Missing fixture evidence");
	}
	const record = restoreRecord();
	record.sections = [
		{
			group: "history",
			name: "rightsRecords",
			digest: "d",
			sourceDigest: "d",
			recordCount: rights.length,
			records: rights,
		},
	];
	const { objectKey: _key, ...archivedFile } = file;
	record.files = [
		{
			...archivedFile,
			restoredId: file.sourceId,
			presence: "excluded",
			exclusionReason: "evidence_not_archived",
			objectKey: null,
		},
	];
	const inserted: Record<string, unknown>[][] = [];
	const tx = {
		insert: () => ({
			values: (rows: Record<string, unknown>[]) => {
				inserted.push(rows);
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveHistory(tx, record);
	expect(inserted[0]?.[0]?.evidenceFile).toMatchObject({
		objectKey: null,
		fileName: "licence.pdf",
		contentLength: 400_000,
		sha256: "f".repeat(64),
	});
});

test("batches large history sections without losing or reordering rows", async () => {
	const record = restoreRecord();
	const items = Array.from({ length: 1101 }, (_, index) => ({
		id: `package-${index}`,
		assetRecordId: "record",
		createdAt: "2026-01-01T00:00:00.000Z",
		snapshot: { index },
	}));
	record.sections[0] = {
		group: "history",
		name: "generationPackages",
		digest: "d",
		sourceDigest: "d",
		recordCount: items.length,
		records: items,
	};
	const batches: { id: string }[][] = [];
	const tx = {
		insert: () => ({
			values: (rows: { id: string }[]) => {
				batches.push(rows);
				return Promise.resolve();
			},
		}),
	} as unknown as Tx;
	await insertArchiveHistory(tx, record);
	expect(batches.map((batch) => batch.length)).toEqual([500, 500, 101]);
	expect(batches.flat().map((row) => row.id)).toEqual(
		items.map((row) => row.id)
	);
});
