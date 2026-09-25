import { internalServerErrorDataSchema } from "@sprite-anvil/api/error-contract";
import { Button } from "@sprite-anvil/ui/components/button";
import type { ReactElement } from "react";
import { toast } from "sonner";

const connectionErrorPattern = /(fetch|network|connection|load failed)/i;
const nonRetryableQueryCodes = new Set([
	"BAD_REQUEST",
	"UNAUTHORIZED",
	"FORBIDDEN",
]);

export type ErrorOperationKind = "query" | "mutation";

export interface ErrorNotification {
	canRetry: boolean;
	description: string;
	supportReference?: string;
	title: string;
}

export function QueryRetryButton({
	disabled,
	onRetry,
}: {
	disabled: boolean;
	onRetry: () => void;
}) {
	return (
		<Button
			disabled={disabled}
			onClick={onRetry}
			type="button"
			variant="outline"
		>
			Retry
		</Button>
	);
}

function getErrorProperty(error: unknown, property: string): unknown {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	return Reflect.get(error, property);
}

function getErrorCode(error: unknown): string | undefined {
	const code = getErrorProperty(error, "code");
	return typeof code === "string" ? code : undefined;
}

function getSupportReference(error: unknown): string | undefined {
	if (getErrorCode(error) !== "INTERNAL_SERVER_ERROR") {
		return undefined;
	}
	const parsed = internalServerErrorDataSchema.safeParse(
		getErrorProperty(error, "data")
	);
	return parsed.success ? parsed.data.supportReference : undefined;
}

export function isConnectionError(error: unknown): error is TypeError {
	return (
		error instanceof TypeError && connectionErrorPattern.test(error.message)
	);
}

export function isWriteOutcomeUncertain(error: unknown): boolean {
	const code = getErrorCode(error);
	const status = getErrorProperty(error, "status");
	return (
		code === "INTERNAL_SERVER_ERROR" ||
		(typeof status === "number" && status >= 500) ||
		isConnectionError(error)
	);
}

function getKnownServerMessage(error: unknown, code: string | undefined) {
	if (!code || code === "INTERNAL_SERVER_ERROR") {
		return;
	}
	const status = getErrorProperty(error, "status");
	if (typeof status !== "number" || status >= 500) {
		return;
	}
	return error instanceof Error && error.message.trim()
		? error.message
		: undefined;
}

export function buildErrorNotification(
	error: unknown,
	kind: ErrorOperationKind
): ErrorNotification {
	const code = getErrorCode(error);
	const status = getErrorProperty(error, "status");
	const supportReference = getSupportReference(error);
	const title =
		kind === "query"
			? "Data could not be loaded."
			: "This action could not be completed.";
	const canRetry = kind === "query" && !nonRetryableQueryCodes.has(code ?? "");

	if (
		code === "INTERNAL_SERVER_ERROR" ||
		(typeof status === "number" && status >= 500)
	) {
		return {
			title,
			description:
				kind === "query"
					? "The latest data could not be loaded. You can safely retry this request."
					: "The result could not be confirmed. Check the current state before repeating this action.",
			...(supportReference ? { supportReference } : {}),
			canRetry,
		};
	}

	if (isConnectionError(error)) {
		return {
			title,
			description:
				kind === "query"
					? "The server could not be reached. Check your connection and retry."
					: "The result could not be confirmed. Check the current state before repeating this action.",
			canRetry,
		};
	}

	const knownServerMessage = getKnownServerMessage(error, code);
	return {
		title,
		description:
			knownServerMessage ??
			(kind === "query"
				? "The request failed. Check your connection and try again."
				: "The action failed. Check the current state before repeating it."),
		...(supportReference ? { supportReference } : {}),
		canRetry,
	};
}

export function showErrorToast(
	error: unknown,
	options: {
		kind: ErrorOperationKind;
		onRetry?: () => void;
	}
) {
	const notification = buildErrorNotification(error, options.kind);
	const description = (
		<div className="space-y-1">
			<p>{notification.description}</p>
			{notification.supportReference ? (
				<p className="break-all font-mono text-xs">
					Support reference: <code>{notification.supportReference}</code>
				</p>
			) : null}
		</div>
	) as ReactElement;
	let toastId: string | number | undefined;
	const action =
		notification.canRetry && options.onRetry
			? {
					label: "Retry",
					onClick: () => {
						if (toastId !== undefined) {
							toast.dismiss(toastId);
						}
						options.onRetry?.();
					},
				}
			: undefined;

	toastId = toast.error(notification.title, {
		description,
		...(action ? { action } : {}),
		...(notification.supportReference ? { duration: 12_000 } : {}),
	});
}
