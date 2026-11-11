import { z } from "zod";

/**
 * The one definition of the game build, engine version and adapter version
 * text, shared by the Runtime Validation Record, a Delivery Target's runtime
 * validation criterion and their forms: trimmed, at most this many characters.
 */
export const runtimeEnvironmentTextLimit = 200;

export const runtimeEnvironmentTextLimitMessage = `Use at most ${runtimeEnvironmentTextLimit} characters.`;

/** A value that must be filled in; `requiredMessage` is shown for a blank one. */
export function requiredRuntimeEnvironmentText(requiredMessage?: string) {
	return z
		.string()
		.trim()
		.min(1, requiredMessage)
		.max(runtimeEnvironmentTextLimit, runtimeEnvironmentTextLimitMessage);
}

/** A value that may be blank, with the same trimming and limit. */
export function optionalRuntimeEnvironmentText() {
	return z
		.string()
		.trim()
		.max(runtimeEnvironmentTextLimit, runtimeEnvironmentTextLimitMessage);
}
