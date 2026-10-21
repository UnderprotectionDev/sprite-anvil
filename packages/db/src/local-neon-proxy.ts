import { type NeonConfig, neonConfig } from "@neondatabase/serverless";

/**
 * Reserved host for the local Neon HTTP proxy used by CI database integration
 * tests. `*.localtest.me` resolves to loopback, so production Neon hosts never
 * match and keep the driver's default HTTPS endpoint.
 */
export const localNeonProxyHost = "db.localtest.me";
const localNeonProxyPort = 4444;

const defaultFetchEndpoint: NeonConfig["fetchEndpoint"] =
	neonConfig.fetchEndpoint;

export const resolveFetchEndpoint: Extract<
	NeonConfig["fetchEndpoint"],
	(...args: never[]) => string
> = (host, port, options) => {
	if (host === localNeonProxyHost) {
		return `http://${host}:${localNeonProxyPort}/sql`;
	}
	return typeof defaultFetchEndpoint === "function"
		? defaultFetchEndpoint(host, port, options)
		: defaultFetchEndpoint;
};
