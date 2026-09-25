import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { project } from "@sprite-anvil/db/schema/project";
import { createAssetVersionStore } from "./asset-version-store";

const projectId = "4a520683-c7c7-4903-9858-0b4340a22e19";
const assetFamilyId = "4c520683-c7c7-4903-9858-0b4340a22e19";
const assetRecordId = "f48ae2c1-d802-4134-923d-80c8a47e60f9";
const versionId = "6c520683-c7c7-4903-9858-0b4340a22e19";
const userId = "asset-version-store-user";

function createDatabaseHarness() {
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
	let selectedTable: unknown;
	let batchQueryCount = 0;
	let transactionCount = 0;

	const database = {
		select: () => ({
			from(table: unknown) {
				selectedTable = table;
				return this;
			},
			where() {
				return this;
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
				return Promise.resolve([]);
			},
		}),
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
			return [[], [versionRow], [reviewEventRow], [{}]];
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
