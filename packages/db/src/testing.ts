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

interface LocalRawQuery extends PromiseLike<unknown> {
	params: unknown[];
	sql: string;
}

/** True when the URL targets a disposable loopback PostgreSQL that `createLocalTestDb` accepts. */
export function isLoopbackTestDatabaseUrl(url: string | undefined): boolean {
	if (!url) {
		return false;
	}
	try {
		const target = new URL(url);
		return (
			(target.protocol === "postgres:" || target.protocol === "postgresql:") &&
			target.hostname === "127.0.0.1"
		);
	} catch {
		return false;
	}
}

export function createLocalTestDb(
	env: DatabaseConfig
): Database & { close: () => Promise<void> } {
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

	const database = drizzle({
		connection: { connectionString: env.DATABASE_URL, max: 1 },
		relations,
	});
	const localClient = database.$client;

	const batch = (queries: unknown[]) => {
		if (queries.length === 0) {
			throw new Error("A database batch must contain at least one query.");
		}

		const preparedQueries = queries.map((batchItem) => {
			if (
				typeof batchItem !== "object" ||
				batchItem === null ||
				typeof (batchItem as BatchQuery)._prepare !== "function"
			) {
				throw new Error("A database batch item must be a Drizzle query.");
			}
			return (batchItem as BatchQuery)._prepare();
		});

		return database.transaction(async (batchTransaction) => {
			const session = batchTransaction._.session as unknown as BatchSession;
			const results = await preparedQueries.reduce<Promise<unknown[]>>(
				async (pendingResults, preparedQuery) => {
					const accumulated = await pendingResults;
					const prepared = session.prepareQuery(
						preparedQuery.getQuery(),
						preparedQuery.mode,
						false,
						preparedQuery.mapper
					);
					accumulated.push(await prepared.execute());
					return accumulated;
				},
				Promise.resolve([])
			);
			return results;
		});
	};

	// Production's Neon queries are lazy: composing a transaction must not
	// start its INSERTs on separate pool connections before BEGIN.
	const query = (text: string, params: unknown[] = []): LocalRawQuery => ({
		sql: text,
		params,
		// biome-ignore lint/suspicious/noThenProperty: Neon-compatible lazy queries must implement PromiseLike without executing before BEGIN.
		then: (fulfilled, rejected) => {
			const session = database._.session as unknown as BatchSession;
			return session
				.prepareQuery({ sql: text, params }, "objects", false)
				.execute()
				.then(fulfilled, rejected);
		},
	});
	const transaction = (
		queries: LocalRawQuery[],
		options?: { isolationLevel?: string; fullResults?: boolean }
	) =>
		database.transaction(
			async (tx) => {
				const session = tx._.session as unknown as BatchSession;
				return await queries.reduce<Promise<unknown[]>>(
					async (pending, prepared) => {
						const results = await pending;
						results.push(
							await session
								.prepareQuery(
									{ sql: prepared.sql, params: prepared.params },
									options?.fullResults ? "raw" : "objects",
									false
								)
								.execute()
						);
						return results;
					},
					Promise.resolve([])
				);
			},
			options?.isolationLevel ? { isolationLevel: "serializable" } : undefined
		);
	return Object.assign(database, {
		batch,
		$client: { query, transaction },
		close: () => localClient.end(),
	}) as unknown as Database & { close: () => Promise<void> };
}
