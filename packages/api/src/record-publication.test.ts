import { expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	mapRecordPublicationError,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	resolveRecordId,
	verifyPublishedRecord,
	withdrawAndFail,
} from "./record-publication";

const asciiOnly = /^[\x20-\x7e]+$/;
const uuidShape =
	/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const scope = {
	assetRecordId: "r1",
	kind: "review",
	projectId: "p1",
	targetId: "v1",
	userId: "u1",
};

test("derives the same UUID-shaped id for the same scope and key", async () => {
	const first = await idempotentRecordId(scope, "key-1");
	expect(first).toMatch(uuidShape);
	expect(await idempotentRecordId({ ...scope }, "key-1")).toBe(first);
});

test("derives different ids for another key, target, Asset Record, member or record kind", async () => {
	const base = await idempotentRecordId(scope, "key-1");
	const others = await Promise.all(
		(
			[
				[scope, "key-2"],
				[{ ...scope, targetId: "v2" }, "key-1"],
				[{ ...scope, assetRecordId: "r2" }, "key-1"],
				[{ ...scope, userId: "u2" }, "key-1"],
				[{ ...scope, kind: "package" }, "key-1"],
			] as const
		).map(([changed, key]) => idempotentRecordId(changed, key))
	);
	for (const other of others) {
		expect(other).not.toBe(base);
	}
});

test("maps conflict, integrity and concurrent-change failures to a user-facing CONFLICT", () => {
	for (const error of [
		new IdempotencyConflictError("Review Event"),
		new RecordIntegrityError("digest mismatch"),
		new RetryablePublicationError("Review Event"),
	]) {
		const mapped = mapRecordPublicationError(error);
		expect(mapped).toBeInstanceOf(ORPCError);
		expect((mapped as ORPCError<string, unknown>).code).toBe("CONFLICT");
	}
	const other = new Error("boom");
	expect(mapRecordPublicationError(other)).toBe(other);
});

test("publication error messages are English interface copy and say whether to reuse the key", () => {
	const messageOf = (error: Error) =>
		(mapRecordPublicationError(error) as ORPCError<string, unknown>).message;
	for (const error of [
		new IdempotencyConflictError("Review Event"),
		new RecordIntegrityError("digest mismatch"),
		new RetryablePublicationError("Review Event"),
	]) {
		expect(messageOf(error)).toMatch(asciiOnly);
		expect(messageOf(error)).toContain("idempotency key");
	}
	expect(messageOf(new RecordIntegrityError("x"))).toContain(
		"Retry with the same idempotency key"
	);
	expect(messageOf(new RetryablePublicationError("x"))).toContain(
		"Retry with the same idempotency key"
	);
	expect(messageOf(new IdempotencyConflictError("x"))).not.toContain(
		"same idempotency key"
	);
});

test("resolves a keyed id deterministically and an unkeyed id randomly", async () => {
	expect(await resolveRecordId(scope, "key-1")).toBe(
		await idempotentRecordId(scope, "key-1")
	);
	expect(await resolveRecordId(scope, undefined)).toHaveLength(36);
	expect(await resolveRecordId(scope, undefined)).not.toBe(
		await resolveRecordId(scope, undefined)
	);
});

test("a failed withdrawal still fails with a retryable integrity error", async () => {
	const failedWithdrawal = withdrawAndFail(
		() => Promise.reject(new Error("connection reset")),
		"digest mismatch."
	);
	await expect(failedWithdrawal).rejects.toBeInstanceOf(RecordIntegrityError);
	await expect(failedWithdrawal).rejects.toThrow("could not be withdrawn");
});

const row = { id: "record-1" };

test("replay repairs a stored record that fails its own checks, then reports a new key", async () => {
	let repaired = 0;
	const result = await replayPublishedRecord({
		differs: () => false,
		integrityFailure: () => "relation check failed.",
		label: "Package",
		read: () => Promise.resolve(row),
		repair: () => {
			repaired += 1;
			return Promise.resolve();
		},
		toResult: (stored) => stored.id,
	});
	expect(result).toBeNull();
	expect(repaired).toBe(1);
});

test("replay without a repair, or whose repair fails, is an integrity failure", async () => {
	const check = {
		differs: () => false,
		integrityFailure: () => "relation check failed.",
		label: "Package",
		read: () => Promise.resolve(row),
		toResult: (stored: typeof row) => stored.id,
	};
	await expect(replayPublishedRecord(check)).rejects.toBeInstanceOf(
		RecordIntegrityError
	);
	await expect(
		replayPublishedRecord({
			...check,
			repair: () => Promise.reject(new Error("down")),
		})
	).rejects.toThrow("could not be withdrawn");
});

test("replay returns the stored record, nothing for a new key and a conflict for other content", async () => {
	const base = {
		differs: () => false,
		integrityFailure: () => null,
		label: "Package",
		read: () => Promise.resolve(row),
		toResult: (stored: typeof row) => stored.id,
	};
	expect(await replayPublishedRecord(base)).toBe("record-1");
	expect(
		await replayPublishedRecord({ ...base, read: () => Promise.resolve(null) })
	).toBeNull();
	await expect(
		replayPublishedRecord({ ...base, differs: () => true })
	).rejects.toBeInstanceOf(IdempotencyConflictError);
});

test("verification withdraws a failing record and fails when the record is gone", async () => {
	let withdrawn = 0;
	const base = {
		integrityFailure: () => "digest mismatch.",
		label: "Package",
		read: () => Promise.resolve(row),
		toResult: (stored: typeof row) => stored.id,
	};
	await expect(
		verifyPublishedRecord({
			...base,
			withdraw: () => {
				withdrawn += 1;
				return Promise.resolve();
			},
		})
	).rejects.toBeInstanceOf(RecordIntegrityError);
	expect(withdrawn).toBe(1);
	await expect(
		verifyPublishedRecord({ ...base, read: () => Promise.resolve(null) })
	).rejects.toThrow("could not be re-read");
	expect(
		await verifyPublishedRecord({ ...base, integrityFailure: () => null })
	).toBe("record-1");
});
