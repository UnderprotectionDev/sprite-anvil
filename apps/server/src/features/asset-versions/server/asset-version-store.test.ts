import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionReviewEvents,
	assetVersions,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { project } from "@sprite-anvil/db/schema/project";
import { createAssetVersionStore } from "./asset-version-store";

const projectId = "4a520683-c7c7-4903-9858-0b4340a22e19";
const assetFamilyId = "4c520683-c7c7-4903-9858-0b4340a22e19";
const assetRecordId = "f48ae2c1-d802-4134-923d-80c8a47e60f9";
const versionId = "6c520683-c7c7-4903-9858-0b4340a22e19";
const userId = "asset-version-store-user";

function createDatabaseHarness(
	includeSourceVersion = false,
	sourceUnitType?: "frame" | "direction" | "tile" | "state"
) {
	const createdAt = new Date("2026-09-25T09:00:00.000Z");
	const versionRow = {
		id: versionId,
		projectId,
		assetFamilyId,
		assetRecordId,
		versionNumber: 1,
		fileName: "asset.png",
		objectKey: `projects/${projectId}/asset-records/${assetRecordId}/versions/${versionId}`,
		contentType: "image/png" as const,
		sourceImageWidth: null,
		sourceImageHeight: null,
		sourceKind: "unknown" as const,
		byteSize: 4,
		sha256: "a".repeat(64),
		contentDigest: "a".repeat(64),
		integrityVerified: true,
		idempotencyKey: "asset-version-store-key",
		createdByUserId: userId,
		createdAt,
	};
	const reviewEventRow = {
		id: "7c520683-c7c7-4903-9858-0b4340a22e19",
		projectId,
		assetFamilyId,
		assetRecordId,
		versionId,
		decision: "candidate" as const,
		rationale: null,
		createdByUserId: userId,
		createdAt,
	};
	let assetVersionLimitCount = 0;
	let batchQueryCount = 0;
	let transactionCount = 0;
	let insertedUnitVersionValues: unknown;
	const sourceVersionRow = {
		...versionRow,
		id: "8c520683-c7c7-4903-9858-0b4340a22e19",
		versionNumber: 1,
		idempotencyKey: "source-asset-version",
	};
	const unitVersionRow = {
		id: "9c520683-c7c7-4903-9858-0b4340a22e19",
		projectId,
		assetRecordId,
		assetVersionId: versionId,
		sourceAssetVersionId: sourceVersionRow.id,
		unitType: "frame" as const,
		unitKey: "attack/frame-3",
		versionNumber: 1,
		createdByUserId: userId,
		createdAt,
	};
	const sourceUnitVersionRow = sourceUnitType
		? {
				...unitVersionRow,
				id: "source-unit-version",
				assetVersionId: sourceVersionRow.id,
				unitType: sourceUnitType,
				unitKey: "north",
				versionNumber: 1,
			}
		: null;
	const assetVersionRows = includeSourceVersion ? [sourceVersionRow] : [];
	const reviewRows: (typeof reviewEventRow)[] = [];
	const unitVersionRows: (typeof unitVersionRow)[] = [];

	const database = {
		select: () => {
			let selectedTable: unknown;
			let isJoinedAssetVersionQuery = false;
			return {
				from(table: unknown) {
					selectedTable = table;
					return this;
				},
				innerJoin() {
					isJoinedAssetVersionQuery = true;
					return this;
				},
				where() {
					return this;
				},
				orderBy() {
					if (selectedTable === assetVersions && isJoinedAssetVersionQuery) {
						return Promise.resolve(
							assetVersionRows.map((version) => ({ version, assetFamilyId }))
						);
					}
					if (selectedTable === assetVersionReviewEvents) {
						return Promise.resolve(reviewRows);
					}
					if (selectedTable === assetFamilyCanonicalDesigns) {
						return Promise.resolve([]);
					}
					if (selectedTable === unitVersions) {
						return Promise.resolve(unitVersionRows);
					}
					return Promise.resolve([]);
				},
				limit() {
					if (selectedTable === project) {
						return Promise.resolve([
							{
								id: projectId,
								name: "Project X",
								ownerUserId: userId,
								previewKey: null,
								createdAt,
							},
						]);
					}
					if (selectedTable === assetRecords) {
						return Promise.resolve([{ id: assetRecordId, assetFamilyId }]);
					}
					if (selectedTable === assetVersions) {
						assetVersionLimitCount += 1;
						return Promise.resolve(
							includeSourceVersion && assetVersionLimitCount === 1
								? [sourceVersionRow]
								: []
						);
					}
					if (selectedTable === unitVersions) {
						return Promise.resolve(
							sourceUnitVersionRow ? [sourceUnitVersionRow] : []
						);
					}
					return Promise.resolve([]);
				},
			};
		},
		insert: (table: unknown) => {
			let insertValues: unknown;
			const query = {
				table,
				get values() {
					return insertValues;
				},
			};
			const builder = {
				values(values: unknown) {
					insertValues = values;
					return builder;
				},
				returning() {
					return query;
				},
			};
			return builder;
		},
		execute: () => ({ kind: "advisory-lock" }),
		batch(queries: unknown[]) {
			batchQueryCount = queries.length;
			const versionInsert = queries.find(
				(query) =>
					query !== null &&
					typeof query === "object" &&
					Reflect.get(query, "table") === assetVersions
			);
			const savedVersionRow = {
				...versionRow,
				...(versionInsert ? Reflect.get(versionInsert, "values") : {}),
				versionNumber: 1,
			};
			assetVersionRows.push(savedVersionRow);
			reviewRows.push(reviewEventRow);
			const unitVersionInsert = queries.find(
				(query) =>
					query !== null &&
					typeof query === "object" &&
					Reflect.get(query, "table") === unitVersions
			);
			if (unitVersionInsert) {
				insertedUnitVersionValues = Reflect.get(unitVersionInsert, "values");
				unitVersionRows.push(unitVersionRow);
				return [
					[],
					[savedVersionRow],
					[reviewEventRow],
					[{}],
					[unitVersionRow],
				];
			}
			return [[], [savedVersionRow], [reviewEventRow], [{}]];
		},
		transaction() {
			transactionCount += 1;
			throw new Error("No transactions support in neon-http driver");
		},
	} as unknown as Database;

	return {
		database,
		getBatchQueryCount: () => batchQueryCount,
		getTransactionCount: () => transactionCount,
		getInsertedUnitVersionValues: () => insertedUnitVersionValues,
	};
}

