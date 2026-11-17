import { expect, test, vi } from "vitest";
import { isWriteOutcomeUncertain } from "./error-notification";
import { honoPostFileJson } from "./hono-api";

vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "http://localhost" } }));

test("treats unreadable successful upload JSON as an uncertain write", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue(new Response("{", { status: 202 }))
	);
	try {
		const error = await honoPostFileJson(
			"/upload",
			new File(["x"], "a.zip"),
			{},
			"Upload failed"
		).catch((value: unknown) => value);
		expect(isWriteOutcomeUncertain(error)).toBe(true);
	} finally {
		vi.unstubAllGlobals();
	}
});
