import type { NeonConfig } from "@neondatabase/serverless";
import { neonConfig } from "@neondatabase/serverless";

/**
 * Reserved host for the local Neon HTTP proxy used by CI database integration
 * tests. `*.localtest.me` resolves to loopback, so production Neon hosts never
 * match and keep the driver's default HTTPS endpoint.
 */
export const localNeonProxyHost = "db.localtest.me";
const localNeonProxyEndpoint = `http://${localNeonProxyHost}:4444/sql`;

const defaultFetchEndpoint: NeonConfig["fetchEndpoint"] =
	neonConfig.fetchEndpoint;
const defaultFetch:
	| ((url: string, init: RequestInit) => Promise<Response>)
	| undefined = neonConfig.fetchFunction;

export const resolveFetchEndpoint: Extract<
	NeonConfig["fetchEndpoint"],
	(...args: never[]) => string
> = (host, port, options) => {
	if (host === localNeonProxyHost) {
		return localNeonProxyEndpoint;
	}
	return typeof defaultFetchEndpoint === "function"
		? defaultFetchEndpoint(host, port, options)
		: defaultFetchEndpoint;
};

export function fetchWithLocalProxyPooling(url: string, init: RequestInit) {
	const fetch = defaultFetch ?? globalThis.fetch;
	if (url !== localNeonProxyEndpoint) {
		return fetch(url, init);
	}
	// The pinned local proxy requires an explicit opt-in to reuse connections.
	const headers = new Headers(init.headers);
	headers.set("neon-pool-opt-in", "true");
	return fetch(url, { ...init, headers });
}
