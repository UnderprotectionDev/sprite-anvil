import { sql } from "drizzle-orm";
import type { InteractiveTransaction } from "./interactive-database";
import { project } from "./schema/project";

export class ProjectNameConflictError extends Error {
	constructor() {
		super("A project with this name already exists.");
		this.name = "ProjectNameConflictError";
	}
}

/** Serialize all name-changing publications for one owner on the same
 * interactive transaction. The following read sees the earlier commit. */
export async function assertAvailableProjectNameInTransaction(
	tx: InteractiveTransaction,
	ownerId: string,
	name: string,
	exceptId?: string
) {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`project-name:${ownerId}`},0))`
	);
	const rows = await tx
		.select({ id: project.id })
		.from(project)
		.where(
			sql`${project.ownerUserId}=${ownerId} and lower(btrim(${project.name}))=lower(btrim(${name})) and (${exceptId ?? null}::text is null or ${project.id}<>${exceptId ?? null})`
		)
		.limit(1);
	if (rows.length) {
		throw new ProjectNameConflictError();
	}
}
