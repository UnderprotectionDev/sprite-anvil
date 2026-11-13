import type { Database } from "@sprite-anvil/db";
import { measurementEvents } from "@sprite-anvil/db/schema/measurement-events";
import { eq } from "drizzle-orm";
import type {
	MeasurementEventStorage,
	StoredMeasurementEvent,
} from "./measurement-event-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function toStored(
	row: typeof measurementEvents.$inferSelect
): StoredMeasurementEvent {
	return {
		counters: row.counters,
		definitionId: row.definitionId,
		definitionVersion: row.definitionVersion,
		eventFamily: row.eventFamily,
		eventName: row.eventName,
		id: row.id,
		metricId: row.metricId,
		occurredAt: row.occurredAt,
		outcomeClass: row.outcomeClass,
		projectPseudonym: row.projectPseudonym,
		recordKind: row.recordKind,
		surface: row.surface,
		userPseudonym: row.userPseudonym,
		workflowId: row.workflowId,
	};
}

export function createDatabaseMeasurementEventStorage(
	db: Database
): MeasurementEventStorage {
	async function findById(id: string) {
		const [row] = await db
			.select()
			.from(measurementEvents)
			.where(eq(measurementEvents.id, id));
		return row ? toStored(row) : null;
	}

	return {
		findById,
		async listByDefinitionId(definitionId) {
			const rows = await db
				.select()
				.from(measurementEvents)
				.where(eq(measurementEvents.definitionId, definitionId));
			return rows.map(toStored);
		},
		async insert(event) {
			try {
				await db.insert(measurementEvents).values(event);
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
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
