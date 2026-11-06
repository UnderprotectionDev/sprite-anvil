import { expect, test } from "bun:test";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
} from "@sprite-anvil/api/record-publication";
import {
	publishAssetVersionReviewEvent,
	publishCompositeVersionReviewEvent,
	recordAssetVersionReviewEvent,
	replayAssetVersionReviewEvent,
	replayCompositeVersionReviewEvent,
} from "../review-event-publication";
import { fakeReviewEventDb } from "./review-event-fake-db";

const base = {
	assetRecordId: "record-1",
	decision: "approved" as const,
	expectedLatestEventId: null,
	idempotencyKey: "key-1",
	projectId: "project-1",
	rationale: "Ready.",
	userId: "user-1",
};
const assetInput = { ...base, versionId: "version-1" };
const compositeInput = { ...base, compositeVersionId: "composite-1" };

function compositeEventId() {
	return idempotentRecordId(
		{
			assetRecordId: "record-1",
			kind: "composite-version-review-event",
			projectId: "project-1",
			targetId: "composite-1",
			userId: "user-1",
		},
		"key-1"
	);
}

async function assetEventId() {
	return await idempotentRecordId(
		{
			assetRecordId: "record-1",
			kind: "asset-version-review-event",
			projectId: "project-1",
			targetId: "version-1",
			userId: "user-1",
		},
		"key-1"
	);
}

function assetRowBase(id: string) {
	return {
		assetRecordId: "record-1",
		createdAt: new Date("2026-11-06T10:00:00.000Z"),
		createdByUserId: "user-1",
		decision: "approved",
		id,
		projectId: "project-1",
		rationale: "Ready.",
		versionId: "version-1",
	};
}

async function assetRow(overrides: Record<string, unknown> = {}) {
	return { ...assetRowBase(await assetEventId()), ...overrides };
}

test("replaying a Review Event key returns the first record and writes nothing", async () => {
	const { db, transactions } = fakeReviewEventDb({ rows: [await assetRow()] });
	const event = await replayAssetVersionReviewEvent(db, assetInput);
	expect(event).toMatchObject({
		assetVersionId: "version-1",
		id: await assetEventId(),
		type: "approved",
	});
	expect(transactions).toHaveLength(0);
});

test("a first use of a Review Event key has nothing to replay", async () => {
	const { db } = fakeReviewEventDb({ rows: [] });
	expect(await replayAssetVersionReviewEvent(db, assetInput)).toBeNull();
	expect(
		await replayAssetVersionReviewEvent(db, {
			...assetInput,
			idempotencyKey: undefined,
		})
	).toBeNull();
});

test("a Review Event key reused with another decision, rationale or user is a conflict", async () => {
	const id = await assetEventId();
	const changes = [
		{ decision: "rejected" },
		{ rationale: "Different." },
		{ createdByUserId: "user-2" },
	];
	const results = await Promise.allSettled(
		changes.map((changed) =>
			replayAssetVersionReviewEvent(
				fakeReviewEventDb({ rows: [{ ...assetRowBase(id), ...changed }] }).db,
				assetInput
			)
		)
	);
	for (const result of results) {
		expect(result.status).toBe("rejected");
		expect(String((result as PromiseRejectedResult).reason)).toContain(
			"idempotency conflict"
		);
	}
});

test("publishing with a key writes the deterministic id", async () => {
	const id = await assetEventId();
	const { db, transactions } = fakeReviewEventDb({ rows: [await assetRow()] });
	const event = await publishAssetVersionReviewEvent(db, assetInput);
	expect(transactions).toHaveLength(1);
	expect(transactions[0]?.statements[0]?.params[0]).toBe(id);
	expect(event?.id).toBe(id);
});

test("a duplicate-key race resolves to the record the winner wrote", async () => {
	const duplicate = Object.assign(new Error("duplicate key"), {
		code: "23505",
	});
	const { db } = fakeReviewEventDb({
		transactionError: duplicate,
		rows: [await assetRow()],
	});
	const event = await publishAssetVersionReviewEvent(db, assetInput);
	expect(event?.id).toBe(await assetEventId());
});

test("an interrupted publication fails visibly and the retry yields exactly one record", async () => {
	// First attempt: the write lands but the re-read is lost.
	const lost = fakeReviewEventDb({ rows: [] });
	await expect(
		publishAssetVersionReviewEvent(lost.db, assetInput)
	).rejects.toThrow("could not be re-read");
	expect(lost.transactions).toHaveLength(1);

	// Retry with the same key: the persisted record is found and returned.
	const persisted = fakeReviewEventDb({ rows: [await assetRow()] });
	const replayed = await replayAssetVersionReviewEvent(
		persisted.db,
		assetInput
	);
	expect(replayed?.id).toBe(
		lost.transactions[0]?.statements[0]?.params[0] as string
	);
	expect(persisted.transactions).toHaveLength(0);
});

