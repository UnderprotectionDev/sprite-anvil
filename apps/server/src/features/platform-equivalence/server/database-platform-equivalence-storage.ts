import { platformSurfaceSchema } from "@sprite-anvil/api/platform-equivalence-comparison";
import type { Database } from "@sprite-anvil/db";
import {
	platformEquivalenceReports,
	platformEquivalenceRuns,
} from "@sprite-anvil/db/schema/platform-equivalence";
import { and, asc, eq } from "drizzle-orm";
import type {
	PlatformEquivalenceStorage,
	StoredPlatformEquivalenceRun,
} from "./platform-equivalence-storage";

const uniqueViolationCode = "23505";

function hasErrorCode(error: unknown, expected: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const { cause, code } = error as { cause?: unknown; code?: unknown };
	return code === expected || hasErrorCode(cause, expected);
}

function toRun(
	row: typeof platformEquivalenceRuns.$inferSelect
): StoredPlatformEquivalenceRun {
	// The table check keeps the surface to web or desktop; a stray value fails loudly.
	return { ...row, surface: platformSurfaceSchema.parse(row.surface) };
}

export function createDatabasePlatformEquivalenceStorage(
	db: Database
): PlatformEquivalenceStorage {
	return {
		async findReport(projectId, reportId) {
			const [row] = await db
				.select()
				.from(platformEquivalenceReports)
				.where(
					and(
						eq(platformEquivalenceReports.projectId, projectId),
						eq(platformEquivalenceReports.id, reportId)
					)
				);
			return row ?? null;
		},
		async findRun(projectId, runId) {
			const [row] = await db
				.select()
				.from(platformEquivalenceRuns)
				.where(
					and(
						eq(platformEquivalenceRuns.projectId, projectId),
						eq(platformEquivalenceRuns.id, runId)
					)
				);
			return row ? toRun(row) : null;
		},
		async insertReport(report) {
			try {
				await db.insert(platformEquivalenceReports).values(report);
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		async insertRun(run) {
			try {
				await db.insert(platformEquivalenceRuns).values(run);
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},
		listReports(projectId) {
			return db
				.select()
				.from(platformEquivalenceReports)
				.where(eq(platformEquivalenceReports.projectId, projectId))
				.orderBy(
					asc(platformEquivalenceReports.createdAt),
					asc(platformEquivalenceReports.id)
				);
		},
		async listRuns(projectId) {
			const rows = await db
				.select()
				.from(platformEquivalenceRuns)
				.where(eq(platformEquivalenceRuns.projectId, projectId))
				.orderBy(
					asc(platformEquivalenceRuns.createdAt),
					asc(platformEquivalenceRuns.id)
				);
			return rows.map(toRun);
		},
	};
}
