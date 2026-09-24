import { afterEach, beforeEach, expect, test, vi } from "vitest";

const errorToast = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: errorToast },
}));

vi.mock("../env", () => ({
	ENV: { VITE_SERVER_URL: "http://localhost:3001" },
}));

import { createQueryClient } from "./orpc";

const supportReference = "SUP-7CFB1C3A-A7A3-4BC2-B748-B5065AA2314A";

function internalServerError() {
	return Object.assign(new Error("Internal server error"), {
		code: "INTERNAL_SERVER_ERROR",
		data: { supportReference },
	});
}

beforeEach(() => {
	errorToast.mockClear();
});

afterEach(() => {
	vi.restoreAllMocks();
});

test("global query failures use the structured error notification and rerun the failed query", async () => {
	const queryClient = createQueryClient();
	let attempts = 0;
	const failure = internalServerError();

	await expect(
		queryClient.fetchQuery({
			queryKey: ["support-reference-query"],
			queryFn: () => {
				attempts += 1;
				throw failure;
			},
			retry: false,
		})
	).rejects.toBe(failure);

	expect(errorToast).toHaveBeenCalledTimes(1);
	const [, options] = errorToast.mock.calls[0] as [
		string,
		{ action: { label: string; onClick: () => void } },
	];
	expect(options.action.label).toBe("Retry");
	options.action.onClick();
	await vi.waitFor(() => expect(attempts).toBe(2));
});

test("global mutation failures show the uncertain result without a retry action", async () => {
	const queryClient = createQueryClient();
	const failure = internalServerError();
	const mutation = queryClient.getMutationCache().build(queryClient, {
		mutationFn: () => {
			throw failure;
		},
	});

	await expect(mutation.execute(undefined)).rejects.toBe(failure);

	expect(errorToast).toHaveBeenCalledTimes(1);
	const [title, options] = errorToast.mock.calls[0] as [
		string,
		{ action?: unknown },
	];
	expect(title).toBe("This action could not be completed.");
	expect(options.action).toBeUndefined();
});

test("queries with an inline error surface do not produce duplicate toasts", async () => {
	const queryClient = createQueryClient();
	const failure = internalServerError();

	await expect(
		queryClient.fetchQuery({
			queryKey: ["inline-error-query"],
			queryFn: () => {
				throw failure;
			},
			meta: { errorPresentation: "inline" },
			retry: false,
		})
	).rejects.toBe(failure);

	expect(errorToast).not.toHaveBeenCalled();
});

test("mutations with an inline error surface do not produce duplicate toasts", async () => {
	const queryClient = createQueryClient();
	const failure = internalServerError();
	const mutation = queryClient.getMutationCache().build(queryClient, {
		meta: { errorPresentation: "inline" },
		mutationFn: () => {
			throw failure;
		},
	});

	await expect(mutation.execute(undefined)).rejects.toBe(failure);
	expect(errorToast).not.toHaveBeenCalled();
});
