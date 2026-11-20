import { drizzle } from "drizzle-orm/bun-sql/postgres";
import type { DatabaseConfig } from "./config";
import { relations } from "./relations";

export function createInteractiveDatabase(config: DatabaseConfig) {
	return drizzle({ connection: config.DATABASE_URL, relations });
}

export type InteractiveDatabase = ReturnType<typeof createInteractiveDatabase>;
export type InteractiveTransaction = Parameters<
	Parameters<InteractiveDatabase["transaction"]>[0]
>[0];
