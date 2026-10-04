import { drizzle } from "drizzle-orm/node-postgres";

import type { DatabaseConfig } from "./config";
import type { Database } from "./index";
import { relations } from "./relations";

interface BatchQuery {
	_prepare: () => PreparedBatchQuery;
}

interface PreparedBatchQuery {
	getQuery: () => unknown;
	mapper?: (rows: unknown[]) => unknown;
	mode: "arrays" | "objects" | "raw";
}

interface BatchSession {
	prepareQuery: (
		query: unknown,
		mode: PreparedBatchQuery["mode"],
		name: string | boolean,
		mapper?: PreparedBatchQuery["mapper"]
	) => { execute: () => Promise<unknown> };
}

export function createLocalTestDb(env: DatabaseConfig): Database {
	if (process.env.NODE_ENV !== "test") {
		throw new Error("The local PostgreSQL adapter is only available in tests.");
	}

	const target = new URL(env.DATABASE_URL);
	if (
		!(target.protocol === "postgres:" || target.protocol === "postgresql:") ||
		target.hostname !== "127.0.0.1"
	) {
		throw new Error("The local test database must use loopback PostgreSQL.");
	}

	const database = drizzle({ connection: env.DATABASE_URL, relations });

	const batch = (queries: unknown[]) => {
		if (queries.length === 0) {
			throw new Error("A database batch must contain at least one query.");
		}

		const preparedQueries = queries.map((query) => {
			if (
				typeof query !== "object" ||
				query === null ||
				typeof (query as BatchQuery)._prepare !== "function"
			) {
				throw new Error("A database batch item must be a Drizzle query.");
			}
			return (query as BatchQuery)._prepare();
		});

		return database.transaction(async (transaction) => {
			const session = transaction._.session as unknown as BatchSession;
			const results = await preparedQueries.reduce<Promise<unknown[]>>(
				async (pendingResults, query) => {
					const accumulated = await pendingResults;
					const prepared = session.prepareQuery(
						query.getQuery(),
						query.mode,
						false,
						query.mapper
					);
					accumulated.push(await prepared.execute());
					return accumulated;
				},
				Promise.resolve([])
			);
			return results;
		});
	};

	return Object.assign(database, { batch }) as unknown as Database;
}
