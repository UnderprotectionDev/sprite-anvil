import {
	buildErrorNotification,
	type ErrorOperationKind,
	isWriteOutcomeUncertain,
} from "./error-notification";

function getErrorProperty(error: unknown, property: string): unknown {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	return Reflect.get(error, property);
}

export function getErrorMessage(
	error: unknown,
	fallback: string,
	kind: ErrorOperationKind = "mutation"
): string {
	const notification = buildErrorNotification(error, kind);
	const code = getErrorProperty(error, "code");
	if (isWriteOutcomeUncertain(error)) {
		return [
			notification.description,
			notification.supportReference
				? `Support reference: ${notification.supportReference}`
				: undefined,
		]
			.filter(Boolean)
			.join(" ");
	}

	if (typeof code === "string" && error instanceof Error) {
		return error.message || fallback;
	}

	return fallback;
}
