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
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "RecordIntegrityError";
	}
}

/** What one idempotency key is scoped to: another member, project, Asset Record or target never shares a key. */
export interface RecordScope {
	assetRecordId?: string;
	/** Record kind, e.g. "generation-package". */
	kind: string;
	projectId: string;
	/** The record the new one is filed under (an Asset Version or Composite Version), when it has one. */
	targetId?: string;
	userId: string;
}

/**
 * Deterministic record id for an idempotency key inside a scope. No column
 * stores the key, so the key lives in the id: the same scope and key always
 * map to the same id.
 */
export async function idempotentRecordId(
	scope: RecordScope,
	key: string
): Promise<string> {
	const bytes = new TextEncoder().encode(
		JSON.stringify([
			scope.kind,
			scope.projectId,
			scope.userId,
			scope.assetRecordId ?? null,
			scope.targetId ?? null,
			key,
		])
	);
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
	const hex = Array.from(digest.slice(0, 16), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
	const variant = "89ab"[Number.parseInt(hex[16] ?? "0", 16) % 4];
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Id for a new final record: derived from the key when the request carries one, random otherwise. */
export function resolveRecordId(
	scope: RecordScope,
	key: string | undefined
): Promise<string> {
	return key
		? idempotentRecordId(scope, key)
		: Promise.resolve(crypto.randomUUID());
}

/**
 * Withdraws a record that failed verification, then fails; a failed
 * withdrawal also fails, never succeeds. The failure stays retryable with the
 * same key: the next keyed request finds the residue and repairs it.
 */
export async function withdrawAndFail(
	withdraw: () => Promise<unknown>,
	message: string
): Promise<never> {
	try {
		await withdraw();
	} catch (cause) {
		throw new RecordIntegrityError(
			`${message} The bad record could not be withdrawn yet.`,
			{ cause }
		);
	}
	throw new RecordIntegrityError(message);
}

interface PublishedRecordCheck<Row, Result> {
	/** Failure text when the stored row breaks its own checks (digest, relations), else null. */
	integrityFailure: (row: Row) => Promise<string | null> | string | null;
	label: string;
	read: () => Promise<Row | null>;
	toResult: (row: Row) => Result;
}

/**
 * Re-reads the record an earlier request with this key published. Returns
 * null for a new key. A stored row that fails its own checks is withdrawn
 * through `repair` and treated as a new key; without `repair` it is an
 * integrity failure. A row built from other request content is a conflict,
 * never a second record.
 */
export async function replayPublishedRecord<Row, Result>(
	check: PublishedRecordCheck<Row, Result> & {
		/** True when the same key arrived with different request content. */
		differs: (row: Row) => Promise<boolean> | boolean;
		repair?: () => Promise<unknown>;
	}
): Promise<Result | null> {
	const row = await check.read();
	if (!row) {
		return null;
	}
	const failure = await check.integrityFailure(row);
	if (failure) {
		if (check.repair) {
			try {
				await check.repair();
			} catch (cause) {
				throw new RecordIntegrityError(
					`${failure} The bad record could not be withdrawn yet.`,
					{ cause }
				);
			}
			return null;
		}
		throw new RecordIntegrityError(failure);
	}
	if (await check.differs(row)) {
		throw new IdempotencyConflictError(check.label);
	}
	return check.toResult(row);
}

/**
 * Re-reads a record right after it was published and checks it. A failure
 * withdraws it (when a `withdraw` exists) and fails, so an unexplained
 * difference is never reported as a successful publish.
 */
export async function verifyPublishedRecord<Row, Result>(
	check: PublishedRecordCheck<Row, Result> & {
		withdraw?: () => Promise<unknown>;
	}
): Promise<Result> {
	const row = await check.read();
	if (!row) {
		throw new RecordIntegrityError(
			`The published ${check.label} could not be re-read from the persisted record.`
		);
	}
	const failure = await check.integrityFailure(row);
	if (failure) {
		if (check.withdraw) {
			return withdrawAndFail(check.withdraw, failure);
		}
		throw new RecordIntegrityError(failure);
	}
	return check.toResult(row);
}

/** A write lost to a concurrent change and can be sent again unchanged. */
export class RetryablePublicationError extends Error {
	constructor(record: string) {
		super(`${record} was not published because of a concurrent change.`);
		this.name = "RetryablePublicationError";
	}
}

/** Maps a publication failure to a user-facing API error; other errors pass through. */
export function mapRecordPublicationError(error: unknown): unknown {
	if (error instanceof IdempotencyConflictError) {
		return new ORPCError("CONFLICT", {
			message:
				"This idempotency key was already used with different content. Use a new idempotency key for different content.",
		});
	}
	if (error instanceof RetryablePublicationError) {
		return new ORPCError("CONFLICT", {
			message:
				"The record was not published because another change happened at the same time. Retry with the same idempotency key.",
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
