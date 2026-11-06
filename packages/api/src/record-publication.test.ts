import { expect, test } from "bun:test";
import { ORPCError } from "@orpc/server";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	mapRecordPublicationError,
	RecordIntegrityError,
	resolveRecordId,
} from "./record-publication";

const asciiOnly = /^[\x20-\x7e]+$/;
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

test("publication error messages are English interface copy", () => {
	for (const error of [
		new IdempotencyConflictError("Review Event"),
		new RecordIntegrityError("digest mismatch"),
	]) {
		const { message } = mapRecordPublicationError(error) as ORPCError<
			string,
			unknown
		>;
		expect(message).toMatch(asciiOnly);
		expect(message).toContain("idempotency key");
	}
});

test("resolves a keyed id deterministically and an unkeyed id randomly", async () => {
	const scope = ["review", "p1", "u1", "v1"];
	expect(await resolveRecordId(scope, "key-1")).toBe(
		await idempotentRecordId(scope, "key-1")
	);
	expect(await resolveRecordId(scope, undefined)).toHaveLength(36);
	expect(await resolveRecordId(scope, undefined)).not.toBe(
		await resolveRecordId(scope, undefined)
	);
});
