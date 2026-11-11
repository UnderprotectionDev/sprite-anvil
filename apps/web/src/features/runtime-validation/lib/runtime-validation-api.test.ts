import { afterEach, expect, test, vi } from "vitest";
import {
	RuntimeValidationUploadError,
	uploadRuntimeValidationEvidenceFile,
} from "./runtime-validation-api";

vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "http://server.test" } }));

const outcomeFinalPattern = /outcome is final/i;
const uploadKeyPattern = /upload key/i;
const keyReusedPattern = /upload key was already used/i;
const tryAgainPattern = /try again/i;

const upload = () =>
	uploadRuntimeValidationEvidenceFile({
		file: new File(["frame"], "hero.png", { type: "image/png" }),
		idempotencyKey: "key-1",
		kind: "screenshot",
		projectId: "p",
		recordId: "r",
		source: "manual",
	});

function respondWith(status: number, error: string) {
	vi.stubGlobal(
		"fetch",
		vi.fn(() =>
			Promise.resolve(
				new Response(JSON.stringify({ error }), {
					headers: { "content-type": "application/json" },
					status,
				})
			)
		)
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

test("a closed record is not reported as an idempotency key conflict", async () => {
	respondWith(
		409,
		"Runtime validation evidence is closed once the outcome is final"
	);
	const error = await upload().catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(RuntimeValidationUploadError);
	expect((error as Error).message).toMatch(outcomeFinalPattern);
	expect((error as Error).message).not.toMatch(uploadKeyPattern);
	expect((error as RuntimeValidationUploadError).outcomeUncertain).toBe(false);
});

test("an idempotency key conflict still says the key was used for different evidence", async () => {
	respondWith(409, "Runtime validation evidence idempotency conflict");
	const error = await upload().catch((caught: unknown) => caught);
	expect((error as Error).message).toMatch(keyReusedPattern);
});

test("a not-saved conflict is retryable with the same key", async () => {
	respondWith(
		409,
		"Runtime validation evidence was not saved; retry with the same key"
	);
	const error = await upload().catch((caught: unknown) => caught);
	expect((error as Error).message).toMatch(tryAgainPattern);
	expect((error as RuntimeValidationUploadError).outcomeUncertain).toBe(true);
});
