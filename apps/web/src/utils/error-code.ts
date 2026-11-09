/** The oRPC error code of a failed call, when the error carries one. */
export function errorCodeOf(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	const code = Reflect.get(error, "code");
	return typeof code === "string" ? code : undefined;
}
