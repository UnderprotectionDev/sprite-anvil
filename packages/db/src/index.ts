import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import type { DatabaseConfig } from "./config";
import {
	fetchWithLocalProxyPooling,
	resolveFetchEndpoint,
} from "./local-neon-proxy";
import { relations } from "./relations";

neonConfig.fetchEndpoint = resolveFetchEndpoint;
neonConfig.fetchFunction = fetchWithLocalProxyPooling;

export function createDb(env: DatabaseConfig) {
	const sql = neon(env.DATABASE_URL);
	return drizzle({ client: sql, relations });
}

export type Database = ReturnType<typeof createDb>;

export { getProjectForUser, publishedProjectPredicate } from "./project-access";
