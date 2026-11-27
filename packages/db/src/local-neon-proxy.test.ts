import { expect, spyOn, test } from "bun:test";
import { neonConfig } from "@neondatabase/serverless";
import { createDb } from "./index";
import { localNeonProxyHost, resolveFetchEndpoint } from "./local-neon-proxy";

test("routes the reserved local proxy host to the plain-HTTP proxy port", () => {
	expect(resolveFetchEndpoint(localNeonProxyHost, 5432)).toBe(
		"http://db.localtest.me:4444/sql"
	);
});

test("keeps Neon hosts on the driver's default HTTPS endpoint", () => {
	const host = "ep-quiet-sky-123456.us-east-2.aws.neon.tech";
	const defaultEndpoint = neonConfig.fetchEndpoint;
	const expected =
		typeof defaultEndpoint === "function"
			? defaultEndpoint(host, 5432)
			: defaultEndpoint;

	expect(resolveFetchEndpoint(host, 5432)).toBe(expected);
	expect(expected).toStartWith("https://");
});

test("does not route other loopback hosts through the proxy", () => {
	expect(resolveFetchEndpoint("127.0.0.1", 5432)).not.toContain(":4444");
});

test("opts in to pooling for local Neon HTTP reads and transactions only", async () => {
	const result = { fields: [], rows: [] };
	const fetchSpy = spyOn(globalThis, "fetch")
		.mockResolvedValueOnce(Response.json(result))
		.mockResolvedValueOnce(Response.json({ results: [result] }))
		.mockResolvedValueOnce(Response.json(result));
	try {
		const local = createDb({
			DATABASE_URL: `postgres://postgres:postgres@${localNeonProxyHost}:5432/context_test`,
		}).$client;
		await local.query("select 1");
		await local.transaction([local.query("select 1")], {
			isolationLevel: "Serializable",
		});
		const remote = createDb({
			DATABASE_URL:
				"postgres://test:test@ep-quiet-sky-123456.us-east-2.aws.neon.tech/test",
		}).$client;
		await remote.query("select 1");

		expect(fetchSpy).toHaveBeenCalledTimes(3);
		const [localQuery, localTransaction, remoteQuery] = fetchSpy.mock.calls;
		expect(localQuery?.[0]).toBe("http://db.localtest.me:4444/sql");
		expect(localTransaction?.[0]).toBe(localQuery?.[0]);
		const queryHeaders = new Headers(localQuery?.[1]?.headers);
		const transactionHeaders = new Headers(localTransaction?.[1]?.headers);
		expect(queryHeaders.get("neon-pool-opt-in")).toBe("true");
		expect(transactionHeaders.get("neon-pool-opt-in")).toBe("true");
		expect(transactionHeaders.get("neon-batch-isolation-level")).toBe(
			"Serializable"
		);
		expect(transactionHeaders.has("neon-connection-string")).toBe(true);
		expect(new Headers(remoteQuery?.[1]?.headers).has("neon-pool-opt-in")).toBe(
			false
		);
	} finally {
		fetchSpy.mockRestore();
	}
});
