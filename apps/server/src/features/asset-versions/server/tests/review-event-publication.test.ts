import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import {
	publishAssetVersionReviewEvent,
	publishCompositeVersionReviewEvent,
} from "../review-event-publication";

interface Statement {
	params: unknown[];
	sql: string;
}

interface Harness {
	db: Database;
	transactions: { options: unknown; statements: Statement[] }[];
}

function harness(options: {
	inserted: { id: string }[];
	persisted: Record<string, unknown> | null;
	transactionError?: Error;
}): Harness {
	const transactions: Harness["transactions"] = [];
	const db = {
		$client: {
			query: (sql: string, params: unknown[]) => ({ params, sql }),
			transaction: (statements: Statement[], transactionOptions: unknown) => {
				transactions.push({ options: transactionOptions, statements });
				if (options.transactionError) {
					return Promise.reject(options.transactionError);
				}
				return Promise.resolve([{ rows: options.inserted }]);
			},
		},
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () =>
						Promise.resolve(options.persisted ? [options.persisted] : []),
				}),
			}),
		}),
	} as unknown as Database;
	return { db, transactions };
}

const assetInput = {
	userId: "user-1",
	projectId: "project-1",
	assetRecordId: "record-1",
	versionId: "version-1",
	decision: "approved" as const,
	rationale: "  Ready.  ",
	expectedLatestEventId: "event-0",
};

const persistedAssetRow = {
	id: "event-1",
	projectId: "project-1",
	assetRecordId: "record-1",
	versionId: "version-1",
	decision: "approved",
	rationale: "Ready.",
	createdByUserId: "user-1",
	createdAt: new Date("2026-11-06T10:00:00.000Z"),
};

test("publishes a Review Event as one guarded Serializable statement and returns the persisted record", async () => {
	const { db, transactions } = harness({
		inserted: [{ id: "event-1" }],
		persisted: persistedAssetRow,
	});
	const event = await publishAssetVersionReviewEvent(db, assetInput);

	expect(transactions).toHaveLength(1);
	expect(transactions[0]?.statements).toHaveLength(1);
	expect(transactions[0]?.options).toMatchObject({
		isolationLevel: "Serializable",
	});
	const statement = transactions[0]?.statements[0];
	expect(statement?.sql).toContain("INSERT INTO asset_version_review_events");
	expect(statement?.sql).toContain("IS NOT DISTINCT FROM");
	expect(statement?.params).toContain("event-0");
	expect(statement?.params).toContain("Ready.");
	expect(event).toEqual({
		id: "event-1",
		assetVersionId: "version-1",
		type: "approved",
		rationale: "Ready.",
		createdAt: "2026-11-06T10:00:00.000Z",
	});
});

test("publishes nothing and reports a conflict when the guard rejects the write", async () => {
	const { db } = harness({ inserted: [], persisted: persistedAssetRow });
	expect(await publishAssetVersionReviewEvent(db, assetInput)).toBeNull();
});

test("treats a Serializable conflict as a lost race and rethrows other failures", async () => {
	const conflict = Object.assign(new Error("serialization"), { code: "40001" });
	expect(
		await publishAssetVersionReviewEvent(
			harness({ inserted: [], persisted: null, transactionError: conflict }).db,
			assetInput
		)
	).toBeNull();
	await expect(
		publishAssetVersionReviewEvent(
			harness({
				inserted: [],
				persisted: null,
				transactionError: new Error("connection reset"),
			}).db,
			assetInput
		)
	).rejects.toThrow("connection reset");
});

test("does not report success when the written record cannot be re-read", async () => {
	const { db } = harness({ inserted: [{ id: "event-1" }], persisted: null });
	await expect(publishAssetVersionReviewEvent(db, assetInput)).rejects.toThrow(
		"could not be re-read"
	);
});

test("does not report success when the re-read record differs from what was published", async () => {
	const { db } = harness({
		inserted: [{ id: "event-1" }],
		persisted: { ...persistedAssetRow, decision: "rejected" },
	});
	await expect(publishAssetVersionReviewEvent(db, assetInput)).rejects.toThrow(
		"does not match"
	);
});

test("publishes a Composite Version Review Event through the same guarded statement", async () => {
	const { db, transactions } = harness({
		inserted: [{ id: "composite-event-1" }],
		persisted: {
			id: "composite-event-1",
			projectId: "project-1",
			assetRecordId: "record-1",
			compositeVersionId: "composite-1",
			decision: "rejected",
			rationale: "Seams visible.",
			createdByUserId: "user-1",
			createdAt: new Date("2026-11-06T11:00:00.000Z"),
		},
	});
	const event = await publishCompositeVersionReviewEvent(db, {
		userId: "user-1",
		projectId: "project-1",
		assetRecordId: "record-1",
		compositeVersionId: "composite-1",
		decision: "rejected",
		rationale: "Seams visible.",
		expectedLatestEventId: null,
	});
	expect(transactions[0]?.statements).toHaveLength(1);
	expect(transactions[0]?.statements[0]?.sql).toContain(
		"INSERT INTO composite_version_review_events"
	);
	expect(event).toEqual({
		id: "composite-event-1",
		compositeVersionId: "composite-1",
		type: "rejected",
		rationale: "Seams visible.",
		createdAt: "2026-11-06T11:00:00.000Z",
	});
});
