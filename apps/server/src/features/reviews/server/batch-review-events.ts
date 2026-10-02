import type {
	AssetVersionBatchReviewInput,
	AssetVersionReviewEvent,
} from "@sprite-anvil/api/asset-versions";
import { assetVersionReviewEventSchema } from "@sprite-anvil/api/asset-versions";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetVersionReviewEvents } from "@sprite-anvil/db/schema/asset-versions";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

export async function readBatchReviewEvents(
	db: Database,
	userId: string,
	input: AssetVersionBatchReviewInput
): Promise<AssetVersionReviewEvent[] | "conflict" | null> {
	if (!(await getProjectForUser(db, userId, input.projectId))) {
		return null;
	}
	const rows = await db
		.select()
		.from(assetVersionReviewEvents)
		.where(
			and(
				eq(assetVersionReviewEvents.projectId, input.projectId),
				like(assetVersionReviewEvents.id, `batch:${input.idempotencyKey}:%`)
			)
		)
		.orderBy(asc(assetVersionReviewEvents.id));
	if (rows.length === 0) {
		return null;
	}
	if (
		rows.length !== input.targets.length ||
		rows.some(
			(row, index) =>
				row.versionId !== input.targets[index]?.assetVersionId ||
				row.decision !== input.decision ||
				row.rationale !== input.rationale.trim() ||
				row.createdByUserId !== userId
		)
	) {
		return "conflict";
	}
	return rows.map((row) =>
		assetVersionReviewEventSchema.parse({
			id: row.id,
			assetVersionId: row.versionId,
			type: row.decision,
			rationale: row.rationale,
			createdAt: row.createdAt.toISOString(),
		})
	);
}

export async function recordBatchReviewEvents(
	db: Database,
	userId: string,
	input: AssetVersionBatchReviewInput
): Promise<AssetVersionReviewEvent[] | null> {
	const targets = input.targets.map((target, index) => ({
		version_id: target.assetVersionId,
		expected_event_id: target.expectedReviewEventId,
		id: `batch:${input.idempotencyKey}:${String(index).padStart(3, "0")}`,
	}));
	try {
		const query = new PgDialect().sqlToQuery(sql`
			WITH targets AS (
				SELECT * FROM jsonb_to_recordset(${JSON.stringify(targets)}::jsonb)
				AS target(version_id text, expected_event_id text, id text)
			), eligible AS (
				SELECT target.*, version.asset_record_id FROM targets target
				JOIN asset_versions version ON version.id = target.version_id AND version.project_id = ${input.projectId}
				WHERE (SELECT event.id FROM asset_version_review_events event
					WHERE event.project_id = ${input.projectId} AND event.version_id = target.version_id
					ORDER BY event.created_at DESC, event.id DESC LIMIT 1)
					IS NOT DISTINCT FROM target.expected_event_id
			)
			INSERT INTO asset_version_review_events (id, project_id, asset_record_id, version_id, decision, rationale, created_by_user_id)
			SELECT id, ${input.projectId}, asset_record_id, version_id, ${input.decision}, ${input.rationale.trim()}, ${userId}
			FROM eligible WHERE (SELECT count(*) FROM eligible) = ${targets.length}
			RETURNING id
		`);
		const [result] = await db.$client.transaction(
			[db.$client.query(query.sql, query.params)],
			{ isolationLevel: "Serializable", fullResults: true }
		);
		if (!result || result.rows.length === 0) {
			const existing = await readBatchReviewEvents(db, userId, input);
			return existing === "conflict" ? null : existing;
		}
	} catch (error) {
		const existing = await readBatchReviewEvents(db, userId, input);
		if (existing === "conflict") {
			return null;
		}
		if (existing) {
			return existing;
		}
		if (error instanceof Error && "code" in error && error.code === "40001") {
			return null;
		}
		throw error;
	}
	const events = await readBatchReviewEvents(db, userId, input);
	return events === "conflict" ? null : events;
}
