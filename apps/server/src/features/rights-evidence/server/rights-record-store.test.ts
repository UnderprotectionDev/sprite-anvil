import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { referenceBoardImages } from "@sprite-anvil/db/schema/reference-production";
import { rightsRecords } from "@sprite-anvil/db/schema/rights-records";
import { createRightsRecordStore } from "./rights-record-store";

const testProjectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const testAssetRecordId = "a7301990-3d79-49c8-887a-c1fa9a468f85";
const userId = "rights-record-store-user";

function createDatabaseHarness(
	availability: "available" | "erased" = "available",
	referenceIds: string[] = []
) {
	const records: Record<string, unknown>[] = [];
	function queryParameterValues(value: unknown): unknown[] {
		if (Array.isArray(value)) {
			return value.flatMap(queryParameterValues);
		}
		if (!value || typeof value !== "object") {
			return [];
		}
		const chunk = value as {
			constructor?: { name?: string };
			queryChunks?: unknown[];
			value?: unknown;
		};
		if (chunk.constructor?.name === "Param") {
			return [chunk.value];
		}
		return chunk.queryChunks?.flatMap(queryParameterValues) ?? [];
	}
	const database = {
		select(selection?: Record<string, unknown>) {
			let selectedTable: unknown;
			let selectedParameters: unknown[] = [];
			const query = {
				from(table: unknown) {
					selectedTable = table;
					return this;
				},
				innerJoin() {
					return this;
				},
				where(condition: unknown) {
					selectedParameters = queryParameterValues(condition);
					return this;
				},
				orderBy() {
					if (selectedTable === rightsRecords && !selection) {
						return Promise.resolve(
							records
								.filter((record) =>
									matchesRightsRecordTarget(record, selectedParameters)
								)
								.sort(
									(left, right) =>
										Number(right.versionNumber) - Number(left.versionNumber)
								)
						);
					}
					return this;
				},
				limit(count: number) {
					if (selectedTable === assetRecords) {
						const [
							requestedProjectId,
							requestedAssetRecordId,
							requestedUserId,
						] = selectedParameters;
						return Promise.resolve(
							requestedProjectId === testProjectId &&
								requestedAssetRecordId === testAssetRecordId &&
								requestedUserId === userId
								? [{ id: testAssetRecordId, availability }]
								: []
						);
					}
					if (selectedTable === referenceBoardImages) {
						const [requestedProjectId, requestedAssetRecordId, referenceId] =
							selectedParameters;
						return Promise.resolve(
							requestedProjectId === testProjectId &&
								requestedAssetRecordId === testAssetRecordId &&
								referenceIds.includes(String(referenceId))
								? [{ id: referenceId }]
								: []
						);
					}
					if (selectedTable === rightsRecords && selection?.evidenceFile) {
						const [sourceId, ...targetParameters] = selectedParameters;
						const sourceRecord = records.find(
							(record) =>
								record.id === sourceId &&
								matchesRightsRecordTarget(record, targetParameters) &&
								record.evidenceFile
						);
						return Promise.resolve(
							sourceRecord ? [{ evidenceFile: sourceRecord.evidenceFile }] : []
						);
					}
					if (selectedTable === rightsRecords && selection?.versionNumber) {
						return Promise.resolve(
							records
								.filter((record) =>
									matchesRightsRecordTarget(record, selectedParameters)
								)
								.sort(
									(left, right) =>
										Number(right.versionNumber) - Number(left.versionNumber)
								)
								.slice(0, count)
								.map((record) => ({ versionNumber: record.versionNumber }))
						);
					}
					return Promise.resolve([]);
				},
			};
			return query;
		},
		insert(table: unknown) {
			let values: Record<string, unknown>;
			const builder = {
				values(input: Record<string, unknown>) {
					values = input;
					return builder;
				},
				onConflictDoNothing() {
					return builder;
				},
				returning() {
					if (table !== rightsRecords) {
						return Promise.resolve([]);
					}
					const duplicate = records.some(
						(candidateRecord) =>
							candidateRecord.id === values.id ||
							(candidateRecord.projectId === values.projectId &&
								candidateRecord.assetRecordId === values.assetRecordId &&
								(candidateRecord.referenceId ?? null) ===
									(values.referenceId ?? null) &&
								candidateRecord.versionNumber === values.versionNumber)
					);
					if (duplicate) {
						return Promise.resolve([]);
					}
					const savedRecord = { ...values, createdAt: new Date() };
					records.push(savedRecord);
					return Promise.resolve([savedRecord]);
				},
			};
			return builder;
		},
	} as unknown as Database;

	return { database, records };
}

