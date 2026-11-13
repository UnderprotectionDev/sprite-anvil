import type { Database } from "@sprite-anvil/db";
import { measurementDefinitions } from "@sprite-anvil/db/schema/measurement-definitions";
import { asc, eq, sql } from "drizzle-orm";
import type {
	MeasurementDefinitionStorage,
	StoredMeasurementDefinition,
} from "./measurement-definition-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function toStored(
	row: typeof measurementDefinitions.$inferSelect
): StoredMeasurementDefinition {
	return {
		activatedAt: row.activatedAt,
		contractVersion: row.contractVersion,
		decisionUse: row.decisionUse,
		denominator: row.denominator,
		endEvent: row.endEvent,
		eventFamily: row.eventFamily,
		exclusions: row.exclusions,
		id: row.id,
		metricId: row.metricId,
		numerator: row.numerator,
		ownerUserId: row.ownerUserId,
		retentionDays: row.retentionDays,
		scope: row.scope,
		startEvent: row.startEvent,
		timeWindowDays: row.timeWindowDays,
		version: row.version,
	};
}

export function createDatabaseMeasurementDefinitionStorage(
	db: Database
): MeasurementDefinitionStorage {
	async function findById(id: string) {
		const [row] = await db
			.select()
			.from(measurementDefinitions)
			.where(eq(measurementDefinitions.id, id));
		return row ? toStored(row) : null;
	}

	return {
		findById,
		async insert(definition) {
			try {
				await db.insert(measurementDefinitions).values({
					...definition,
					version: sql`(select coalesce(max(${measurementDefinitions.version}), 0) + 1 from ${measurementDefinitions} where ${measurementDefinitions.ownerUserId} = ${definition.ownerUserId} and ${measurementDefinitions.metricId} = ${definition.metricId})`,
				});
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
			const inserted = await findById(definition.id);
			if (!inserted) {
				throw new Error("The activated Measurement Definition was not stored.");
			}
			return { definition: inserted, status: "inserted" };
		},
		async listForOwner(ownerUserId) {
			const rows = await db
				.select()
				.from(measurementDefinitions)
				.where(eq(measurementDefinitions.ownerUserId, ownerUserId))
				.orderBy(
					asc(measurementDefinitions.metricId),
					asc(measurementDefinitions.version)
				);
			return rows.map(toStored);
		},
	};
}
