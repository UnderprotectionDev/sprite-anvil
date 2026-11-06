import { ORPCError } from "@orpc/server";
import { z } from "zod";

/** Client-chosen key that makes a repeated final-record request return the first result. */
export const idempotencyKeySchema = z.string().trim().min(1).max(128);

/** The same idempotency key arrived with different content than the record it already produced. */
export class IdempotencyConflictError extends Error {
	constructor(record: string) {
		super(
			`${record} idempotency conflict: this key already produced a record with different content.`
		);
		this.name = "IdempotencyConflictError";
	}
}

/** A published record failed its digest or relation check and was not reported as success. */
export class RecordIntegrityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RecordIntegrityError";
	}
}

/**
 * Deterministic record id for an idempotency key inside a scope (record kind,
 * project, target). No column stores the key, so the key lives in the id: the
 * same scope and key always map to the same id.
 */
export async function idempotentRecordId(
	scope: readonly string[],
	key: string
): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify([...scope, key]));
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
	const hex = Array.from(digest.slice(0, 16), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
	const variant = "89ab"[Number.parseInt(hex[16] ?? "0", 16) % 4];
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Id for a new final record: derived from the key when the request carries
 * one (scope should include record kind, project, user and target), random
 * otherwise.
 */
export function resolveRecordId(
	scope: readonly string[],
	key: string | undefined
): Promise<string> {
	return key
		? idempotentRecordId(scope, key)
		: Promise.resolve(crypto.randomUUID());
}

/** Withdraws a record that failed verification, then fails; a failed withdrawal also fails, never succeeds. */
export async function withdrawAndFail(
	withdraw: () => Promise<unknown>,
	message: string
): Promise<never> {
	await withdraw();
	throw new RecordIntegrityError(message);
}

/** Maps a publication failure to a user-facing API error; other errors pass through. */
export function mapRecordPublicationError(error: unknown): unknown {
	if (error instanceof IdempotencyConflictError) {
		return new ORPCError("CONFLICT", {
			message:
				"This idempotency key was already used with different content. Retry with a new idempotency key.",
		});
	}
	if (error instanceof RecordIntegrityError) {
		return new ORPCError("CONFLICT", {
			message:
				"The record was not published because it could not be verified. Retry with the same idempotency key.",
		});
	}
	return error;
}

/** Runs a store call and turns publication failures into user-facing API errors. */
export async function withPublicationErrors<T>(
	run: () => Promise<T> | T
): Promise<T> {
	try {
		return await run();
	} catch (error) {
		throw mapRecordPublicationError(error);
	}
}
