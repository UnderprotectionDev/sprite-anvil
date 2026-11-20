/** True when the error, or any error it wraps as a cause, carries the given database error code. */
export function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code, errno } = error as {
		cause?: unknown;
		code?: unknown;
		errno?: unknown;
	};
	return (
		code === expected ||
		(code === "ERR_POSTGRES_SERVER_ERROR" && errno === expected) ||
		hasErrorCode(cause, expected)
	);
}