test("creates a candidate Asset Version with a Review Event using the Neon batch API", async () => {
	const database = createDatabaseHarness();
	const store = createAssetVersionStore(database.database);

	const version = await store.createCandidateVersion(userId, {
		id: versionId,
		projectId,
		assetFamilyId,
		assetRecordId,
		fileName: "asset.png",
		objectKey: `projects/${projectId}/asset-records/${assetRecordId}/versions/${versionId}`,
		contentType: "image/png",
		contentLength: 4,
		contentDigest: "a".repeat(64),
		integrityVerified: true,
		idempotencyKey: "asset-version-store-key",
	});

	expect(version).toMatchObject({
		kind: "created",
		version: {
			id: versionId,
			versionNumber: 1,
			reviewDisposition: "candidate",
			reviewEvents: [expect.objectContaining({ type: "candidate" })],
		},
	});
	expect(database.getBatchQueryCount()).toBe(4);
	expect(database.getTransactionCount()).toBe(0);
});

test("creates a corrected Unit Version atomically with its new Candidate Version", async () => {
	const database = createDatabaseHarness(true);
	const store = createAssetVersionStore(database.database);

	const result = await store.createCandidateVersion(userId, {
		id: versionId,
		projectId,
		assetFamilyId,
		assetRecordId,
		fileName: "attack-frame-3.png",
		objectKey: `projects/${projectId}/asset-records/${assetRecordId}/versions/${versionId}`,
		contentType: "image/png",
		contentLength: 4,
		contentDigest: "a".repeat(64),
		integrityVerified: true,
		idempotencyKey: "unit-version-store-key",
		unitCorrection: {
			sourceAssetVersionId: "8c520683-c7c7-4903-9858-0b4340a22e19",
			unitType: "frame",
			unitKey: "attack/frame-3",
		},
	});

	expect(result).toMatchObject({
		kind: "created",
		version: {
			id: versionId,
			productionEvidence: {
				evidenceLevel: "unknown",
				sourceKind: "derived",
			},
			reviewDisposition: "candidate",
		},
		unitVersion: {
			assetRecordId,
			assetVersionId: versionId,
			sourceAssetVersionId: "8c520683-c7c7-4903-9858-0b4340a22e19",
			unitType: "frame",
			unitKey: "attack/frame-3",
			versionNumber: 1,
		},
	});
	expect(database.getBatchQueryCount()).toBe(5);
	expect(database.getTransactionCount()).toBe(0);
	expect(database.getInsertedUnitVersionValues()).toMatchObject({
		projectId,
		assetRecordId,
		assetVersionId: versionId,
		sourceAssetVersionId: "8c520683-c7c7-4903-9858-0b4340a22e19",
		unitType: "frame",
		unitKey: "attack/frame-3",
	});
	const catalog = await store.list(userId, projectId);
	expect(catalog?.assetVersions.map((version) => version.id)).toContain(
		versionId
	);
	expect(
		catalog?.assetVersions.find((version) => version.id === versionId)
			?.productionEvidence
	).toMatchObject({
		evidenceLevel: "unknown",
		sourceKind: "derived",
	});
	expect(catalog?.unitVersions).toEqual([
		expect.objectContaining({
			assetVersionId: versionId,
			sourceAssetVersionId: "8c520683-c7c7-4903-9858-0b4340a22e19",
			unitType: "frame",
			unitKey: "attack/frame-3",
			versionNumber: 1,
		}),
	]);
});

test("refuses to correct a different Unit Version from the selected source", async () => {
	const database = createDatabaseHarness(true, "direction");
	const store = createAssetVersionStore(database.database);

	const result = await store.createCandidateVersion(userId, {
		id: versionId,
		projectId,
		assetFamilyId,
		assetRecordId,
		fileName: "attack-frame-3.png",
		objectKey: `projects/${projectId}/asset-records/${assetRecordId}/versions/${versionId}`,
		contentType: "image/png",
		contentLength: 4,
		contentDigest: "a".repeat(64),
		integrityVerified: true,
		idempotencyKey: "unit-version-source-mismatch",
		unitCorrection: {
			sourceAssetVersionId: "8c520683-c7c7-4903-9858-0b4340a22e19",
			unitType: "frame",
			unitKey: "attack/frame-3",
		},
	});

	expect(result).toEqual({ kind: "invalid-unit-source" });
	expect(database.getBatchQueryCount()).toBe(0);
});
