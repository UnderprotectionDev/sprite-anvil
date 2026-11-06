import { expect, test } from "bun:test";
import {
	idempotentRecordId,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import {
	publishAssetVersionReviewEvent,
	publishCompositeVersionReviewEvent,
	replayAssetVersionReviewEvent,
	replayCompositeVersionReviewEvent,
} from "../review-event-publication";

interface Fake {
	db: Database;
	state: { inserts: { params: unknown[]; sql: string }[]; rows: unknown[] };
}

/** Rows are what a re-read by id returns; each guarded INSERT is recorded. */
function fakeDb(options: {
	insertError?: Error;
	rows: Record<string, unknown>[];
}): Fake {
	const state: Fake["state"] = { inserts: [], rows: options.rows };
	const db = {
		$client: {
			query: (sql: string, params: unknown[]) => ({ params, sql }),
			transaction: (statements: { params: unknown[]; sql: string }[]) => {
				state.inserts.push(...statements);
				if (options.insertError) {
					return Promise.reject(options.insertError);
				}
				return Promise.resolve([{ rows: [{ id: statements[0]?.params[0] }] }]);
			},
		},
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve(state.rows.slice(0, 1)),
				}),
			}),
		}),
	} as unknown as Database;
	return { db, state };
}

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

async function assetEventId() {
	return await idempotentRecordId(
		["asset-version-review-event", "project-1", "user-1", "version-1"],
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
	const { db, state } = fakeDb({ rows: [await assetRow()] });
	const event = await replayAssetVersionReviewEvent(db, assetInput);
	expect(event).toMatchObject({
		assetVersionId: "version-1",
		id: await assetEventId(),
		type: "approved",
	});
	expect(state.inserts).toHaveLength(0);
});

test("a first use of a Review Event key has nothing to replay", async () => {
	const { db } = fakeDb({ rows: [] });
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
				fakeDb({ rows: [{ ...assetRowBase(id), ...changed }] }).db,
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
	const { db, state } = fakeDb({ rows: [await assetRow()] });
	const event = await publishAssetVersionReviewEvent(db, assetInput);
	expect(state.inserts).toHaveLength(1);
	expect(state.inserts[0]?.params[0]).toBe(id);
	expect(event?.id).toBe(id);
});

test("a duplicate-key race resolves to the record the winner wrote", async () => {
	const duplicate = Object.assign(new Error("duplicate key"), {
		code: "23505",
	});
	const { db } = fakeDb({ insertError: duplicate, rows: [await assetRow()] });
	const event = await publishAssetVersionReviewEvent(db, assetInput);
	expect(event?.id).toBe(await assetEventId());
});

test("an interrupted publication fails visibly and the retry yields exactly one record", async () => {
	// First attempt: the write lands but the re-read is lost.
	const lost = fakeDb({ rows: [] });
	await expect(
		publishAssetVersionReviewEvent(lost.db, assetInput)
	).rejects.toThrow("could not be re-read");
	expect(lost.state.inserts).toHaveLength(1);

	// Retry with the same key: the persisted record is found and returned.
	const persisted = fakeDb({ rows: [await assetRow()] });
	const replayed = await replayAssetVersionReviewEvent(
		persisted.db,
		assetInput
	);
	expect(replayed?.id).toBe(lost.state.inserts[0]?.params[0] as string);
	expect(persisted.state.inserts).toHaveLength(0);
});

test("a Composite Version Review Event key replays and conflicts the same way", async () => {
	const id = await idempotentRecordId(
		["composite-version-review-event", "project-1", "user-1", "composite-1"],
		"key-1"
	);
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
	const ok = fakeDb({ rows: [row] });
	expect(
		(await replayCompositeVersionReviewEvent(ok.db, compositeInput))?.id
	).toBe(id);
	expect(ok.state.inserts).toHaveLength(0);
	await expect(
		replayCompositeVersionReviewEvent(
			fakeDb({ rows: [{ ...row, decision: "rejected" }] }).db,
			compositeInput
		)
	).rejects.toThrow("idempotency conflict");
	const written = fakeDb({ rows: [row] });
	await publishCompositeVersionReviewEvent(written.db, compositeInput);
	expect(written.state.inserts[0]?.params[0]).toBe(id);
});

test("a replayed Review Event whose stored Asset Record differs is an integrity failure, not a success", async () => {
	const id = await assetEventId();
	await expect(
		replayAssetVersionReviewEvent(
			fakeDb({ rows: [{ ...assetRowBase(id), assetRecordId: "record-9" }] }).db,
			assetInput
		)
	).rejects.toBeInstanceOf(RecordIntegrityError);
	const compositeId = await idempotentRecordId(
		["composite-version-review-event", "project-1", "user-1", "composite-1"],
		"key-1"
	);
	await expect(
		replayCompositeVersionReviewEvent(
			fakeDb({
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
	const mine = fakeDb({ rows: [] });
	const theirs = fakeDb({ rows: [] });
	await publishAssetVersionReviewEvent(mine.db, assetInput).catch(() => null);
	await publishAssetVersionReviewEvent(theirs.db, {
		...assetInput,
		userId: "user-2",
	}).catch(() => null);
	expect(mine.state.inserts[0]?.params[0]).not.toBe(
		theirs.state.inserts[0]?.params[0]
	);
});
