import type { Database } from "@sprite-anvil/db";
import { measurementEvents } from "@sprite-anvil/db/schema/measurement-events";
import { isUniqueViolation } from "@sprite-anvil/db/unique-violation";
import { eq } from "drizzle-orm";
import type { MeasurementEventStorage } from "./measurement-event-storage";

export function createDatabaseMeasurementEventStorage(
	db: Database
): MeasurementEventStorage {
	async function findById(id: string) {
		const [row] = await db
			.select()
			.from(measurementEvents)
			.where(eq(measurementEvents.id, id));
		return row ? row : null;
	}

	return {
		findById,
		async listByDefinitionId(definitionId) {
			const rows = await db
				.select()
				.from(measurementEvents)
				.where(eq(measurementEvents.definitionId, definitionId));
			return rows;
		},
		async insert(event) {
			try {
				await db.insert(measurementEvents).values(event);
			} catch (error) {
				if (isUniqueViolation(error)) {
					return { status: "conflict" };
				}
				throw error;
			}
			// The result is the persisted row, not the value that was sent.
			const inserted = await findById(event.id);
			if (!inserted) {
				throw new Error("The recorded Measurement Event was not stored.");
			}
			return { event: inserted, status: "inserted" };
		},
	};
}
