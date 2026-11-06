import type { Database } from "@sprite-anvil/db";

export interface RecordedStatement {
	params: unknown[];
	sql: string;
}

export interface FakeReviewEventDb {
	db: Database;
	/** Every guarded transaction sent, with its isolation options. */
	transactions: { options: unknown; statements: RecordedStatement[] }[];
}

/**
 * A Database stand-in for the Review Event publication tests. `rows` is what
 * a re-read by id returns, `latest` what the latest-event lookup returns, and
 * each guarded transaction is recorded. By default a transaction writes the
 * id it was given; `inserted` overrides what the statement reports written.
 */
export function fakeReviewEventDb(options: {
	inserted?: { id: string }[];
	latest?: { decision: string; id: string } | null;
	rows: Record<string, unknown>[];
	transactionError?: Error;
}): FakeReviewEventDb {
	const transactions: FakeReviewEventDb["transactions"] = [];
	const db = {
		$client: {
			query: (sql: string, params: unknown[]) => ({ params, sql }),
			transaction: (
				statements: RecordedStatement[],
				transactionOptions: unknown
			) => {
				transactions.push({ options: transactionOptions, statements });
				if (options.transactionError) {
					return Promise.reject(options.transactionError);
				}
				return Promise.resolve([
					{
						rows: options.inserted ?? [{ id: statements[0]?.params[0] }],
					},
				]);
			},
		},
		select: (fields?: unknown) => ({
			from: () => ({
				where: () => ({
					limit: () =>
						Promise.resolve(
							fields
								? [options.latest].filter(Boolean)
								: options.rows.slice(0, 1)
						),
					orderBy: () => ({
						limit: () => Promise.resolve([options.latest].filter(Boolean)),
					}),
				}),
			}),
		}),
	} as unknown as Database;
	return { db, transactions };
}
