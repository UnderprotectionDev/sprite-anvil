import { expect, test } from "bun:test";
import {
	RecordIntegrityError,
	RetryablePublicationError,
} from "@sprite-anvil/api/record-publication";
import {
	publishAssetVersionReviewEvent,
	publishCompositeVersionReviewEvent,
	recordAssetVersionReviewEvent,
} from "../review-event-publication";
import { fakeReviewEventDb } from "./review-event-fake-db";

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

test("publishes a Review Event as one guarded, verified Serializable statement and returns the persisted record", async () => {
	const { db, transactions } = fakeReviewEventDb({
		inserted: [{ id: "event-1" }],
		rows: [persistedAssetRow],
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
	// The same statement checks the stored row, so a failed check rolls the write back.
	expect(statement?.sql).toContain("length(id) / 0");
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
	const { db } = fakeReviewEventDb({ inserted: [], rows: [persistedAssetRow] });
	expect(await publishAssetVersionReviewEvent(db, assetInput)).toBeNull();
});

test("a serialization failure is retryable, not a stale-state conflict, and other failures rethrow", async () => {
	const conflict = Object.assign(new Error("serialization"), { code: "40001" });
	await expect(
		publishAssetVersionReviewEvent(
			fakeReviewEventDb({ rows: [], transactionError: conflict }).db,
			assetInput
		)
	).rejects.toBeInstanceOf(RetryablePublicationError);
	await expect(
		publishAssetVersionReviewEvent(
			fakeReviewEventDb({
				rows: [],
				transactionError: new Error("connection reset"),
			}).db,
			assetInput
		)
	).rejects.toThrow("connection reset");
});

test("a duplicate id that cannot be read back is retryable too", async () => {
	const duplicate = Object.assign(new Error("duplicate"), { code: "23505" });
	await expect(
		publishAssetVersionReviewEvent(
			fakeReviewEventDb({ rows: [], transactionError: duplicate }).db,
			assetInput
		)
	).rejects.toBeInstanceOf(RetryablePublicationError);
});

test("a failed in-statement check surfaces as an integrity failure with nothing written", async () => {
	const failed = Object.assign(new Error("division by zero"), {
		code: "22012",
	});
	await expect(
		publishAssetVersionReviewEvent(
			fakeReviewEventDb({ rows: [], transactionError: failed }).db,
			assetInput
		)
	).rejects.toBeInstanceOf(RecordIntegrityError);
});

test("does not report success when the written record cannot be re-read", async () => {
	const { db } = fakeReviewEventDb({ inserted: [{ id: "event-1" }], rows: [] });
	await expect(publishAssetVersionReviewEvent(db, assetInput)).rejects.toThrow(
		"could not be re-read"
	);
});

test("does not report success when the re-read record's content digest differs, and never deletes the append-only record", async () => {
	// The fake has no delete: an attempted withdrawal would fail the test with a TypeError.
	const results = await Promise.allSettled(
		[
			{ decision: "rejected" },
			{ rationale: "Other." },
			{ createdByUserId: "user-2" },
			{ versionId: "version-9" },
			{ assetRecordId: "record-9" },
		].map((changed) =>
			publishAssetVersionReviewEvent(
				fakeReviewEventDb({
					inserted: [{ id: "event-1" }],
					rows: [{ ...persistedAssetRow, ...changed }],
				}).db,
				assetInput
			)
		)
	);
	for (const result of results) {
		expect(result.status).toBe("rejected");
		expect(String((result as PromiseRejectedResult).reason)).toContain(
			"does not match"
		);
	}
});

test("publishes a Composite Version Review Event through the same guarded statement", async () => {
	const { db, transactions } = fakeReviewEventDb({
		inserted: [{ id: "composite-event-1" }],
		rows: [
			{
				id: "composite-event-1",
				projectId: "project-1",
				assetRecordId: "record-1",
				compositeVersionId: "composite-1",
				decision: "rejected",
				rationale: "Seams visible.",
				createdByUserId: "user-1",
				createdAt: new Date("2026-11-06T11:00:00.000Z"),
			},
		],
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

test("recording passes the latest event it read as the write guard", async () => {
	const { db, transactions } = fakeReviewEventDb({
		latest: { decision: "candidate", id: "event-0" },
		rows: [persistedAssetRow],
	});
	await recordAssetVersionReviewEvent(db, {
		...assetInput,
		expectedLatestEventId: undefined,
	});
	expect(transactions[0]?.statements[0]?.params).toContain("event-0");
});

test("recording the decision that is already current writes nothing", async () => {
	const { db, transactions } = fakeReviewEventDb({
		latest: { decision: "approved", id: "event-0" },
		rows: [],
	});
	expect(await recordAssetVersionReviewEvent(db, assetInput)).toBeNull();
	expect(transactions).toHaveLength(0);
});

test("a blocked decision is returned and writes nothing", async () => {
	const { db, transactions } = fakeReviewEventDb({
		latest: { decision: "candidate", id: "event-0" },
		rows: [],
	});
	const blocked = { blockers: ["x"], kind: "approval-blocked" as const };
	expect(
		await recordAssetVersionReviewEvent(db, assetInput, () =>
			Promise.resolve(blocked)
		)
	).toBe(blocked);
	expect(transactions).toHaveLength(0);
});
