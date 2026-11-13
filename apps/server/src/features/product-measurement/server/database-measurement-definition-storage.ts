import type { Database } from "@sprite-anvil/db";
import { measurementDefinitions } from "@sprite-anvil/db/schema/measurement-definitions";
import { isUniqueViolation } from "@sprite-anvil/db/unique-violation";
import { asc, eq, sql } from "drizzle-orm";
import type { MeasurementDefinitionStorage } from "./measurement-definition-storage";

export function createDatabaseMeasurementDefinitionStorage(
	db: Database
): MeasurementDefinitionStorage {
	async function findById(id: string) {
		const [row] = await db
			.select()
			.from(measurementDefinitions)
			.where(eq(measurementDefinitions.id, id));
		return row ? row : null;
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
				if (isUniqueViolation(error)) {
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
			return rows;
		},
	};
}
