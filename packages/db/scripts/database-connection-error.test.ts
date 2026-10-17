import { expect, test } from "bun:test";
import { describeConnectionFailure } from "./database-connection-error";

const GUIDANCE =
	"Check the declared development target and credentials in a secure environment.";

test("reports the server's refusal reason when the database rejects the connection", () => {
	const error = Object.assign(
		new Error("Your account has exceeded the quota."),
		{
			code: "ERR_POSTGRES_SERVER_ERROR",
		}
	);
	expect(describeConnectionFailure("development", error)).toBe(
		`development: database connection failed. The server responded: Your account has exceeded the quota. ${GUIDANCE}`
	);
});

test("keeps the generic message for network and unknown failures", () => {
	const error = Object.assign(new Error("postgresql://user:secret@host"), {
		code: "ERR_POSTGRES_CONNECTION_TIMEOUT",
	});
	expect(describeConnectionFailure("development", error)).toBe(
		`development: database connection failed. ${GUIDANCE}`
	);
	expect(describeConnectionFailure("development", "boom")).toBe(
		`development: database connection failed. ${GUIDANCE}`
	);
});
