const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

/** Whether a database error, or the driver error it wraps, is a PostgreSQL unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
	return hasErrorCode(error, uniqueViolationCode);
}
