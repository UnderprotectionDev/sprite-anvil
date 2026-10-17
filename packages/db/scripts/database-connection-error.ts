const GUIDANCE =
	"Check the declared development target and credentials in a secure environment.";

export function describeConnectionFailure(
	targetName: string,
	error: unknown
): string {
	const base = `${targetName}: database connection failed.`;
	// Only server-side refusals carry a message written by the database
	// service; client errors may echo connection strings, so they stay generic.
	if (
		error instanceof Error &&
		(error as { code?: unknown }).code === "ERR_POSTGRES_SERVER_ERROR" &&
		error.message.trim() !== ""
	) {
		return `${base} The server responded: ${error.message.trim()} ${GUIDANCE}`;
	}
	return `${base} ${GUIDANCE}`;
}
