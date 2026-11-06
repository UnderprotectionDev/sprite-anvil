import { expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	mapRecordPublicationError,
	RecordIntegrityError,
} from "./record-publication";

const uuidShape =
	/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("derives the same UUID-shaped id for the same scope and key", async () => {
	const first = await idempotentRecordId(["review", "p1", "v1"], "key-1");
	expect(first).toMatch(uuidShape);
	expect(await idempotentRecordId(["review", "p1", "v1"], "key-1")).toBe(first);
});

test("derives different ids for another key, target or record kind", async () => {
	const base = await idempotentRecordId(["review", "p1", "v1"], "key-1");
	expect(await idempotentRecordId(["review", "p1", "v1"], "key-2")).not.toBe(
		base
	);
	expect(await idempotentRecordId(["review", "p1", "v2"], "key-1")).not.toBe(
		base
	);
	expect(await idempotentRecordId(["package", "p1", "v1"], "key-1")).not.toBe(
		base
	);
});

test("maps conflict and integrity failures to a user-facing CONFLICT", () => {
	for (const error of [
		new IdempotencyConflictError("Review Event"),
		new RecordIntegrityError("digest mismatch"),
	]) {
		const mapped = mapRecordPublicationError(error);
		expect(mapped).toBeInstanceOf(ORPCError);
		expect((mapped as ORPCError<string, unknown>).code).toBe("CONFLICT");
	}
	const other = new Error("boom");
	expect(mapRecordPublicationError(other)).toBe(other);
});
