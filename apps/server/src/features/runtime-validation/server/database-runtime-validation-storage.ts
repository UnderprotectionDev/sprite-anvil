import type { Database } from "@sprite-anvil/db";
import {
	runtimeValidationEvidence,
	runtimeValidationRecords,
} from "@sprite-anvil/db/schema/runtime-validation";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { RuntimeValidationStorage } from "./runtime-validation-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

export function createDatabaseRuntimeValidationStorage(
	db: Database
): RuntimeValidationStorage {
	return {
		async findEvidence(projectId, evidenceId) {
			const [row] = await db
				.select()
				.from(runtimeValidationEvidence)
				.where(
					and(
						eq(runtimeValidationEvidence.projectId, projectId),
						eq(runtimeValidationEvidence.id, evidenceId)
					)
				);
			return row ?? null;
		},
		async findRecord(projectId, recordId) {
			const [row] = await db
				.select()
				.from(runtimeValidationRecords)
				.where(
					and(
						eq(runtimeValidationRecords.projectId, projectId),
						eq(runtimeValidationRecords.id, recordId)
					)
				);
			return row ?? null;
		},
		async insertEvidence(evidence) {
			try {
				await db.insert(runtimeValidationEvidence).values(evidence);
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async insertRecord(record) {
			try {
				await db.insert(runtimeValidationRecords).values(record);
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async listEvidence(projectId, recordIds) {
			if (recordIds.length === 0) {
				return [];
			}
			return await db
				.select()
				.from(runtimeValidationEvidence)
				.where(
					and(
						eq(runtimeValidationEvidence.projectId, projectId),
						inArray(runtimeValidationEvidence.recordId, recordIds)
					)
				)
				.orderBy(
					asc(runtimeValidationEvidence.createdAt),
					asc(runtimeValidationEvidence.id)
				);
		},
		async listRecords(projectId, bundleId) {
			return await db
				.select()
				.from(runtimeValidationRecords)
				.where(
					bundleId === undefined
						? eq(runtimeValidationRecords.projectId, projectId)
						: and(
								eq(runtimeValidationRecords.projectId, projectId),
								eq(runtimeValidationRecords.bundleId, bundleId)
							)
				)
				.orderBy(
					asc(runtimeValidationRecords.createdAt),
					asc(runtimeValidationRecords.id)
				);
		},
	};
}