test("a Composite Version Review Event key replays and conflicts the same way", async () => {
	const id = await compositeEventId();
	const row = {
		assetRecordId: "record-1",
		compositeVersionId: "composite-1",
		createdAt: new Date("2026-11-06T10:00:00.000Z"),
		createdByUserId: "user-1",
		decision: "approved",
		id,
		projectId: "project-1",
		rationale: "Ready.",
	};
	const ok = fakeReviewEventDb({ rows: [row] });
	expect(
		(await replayCompositeVersionReviewEvent(ok.db, compositeInput))?.id
	).toBe(id);
	expect(ok.transactions).toHaveLength(0);
	await expect(
		replayCompositeVersionReviewEvent(
			fakeReviewEventDb({ rows: [{ ...row, decision: "rejected" }] }).db,
			compositeInput
		)
	).rejects.toThrow("idempotency conflict");
	const written = fakeReviewEventDb({ rows: [row] });
	await publishCompositeVersionReviewEvent(written.db, compositeInput);
	expect(written.transactions[0]?.statements[0]?.params[0]).toBe(id);
});

test("a replayed Review Event whose stored Asset Record differs is an integrity failure, not a success", async () => {
	const id = await assetEventId();
	await expect(
		replayAssetVersionReviewEvent(
			fakeReviewEventDb({
				rows: [{ ...assetRowBase(id), assetRecordId: "record-9" }],
			}).db,
			assetInput
		)
	).rejects.toBeInstanceOf(RecordIntegrityError);
	const compositeId = await compositeEventId();
	await expect(
		replayCompositeVersionReviewEvent(
			fakeReviewEventDb({
				rows: [
					{
						assetRecordId: "record-9",
						compositeVersionId: "composite-1",
						createdAt: new Date("2026-11-06T10:00:00.000Z"),
						createdByUserId: "user-1",
						decision: "approved",
						id: compositeId,
						projectId: "project-1",
						rationale: "Ready.",
					},
				],
			}).db,
			compositeInput
		)
	).rejects.toBeInstanceOf(RecordIntegrityError);
});

test("another member's same key derives another id", async () => {
	const mine = fakeReviewEventDb({ rows: [] });
	const theirs = fakeReviewEventDb({ rows: [] });
	await publishAssetVersionReviewEvent(mine.db, assetInput).catch(() => null);
	await publishAssetVersionReviewEvent(theirs.db, {
		...assetInput,
		userId: "user-2",
	}).catch(() => null);
	expect(mine.transactions[0]?.statements[0]?.params[0]).not.toBe(
		theirs.transactions[0]?.statements[0]?.params[0]
	);
});

test("the same key for another Asset Record derives another id", async () => {
	const here = fakeReviewEventDb({ rows: [] });
	const there = fakeReviewEventDb({ rows: [] });
	await publishAssetVersionReviewEvent(here.db, assetInput).catch(() => null);
	await publishAssetVersionReviewEvent(there.db, {
		...assetInput,
		assetRecordId: "record-2",
	}).catch(() => null);
	expect(here.transactions[0]?.statements[0]?.params[0]).not.toBe(
		there.transactions[0]?.statements[0]?.params[0]
	);
});

test("recording with a key whose first result exists returns it without checking the current decision or writing", async () => {
	const { db, transactions } = fakeReviewEventDb({
		latest: { decision: "approved", id: "event-9" },
		rows: [await assetRow()],
	});
	const event = await recordAssetVersionReviewEvent(db, assetInput);
	expect(event).toMatchObject({ id: await assetEventId(), type: "approved" });
	expect(transactions).toHaveLength(0);
});

test("a serialization failure with a key resolves to the winner's record, without one it is retryable", async () => {
	const failure = Object.assign(new Error("serialization"), { code: "40001" });
	const winner = fakeReviewEventDb({
		rows: [await assetRow()],
		transactionError: failure,
	});
	expect(
		(await publishAssetVersionReviewEvent(winner.db, assetInput))?.id
	).toBe(await assetEventId());
	await expect(
		publishAssetVersionReviewEvent(
			fakeReviewEventDb({ rows: [], transactionError: failure }).db,
			assetInput
		)
	).rejects.toBeInstanceOf(RetryablePublicationError);
});
