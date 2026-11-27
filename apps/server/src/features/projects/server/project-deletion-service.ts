import { ORPCError } from "@orpc/server";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import { isBackgroundOperationActive } from "@sprite-anvil/api/background-operations";
import type {
	ProjectDeletionApproveInput,
	ProjectDeletionJob,
	ProjectDeletionStore,
} from "@sprite-anvil/api/project-deletion";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import { idempotentRecordId } from "@sprite-anvil/api/record-publication";
import { insertBackgroundOperationWithOutbox } from "@sprite-anvil/db/background-operation-publication";
import type {
	InteractiveDatabase,
	InteractiveTransaction,
} from "@sprite-anvil/db/interactive-database";
import {
	projectDeletionRemovingStep,
	projectDeletionScopeSummary,
} from "@sprite-anvil/db/project-access";
import { backgroundOperations } from "@sprite-anvil/db/schema/background-operations";
import { managedObjectOwnerGates } from "@sprite-anvil/db/schema/managed-object-reservations";
import { project } from "@sprite-anvil/db/schema/project";
import { projectDeletionJobs } from "@sprite-anvil/db/schema/project-deletion";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ManagedObjectErasureGate } from "../../../managed-object-reservations";
import type { ProjectDeletionObjects } from "./project-deletion-scope";
import {
	clearProjectRows,
	lockProjectScopedRows,
	readProjectObjectScope,
	readProjectRecordScope,
} from "./project-deletion-scope";

interface OperationHandlerContext {
	checkpoint: () => Promise<void>;
	operation: BackgroundOperation;
	reportProgress: (progress: {
		percent: number | null;
		step: string | null;
	}) => Promise<void>;
}
export interface ProjectDeletionServiceOptions {
	db: InteractiveDatabase;
	gate: ManagedObjectErasureGate;
	objects: ProjectDeletionObjects;
	operationStorage: {
		get: (id: string) => Promise<BackgroundOperation | null>;
	};

	permanentFailure: (message: string) => Error;
}
type JobRow = typeof projectDeletionJobs.$inferSelect;
type Reader = Pick<InteractiveTransaction, "select" | "execute">;