function matchesRightsRecordTarget(
	record: Record<string, unknown>,
	parameters: unknown[]
) {
	const [projectId, assetRecordId, referenceId] = parameters;
	return (
		record.projectId === projectId &&
		record.assetRecordId === assetRecordId &&
		(record.referenceId ?? null) ===
			(parameters.length > 2 ? referenceId : null)
	);
}

const baseInput = {
	assetRecordId: testAssetRecordId,
	assertedScope: "Paid game releases",
	evidence: "License reference",
	id: "3d9d07a4-37af-43d6-8583-e2256baf0a58",
	projectId: testProjectId,
	restrictions: "No resale of source files",
	rightsHolderOrProvider: "Example Studio",
	source: "https://example.test/source",
	state: "documented" as const,
	uncertainty: "Merchandising is not covered",
};

test("creates and rereads immutable Rights Record revisions", async () => {
	const { database } = createDatabaseHarness();
	const store = createRightsRecordStore(database);

	const first = await store.createRevision(userId, baseInput);
	const second = await store.createRevision(userId, {
		...baseInput,
		id: "5240db4d-6cb5-4962-b013-cadfffb6da02",
		state: "restricted",
		uncertainty: "Commercial use is limited to games",
	});
	const history = await store.list(
		userId,
		testProjectId,
		testAssetRecordId,
		null
	);

	expect(first).toMatchObject({ ok: true, record: { versionNumber: 1 } });
	expect(second).toMatchObject({ ok: true, record: { versionNumber: 2 } });
	expect(history?.map((record) => record.versionNumber)).toEqual([2, 1]);
	expect(history?.[1]).toMatchObject({
		id: baseInput.id,
		state: "documented",
		uncertainty: "Merchandising is not covered",
	});
});

test("carries a prior evidence file into a new revision by source record id", async () => {
	const { database, records } = createDatabaseHarness();
	const store = createRightsRecordStore(database);
	const evidenceFile = {
		contentLength: 12,
		fileName: "license.pdf",
		objectKey: `projects/${testProjectId}/asset-records/${testAssetRecordId}/rights-records/${baseInput.id}/evidence/${"a".repeat(64)}`,
		sha256: "a".repeat(64),
		sourceContentType: "application/pdf",
	};

	const first = await store.createRevisionWithEvidenceFile(userId, {
		...baseInput,
		evidenceFile,
	});
	const second = await store.createRevision(userId, {
		...baseInput,
		evidence: null,
		evidenceFileSourceRecordId: baseInput.id,
		id: "5240db4d-6cb5-4962-b013-cadfffb6da02",
		uncertainty: "Updated uncertainty",
	});

	expect(first).toMatchObject({
		ok: true,
		record: {
			evidenceFile: expect.objectContaining({ fileName: "license.pdf" }),
		},
	});
	expect(second).toMatchObject({
		ok: true,
		record: {
			evidence: null,
			evidenceFile: {
				contentLength: 12,
				fileName: "license.pdf",
				sha256: "a".repeat(64),
				sourceContentType: "application/pdf",
			},
			versionNumber: 2,
		},
	});
	expect(records[1]?.evidenceFile).toEqual(evidenceFile);
});

test("does not carry an evidence file from another Asset Record", async () => {
	const { database, records } = createDatabaseHarness();
	records.push({
		assetRecordId: "77dbb102-ea94-4d86-9c9f-04595b1475dc",
		evidenceFile: {
			contentLength: 12,
			fileName: "other-license.pdf",
			objectKey: "projects/other/evidence",
			sha256: "b".repeat(64),
			sourceContentType: "application/pdf",
		},
		id: "6d1d8eb0-cc77-49ba-8edf-e877a319767e",
		projectId: "b3f41ba9-09bc-41d2-bfb5-335d4a82c9ce",
	});
	const store = createRightsRecordStore(database);

	expect(
		await store.createRevision(userId, {
			...baseInput,
			evidence: null,
			evidenceFileSourceRecordId: "6d1d8eb0-cc77-49ba-8edf-e877a319767e",
		})
	).toEqual({ ok: false, reason: "not_found" });
	expect(records).toHaveLength(1);
});

