import { expect, test } from "bun:test";
import { neonConfig } from "@neondatabase/serverless";
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
