import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

const errorToast = vi.hoisted(() => vi.fn());
const dismissToast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
	toast: { dismiss: dismissToast, error: errorToast },
}));

import { isWriteOutcomeUncertain, showErrorToast } from "./error-notification";
import { getErrorMessage } from "./get-error-message";

const supportReference = "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A";

function internalServerError() {
	return Object.assign(new Error("private database connection details"), {
		code: "INTERNAL_SERVER_ERROR",
		data: { supportReference },
	});
}

beforeEach(() => {
	errorToast.mockClear();
	dismissToast.mockClear();
	errorToast.mockReturnValue("toast-1");
});

test("read failures show safe details, a support reference, and a retry action", () => {
	const retry = vi.fn();
	showErrorToast(internalServerError(), { kind: "query", onRetry: retry });

	expect(errorToast).toHaveBeenCalledTimes(1);
	const [title, options] = errorToast.mock.calls[0] as [
		string,
		{
			action?: { label: string; onClick: () => void };
			description: ReactElement;
		},
	];
	const description = renderToStaticMarkup(options.description);

	expect(title).toBe("Data could not be loaded.");
	expect(description).toContain("The latest data could not be loaded.");
	expect(description).toContain("Support reference:");
	expect(description).toContain(supportReference);
	expect(description).not.toContain("private database connection details");
	expect(options.action?.label).toBe("Retry");
	options.action?.onClick();
	expect(retry).toHaveBeenCalledOnce();
	expect(dismissToast).toHaveBeenCalledWith("toast-1");
});

test("uncertain write failures explain the unknown result and never offer retry", () => {
	showErrorToast(internalServerError(), { kind: "mutation" });

	const [title, options] = errorToast.mock.calls[0] as [
		string,
		{ action?: unknown; description: ReactElement },
	];
	const description = renderToStaticMarkup(options.description);

	expect(title).toBe("This action could not be completed.");
	expect(description).toContain("The result could not be confirmed.");
	expect(description).toContain(
		"Check the current state before repeating this action."
	);
	expect(description).toContain("Support reference:");
	expect(description).toContain(supportReference);
	expect(description).not.toContain("Data was not written");
	expect(options.action).toBeUndefined();
});

test("connection errors do not fabricate a server support reference", () => {
	showErrorToast(new TypeError("Failed to fetch"), {
		kind: "query",
		onRetry: vi.fn(),
	});

	const [, options] = errorToast.mock.calls[0] as [
		string,
		{ description: ReactElement },
	];
	const description = renderToStaticMarkup(options.description);

	expect(description).toContain("Check your connection");
	expect(description).not.toContain("Support reference");
});

test("WebKit fetch errors explain the connection failure without a support reference", () => {
	showErrorToast(new TypeError("Load failed"), {
		kind: "query",
		onRetry: vi.fn(),
	});

	const [, options] = errorToast.mock.calls[0] as [
		string,
		{ description: ReactElement },
	];
	const description = renderToStaticMarkup(options.description);

	expect(description).toContain("The server could not be reached.");
	expect(description).not.toContain("Support reference");
	expect(isWriteOutcomeUncertain(new TypeError("Load failed"))).toBe(true);
});

test("known client errors do not lock a write as uncertain", () => {
	const validationError = Object.assign(new Error("Invalid input"), {
		code: "BAD_REQUEST",
		status: 400,
	});

	expect(isWriteOutcomeUncertain(validationError)).toBe(false);
	expect(isWriteOutcomeUncertain(internalServerError())).toBe(true);
});

test("inline error copy keeps the support reference but never exposes an internal exception", () => {
	const message = getErrorMessage(
		internalServerError(),
		"The action result could not be confirmed."
	);

	expect(message).toContain("The result could not be confirmed.");
	expect(message).toContain(supportReference);
	expect(message).not.toContain("This action could not be completed.");
	expect(message).not.toContain("private database connection details");
});
