import type { Database } from "@sprite-anvil/db";
import {
	runtimeValidationDecisions,
	runtimeValidationEvidence,
	runtimeValidationRecords,
} from "@sprite-anvil/db/schema/runtime-validation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { RuntimeValidationStorage } from "./runtime-validation-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function rowCountOf(result: unknown): number {
	const { rowCount, rows } = result as { rowCount?: number; rows?: unknown[] };
	return rowCount ?? rows?.length ?? 0;
}

export function createDatabaseRuntimeValidationStorage(
	db: Database
): RuntimeValidationStorage {
	/** `select ... for update` on the record row: concurrent evidence and outcome inserts take turns. */
	const lockRecord = (projectId: string, recordId: string) =>
		db.execute(sql`
			select id from ${runtimeValidationRecords}
			where project_id = ${projectId} and id = ${recordId}
			for update
		`);

	return {
		async findDecision(projectId, decisionId) {
			const [row] = await db
				.select()
				.from(runtimeValidationDecisions)
				.where(
					and(
						eq(runtimeValidationDecisions.projectId, projectId),
						eq(runtimeValidationDecisions.id, decisionId)
					)
				);
			return row ?? null;
		},
		async insertDecision(decision) {
			try {
				if (decision.kind === "outcome") {
					// Takes the same record row lock as evidence, so the two are ordered.
					await db.batch([
						lockRecord(decision.projectId, decision.recordId),
						db.insert(runtimeValidationDecisions).values(decision),
					]);
				} else {
					await db.insert(runtimeValidationDecisions).values(decision);
				}
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async listDecisions(projectId, recordIds) {
			if (recordIds.length === 0) {
				return [];
			}
			return await db
				.select()
				.from(runtimeValidationDecisions)
				.where(
					and(
						eq(runtimeValidationDecisions.projectId, projectId),
						inArray(runtimeValidationDecisions.recordId, recordIds)
					)
				)
				.orderBy(asc(runtimeValidationDecisions.sequence));
		},
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
				// One transaction (the neon-http driver has no interactive one). The first statement
				// locks the record row; the second then takes a fresh snapshot, so it sees any outcome
				// committed while it waited, and inserts only when there is none.
				const [, inserted] = await db.batch([
					lockRecord(evidence.projectId, evidence.recordId),
					db.execute(sql`
						insert into ${runtimeValidationEvidence} (
							id, project_id, record_id, kind, source, text, file_name,
							byte_size, sha256, object_key, request_digest,
							created_by_user_id, created_at
						)
						select
							${evidence.id}, ${evidence.projectId}, ${evidence.recordId},
							${evidence.kind}, ${evidence.source}, ${evidence.text}::text,
							${evidence.fileName}::text, ${evidence.byteSize}::integer,
							${evidence.sha256}::text, ${evidence.objectKey}::text,
							${evidence.requestDigest}, ${evidence.createdByUserId},
							${evidence.createdAt.toISOString()}::timestamp
						where not exists (
							select 1 from ${runtimeValidationDecisions}
							where project_id = ${evidence.projectId}
								and record_id = ${evidence.recordId}
								and kind = 'outcome'
						)
						returning id
					`),
				]);
				return rowCountOf(inserted) === 0
					? { status: "closed" }
					: { status: "inserted" };
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
