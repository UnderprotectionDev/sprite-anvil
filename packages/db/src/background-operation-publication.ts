import type { InteractiveTransaction } from "./interactive-database";
import {
	backgroundOperationOutbox,
	backgroundOperations,
} from "./schema/background-operations";

/** A feature approval and its operation/outbox may be written in the same transaction. */
export async function insertBackgroundOperationWithOutbox(
	tx: InteractiveTransaction,
	input: typeof backgroundOperations.$inferInsert
) {
	await tx.insert(backgroundOperations).values(input).onConflictDoNothing();
	await tx
		.insert(backgroundOperationOutbox)
		.values({ id: `approval-${input.id}`, backgroundOperationId: input.id })
		.onConflictDoNothing();
}
