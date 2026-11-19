/** The same idempotency key arrived with different content than the record it already produced. */
export class IdempotencyConflictError extends Error {
	constructor(record: string) {
		super(
			`${record} idempotency conflict: this key already produced a record with different content.`
		);
		this.name = "IdempotencyConflictError";
	}
}