async function getOwnedProject(db: Reader, userId: string, projectId: string) {
	const [record] = await db
		.select()
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.ownerUserId, userId)))
		.limit(1);
	return record ?? null;
}
async function activeOperations(
	db: Reader,
	projectId: string,
	exceptId?: string
) {
	const rows = await db
		.select({
			id: backgroundOperations.id,
			status: backgroundOperations.status,
		})
		.from(backgroundOperations)
		.where(eq(backgroundOperations.projectId, projectId));
	return rows.some(
		(row) => row.id !== exceptId && isBackgroundOperationActive(row.status)
	);
}
async function computeScope(
	db: Reader,
	objects: ProjectDeletionObjects,
	ownerId: string,
	projectId: string
) {
	const { recordDigest, records } = await readProjectRecordScope(db, projectId);
	const { objectKeys, sharedKeys, safe } = await readProjectObjectScope(
		db,
		objects,
		ownerId,
		projectId
	);
	const scopeDigest = await recordContentDigest({
		recordDigest,
		objectKeys,
		sharedKeys,
	});
	return {
		scopeDigest,
		recordDigest,
		objectKeys,
		sharedKeys,
		impact: {
			records,
			managedObjects: objectKeys.length,
			sharedObjects: sharedKeys.length,
		},
		safe,
	};
}
async function lockProject(
	tx: InteractiveTransaction,
	ownerId: string,
	projectId: string
) {
	const [record] = await tx
		.select()
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.ownerUserId, ownerId)))
		.for("update");
	return record ?? null;
}
async function assertDeletionApproval(
	tx: InteractiveTransaction,
	name: string,
	input: ProjectDeletionApproveInput
) {
	if (name !== input.confirmation) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Type the exact project name to confirm.",
		});
	}
	if (await activeOperations(tx, input.projectId)) {
		throw new ORPCError("CONFLICT", {
			message: "Finish active project operations before deletion.",
		});
	}
}
async function reusableApproval(
	tx: InteractiveTransaction,
	ownerId: string,
	input: ProjectDeletionApproveInput
) {
	const [previous] = await tx
		.select()
		.from(projectDeletionJobs)
		.where(
			and(
				eq(projectDeletionJobs.projectId, input.projectId),
				eq(projectDeletionJobs.ownerUserId, ownerId)
			)
		)
		.orderBy(desc(projectDeletionJobs.createdAt))
		.limit(1);
	if (previous?.state === "removing") {
		throw new ORPCError("CONFLICT", {
			message:
				"A previous deletion already started; its job must be resolved before a new approval.",
		});
	}
	if (previous?.state === "approved" && !previous.operationId) {
		if (previous.scopeDigest === input.scopeDigest) {
			return previous;
		}
		throw new ORPCError("CONFLICT", {
			message: "A deletion approval is awaiting its operation.",
		});
	}

	return null;
}
async function assertScopeMatches(
	db: InteractiveDatabase,
	job: JobRow,
	scope: Awaited<ReturnType<typeof computeScope>>,
	permanentFailure: (message: string) => Error
) {
	const approved = new Set(job.plan.objectKeys);
	if (
		(job.state !== "removing" && scope.scopeDigest !== job.scopeDigest) ||
		scope.recordDigest !== job.plan.recordDigest ||
		!scope.safe ||
		scope.objectKeys.some((key) => !approved.has(key)) ||
		scope.sharedKeys.some((key) => approved.has(key)) ||
		scope.impact.sharedObjects !== job.impact.sharedObjects
	) {
		if (job.state !== "removing") {
			await db
				.update(projectDeletionJobs)
				.set({ state: "rejected" })
				.where(eq(projectDeletionJobs.id, job.id));
		}
		throw permanentFailure(
			"Project deletion scope changed; review a new impact report."
		);
	}
}
async function removeApprovedObjects(
	objects: ProjectDeletionObjects,
	job: JobRow,
	sharedKeys: string[]
) {
	for (const key of job.plan.objectKeys) {
		// biome-ignore lint/performance/noAwaitInLoops: Each deletion is independently retryable.
		await objects.delete(key);
		if ((await objects.list(key)).includes(key)) {
			throw new Error("An approved object remains.");
		}
	}
	const remaining = await objects.list(
		`projects/${encodeURIComponent(job.projectId)}/`
	);
	if (remaining.some((key) => !sharedKeys.includes(key))) {
		throw new Error("Some approved managed objects remain.");
	}
}
async function findPriorApproval(
	tx: InteractiveTransaction,
	ownerId: string,
	id: string,
	scopeDigest: string
) {
	const [existing] = await tx
		.select()
		.from(projectDeletionJobs)
		.where(
			and(
				eq(projectDeletionJobs.id, id),
				eq(projectDeletionJobs.ownerUserId, ownerId)
			)
		);
	if (existing && existing.scopeDigest !== scopeDigest) {
		throw new ORPCError("CONFLICT", { message: "Deletion approval changed." });
	}
	return existing;
}
export function createProjectDeletionService(
	options: ProjectDeletionServiceOptions
): ProjectDeletionStore & {
	execute: (ctx: OperationHandlerContext) => Promise<string>;
} {
	const { db, objects, gate, operationStorage, permanentFailure } = options;
	async function latest(ownerId: string, projectId: string) {
		const [row] = await db
			.select()
			.from(projectDeletionJobs)
			.where(
				and(
					eq(projectDeletionJobs.projectId, projectId),
					eq(projectDeletionJobs.ownerUserId, ownerId)
				)
			)
			.orderBy(desc(projectDeletionJobs.createdAt))
			.limit(1);
		return row ?? null;
	}
	async function toJob(row: JobRow): Promise<ProjectDeletionJob> {
		return {
			id: row.id,
			projectId: row.projectId,
			state: row.state,
			impact: row.impact,
			operation: row.operationId
				? await operationStorage.get(row.operationId)
				: null,
			completedAt: row.completedAt?.toISOString() ?? null,
		};
	}
	async function enqueueInTransaction(
		tx: InteractiveTransaction,
		row: JobRow,
		retryKey?: string
	) {
		const id = await idempotentRecordId(
			{
				kind: "background-operation",
				projectId: row.projectId,
				targetId: row.id,
				userId: row.ownerUserId,
			},
			retryKey ?? `project-deletion:${row.id}`
		);
		await insertBackgroundOperationWithOutbox(tx, {
			id,
			kind: "deletion",
			projectId: row.projectId,
			scopeTargetId: row.id,
			triggeredByUserId: row.ownerUserId,
			scopeSummary: projectDeletionScopeSummary,
			triggerSummary: "Project deletion explicitly confirmed by its owner",
		});
		await tx
			.update(projectDeletionJobs)
			.set({ operationId: id })
			.where(eq(projectDeletionJobs.id, row.id));
		return { ...row, operationId: id };
	}

	function ensureOperation(tx: InteractiveTransaction, row: JobRow) {
		if (row.operationId || row.state === "completed") {
			return row;
		}
		return enqueueInTransaction(tx, row);
	}

	async function request(ownerId: string, input: ProjectDeletionApproveInput) {
		const id = await idempotentRecordId(
			{
				kind: "project-deletion",
				projectId: input.projectId,
				targetId: input.projectId,
				userId: ownerId,
			},
			input.idempotencyKey
		);
		const row = await db.transaction(async (tx) => {
			const existing = await findPriorApproval(
				tx,
				ownerId,
				id,
				input.scopeDigest
			);
			if (existing) {
				return ensureOperation(tx, existing);
			}
			const record = await lockProject(tx, ownerId, input.projectId);
			if (!record) {
				return null;
			}
			await assertDeletionApproval(tx, record.name, input);
			const previous = await reusableApproval(tx, ownerId, input);
			if (previous) {
				return enqueueInTransaction(tx, previous);
			}
			const scope = await computeScope(tx, objects, ownerId, input.projectId);
			if (!scope.safe || scope.scopeDigest !== input.scopeDigest) {
				throw new ORPCError("CONFLICT", {
					message: "The deletion scope changed. Review a fresh impact report.",
				});
			}
			const [inserted] = await tx
				.insert(projectDeletionJobs)
				.values({
					id,
					projectId: input.projectId,
					ownerUserId: ownerId,
					scopeDigest: scope.scopeDigest,
					impact: scope.impact,
					plan: {
						objectKeys: scope.objectKeys,
						recordDigest: scope.recordDigest,
					},
				})
				.returning();
			return inserted ? enqueueInTransaction(tx, inserted) : null;
		});
		if (!row) {
			return null;
		}
		return toJob(row);
	}
	return {
		async prepare(ownerId, projectId) {
			const record = await getOwnedProject(db, ownerId, projectId);
			if (!record) {
				return null;
			}
			const scope = await computeScope(db, objects, ownerId, projectId);
			return {
				projectId,
				projectName: record.name,
				scopeDigest: scope.scopeDigest,
				...scope.impact,
				blocked: !scope.safe || (await activeOperations(db, projectId)),
			};
		},
		request,
		async retry(ownerId, jobId) {
			const row = await db.transaction(async (tx) => {
				const [job] = await tx
					.select()
					.from(projectDeletionJobs)
					.where(
						and(
							eq(projectDeletionJobs.id, jobId),
							eq(projectDeletionJobs.ownerUserId, ownerId)
						)
					)
					.for("update");
				if (!job?.operationId) {
					return null;
				}
				if (job.state === "completed" || job.state === "rejected") {
					throw new ORPCError("CONFLICT", {
						message: "This deletion cannot be retried.",
					});
				}
				const [operation] = await tx
					.select()
					.from(backgroundOperations)
					.where(eq(backgroundOperations.id, job.operationId));
				if (operation?.status !== "failed") {
					return job;
				}
				return enqueueInTransaction(
					tx,
					job,
					`project-deletion-retry:${operation.id}`
				);
			});
			return row ? toJob(row) : null;
		},
		async list(ownerId) {
			const rows = await db
				.select()
				.from(projectDeletionJobs)
				.where(eq(projectDeletionJobs.ownerUserId, ownerId))
				.orderBy(desc(projectDeletionJobs.createdAt));
			return Promise.all(rows.map(toJob));
		},
		async read(ownerId, projectId) {
			const row = await latest(ownerId, projectId);
			return row ? toJob(row) : null;
		},

		async execute(context) {
			const { operation } = context;
			const [job] = await db
				.select()
				.from(projectDeletionJobs)
				.where(
					and(
						eq(projectDeletionJobs.id, operation.scopeTargetId ?? ""),
						eq(projectDeletionJobs.projectId, operation.projectId),
						eq(projectDeletionJobs.ownerUserId, operation.triggeredByUserId)
					)
				);
			if (!job || job.operationId !== operation.id) {
				throw permanentFailure(
					"Project deletion approval not found or superseded."
				);
			}
			if (job.state === "completed") {
				return "Project deletion receipt already recorded.";
			}
			if (!(await gate.beginErasure(job.ownerUserId, job.id))) {
				throw new Error(
					"Temporary managed objects are still in use. Deletion is blocked."
				);
			}
			try {
				if (job.state !== "removing") {
					await context.checkpoint();
				}
				await context.reportProgress({
					percent: null,
					step:
						job.state === "removing"
							? projectDeletionRemovingStep
							: "Verifying approved project scope",
				});
				await db.transaction(async (tx) => {
					const record = await lockProject(tx, job.ownerUserId, job.projectId);
					if (!record) {
						throw permanentFailure("Project no longer exists.");
					}
					if (await activeOperations(tx, job.projectId, operation.id)) {
						throw new Error("Other project operations are still active.");
					}
					await lockProjectScopedRows(tx, job.projectId);
					const scope = await computeScope(
						tx,
						objects,
						job.ownerUserId,
						job.projectId
					);
					await assertScopeMatches(db, job, scope, permanentFailure);
					if (job.state !== "removing") {
						await context.checkpoint();
					}
					// Persist the irreversible boundary outside the transaction so a storage
					// interruption cannot turn an already-started removal into a cancel.
					await context.reportProgress({
						percent: null,
						step: projectDeletionRemovingStep,
					});
					await db
						.update(projectDeletionJobs)
						.set({ state: "removing" })
						.where(eq(projectDeletionJobs.id, job.id));
					await removeApprovedObjects(objects, job, scope.sharedKeys);
					await clearProjectRows(tx, job.projectId);
					await tx
						.update(projectDeletionJobs)
						.set({
							state: "completed",
							completedAt: new Date(),
							plan: { objectKeys: [], recordDigest: job.plan.recordDigest },
						})
						.where(eq(projectDeletionJobs.id, job.id));
					// Release with the receipt; a worker crash after commit must not strand the gate.
					await tx
						.update(managedObjectOwnerGates)
						.set({
							erasureOperationId: null,
							generation: sql`${managedObjectOwnerGates.generation} + 1`,
						})
						.where(
							and(
								eq(managedObjectOwnerGates.ownerUserId, job.ownerUserId),
								eq(managedObjectOwnerGates.erasureOperationId, job.id)
							)
						);
				});
				return "Project deletion completed. Backup cleanup deadline is not published.";
			} finally {
				await gate.endErasure(job.ownerUserId, job.id);
			}
		},
	};
}
