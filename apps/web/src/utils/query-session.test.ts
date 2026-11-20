import { expect, test } from "vitest";
import { getSessionQueryClient, resetSessionQueryClient } from "./query-client";

test("private data and in-flight writes to an old cache stay out of the next session", () => {
	const key = ["projects"];
	try {
		const first = getSessionQueryClient("alice", "session-1");
		first.setQueryData(key, ["Alice's project"]);
		expect(
			getSessionQueryClient("alice", "session-1").getQueryData(key)
		).toEqual(["Alice's project"]);

		const second = getSessionQueryClient("bob", "session-2");
		first.setQueryData(key, ["Late response"]);
		expect(second.getQueryData(key)).toBeUndefined();

		resetSessionQueryClient();
		expect(getSessionQueryClient("bob", "session-2")).not.toBe(second);
	} finally {
		resetSessionQueryClient();
	}
});
