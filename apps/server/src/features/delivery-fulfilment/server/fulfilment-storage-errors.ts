const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

/** Whether a write failed on a unique constraint, directly or as the cause of a driver error. */
export function isUniqueViolation(error: unknown): boolean {
	return hasErrorCode(error, uniqueViolationCode);
}