test("carries evidence only between revisions of the same reference image", async () => {
	const referenceId = "fcd2bb54-60fd-4555-bc6f-a30a1c2e4dd4";
	const otherReferenceId = "f0a9b454-2053-4588-922f-524453f36c9b";
	const { database, records } = createDatabaseHarness("available", [
		referenceId,
		otherReferenceId,
	]);
	const store = createRightsRecordStore(database);
	const evidenceFile = {
		contentLength: 12,
		fileName: "reference-license.pdf",
		objectKey: `projects/${testProjectId}/asset-records/${testAssetRecordId}/rights-records/${baseInput.id}/evidence/${"c".repeat(64)}`,
		sha256: "c".repeat(64),
		sourceContentType: "application/pdf",
	};
	const first = await store.createRevisionWithEvidenceFile(userId, {
		...baseInput,
		evidence: null,
		id: baseInput.id,
		referenceId,
		evidenceFile,
	});
	const next = await store.createRevision(userId, {
		...baseInput,
		evidence: null,
		evidenceFileSourceRecordId: baseInput.id,
		id: "5240db4d-6cb5-4962-b013-cadfffb6da02",
		referenceId,
		uncertainty: "Reference license details updated",
	});
	const crossReference = await store.createRevision(userId, {
		...baseInput,
		evidence: null,
		evidenceFileSourceRecordId: baseInput.id,
		id: "699e7fa9-9e8f-4530-b446-e9ab2766d39e",
		referenceId: otherReferenceId,
	});

	expect(first).toMatchObject({
		ok: true,
		record: { referenceId, versionNumber: 1 },
	});
	expect(next).toMatchObject({
		ok: true,
		record: {
			evidenceFile: expect.objectContaining({
				fileName: "reference-license.pdf",
			}),
			referenceId,
			versionNumber: 2,
		},
	});
	expect(crossReference).toEqual({ ok: false, reason: "not_found" });
	expect(records).toHaveLength(2);
	expect(records[0]?.evidenceFile).toEqual(evidenceFile);
	expect(records[1]?.evidenceFile).toEqual(evidenceFile);
});

test("creates separate immutable Rights Record history for a reference image", async () => {
	const referenceId = "fcd2bb54-60fd-4555-bc6f-a30a1c2e4dd4";
	const secondReferenceId = "f0a9b454-2053-4588-922f-524453f36c9b";
	const { database } = createDatabaseHarness("available", [
		referenceId,
		secondReferenceId,
	]);
	const store = createRightsRecordStore(database);
	const assetRecord = await store.createRevision(userId, baseInput);
	const record = await store.createRevision(userId, {
		...baseInput,
		id: "fc9bba08-b426-4b51-a4cf-2fd314d825da",
		referenceId,
	});
	const nextReferenceRevision = await store.createRevision(userId, {
		...baseInput,
		id: "699e7fa9-9e8f-4530-b446-e9ab2766d39e",
		referenceId,
		uncertainty: "Reference source details updated",
	});
	const otherReferenceRevision = await store.createRevision(userId, {
		...baseInput,
		id: "3924d92d-29e9-458d-87c0-15e5d3c5c63d",
		referenceId: secondReferenceId,
	});

	expect(assetRecord).toMatchObject({ ok: true, record: { versionNumber: 1 } });
	expect(record).toMatchObject({
		ok: true,
		record: {
			assetRecordId: testAssetRecordId,
			referenceId,
			versionNumber: 1,
		},
	});
	expect(nextReferenceRevision).toMatchObject({
		ok: true,
		record: { referenceId, versionNumber: 2 },
	});
	expect(otherReferenceRevision).toMatchObject({
		ok: true,
		record: { referenceId: secondReferenceId, versionNumber: 1 },
	});
	const history = await store.list(
		userId,
		testProjectId,
		testAssetRecordId,
		referenceId
	);
	expect(history?.map((item) => item.referenceId)).toEqual([
		referenceId,
		referenceId,
	]);
	expect(history?.map((item) => item.versionNumber)).toEqual([2, 1]);
	expect(
		(await store.list(userId, testProjectId, testAssetRecordId, null))?.map(
			(item) => item.referenceId
		)
	).toEqual([null]);
	expect(
		await store.list(
			userId,
			testProjectId,
			testAssetRecordId,
			"not-a-reference"
		)
	).toBeNull();
});

test("does not create or return Rights Record history for an erased Asset Record", async () => {
	const { database } = createDatabaseHarness("erased");
	const store = createRightsRecordStore(database);

	expect(await store.createRevision(userId, baseInput)).toEqual({
		ok: false,
		reason: "not_found",
	});
	expect(
		await store.list(userId, testProjectId, testAssetRecordId, null)
	).toBeNull();
});
