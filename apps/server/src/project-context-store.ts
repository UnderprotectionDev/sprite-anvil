import type {
	ContextProposal,
	ContextRevision,
	ProjectContextCreateInput,
	ProjectContextStore,
} from "@sprite-anvil/api/project-context";
import {
	contextProposalSchema,
	contextRevisionSchema,
	projectContextSchema,
} from "@sprite-anvil/api/project-context";
import type { Database } from "@sprite-anvil/db";
import { project as projectTable } from "@sprite-anvil/db/schema/project";
import {
	contextProposals,
	contextRevisions,
} from "@sprite-anvil/db/schema/project-context";
import { and, asc, desc, eq, or, sql } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function mapContextRevision(
	row: typeof contextRevisions.$inferSelect
): ContextRevision {
	return contextRevisionSchema.parse({
		id: row.id,
		projectId: row.projectId,
		revisionNumber: row.revisionNumber,
		ruleContractVersion: row.contractVersion,
		isActive: row.state === "active",
		rules: row.rules,
		createdAt: toISOString(row.createdAt),
	});
}

export function createProjectContextStore(db: Database): ProjectContextStore {
	return {
		async listProjects(userId) {
			const rows = await db
				.select({
					projectId: projectTable.id,
					name: projectTable.name,
					generalArtDirection: projectTable.generalArtDirection,
					projectCreatedAt: projectTable.createdAt,
					revisionId: contextRevisions.id,
					revisionNumber: contextRevisions.revisionNumber,
					revisionState: contextRevisions.state,
					ruleContractVersion: contextRevisions.contractVersion,
					rules: contextRevisions.rules,
					revisionCreatedAt: contextRevisions.createdAt,
				})
				.from(projectTable)
				.leftJoin(
					contextRevisions,
					and(
						eq(contextRevisions.projectId, projectTable.id),
						or(
							eq(contextRevisions.state, "active"),
							eq(contextRevisions.revisionNumber, 0)
						)
					)
				)
				.where(eq(projectTable.ownerUserId, userId))
				.orderBy(
					asc(projectTable.createdAt),
					desc(
						sql`case when ${contextRevisions.state} = 'active' then 1 else 0 end`
					),
					desc(contextRevisions.revisionNumber)
				);
			const currentRows = new Map<string, (typeof rows)[number]>();
			for (const row of rows) {
				if (!currentRows.has(row.projectId)) {
					currentRows.set(row.projectId, row);
				}
			}

			return [...currentRows.values()].map((row) => {
				if (
					!(
						row.revisionId &&
						row.revisionNumber !== null &&
						row.revisionState &&
						row.ruleContractVersion &&
						row.revisionCreatedAt
					)
				) {
					throw new Error(
						"Project Context is missing its initial Context Revision"
					);
				}
				return projectContextSchema.parse({
					id: row.projectId,
					name: row.name,
					generalArtDirection: row.generalArtDirection,
					createdAt: toISOString(row.projectCreatedAt),
					currentContextRevision: contextRevisionSchema.parse({
						id: row.revisionId,
						projectId: row.projectId,
						revisionNumber: row.revisionNumber,
						ruleContractVersion: row.ruleContractVersion,
						isActive: row.revisionState === "active",
						rules: row.rules,
						createdAt: toISOString(row.revisionCreatedAt),
					}),
				});
			});
		},

		async createProject(userId: string, input: ProjectContextCreateInput) {
			const id = crypto.randomUUID();
			const revisionId = crypto.randomUUID();
			const createdAt = new Date();
			const projectInsert = db
				.insert(projectTable)
				.values({
					id,
					ownerUserId: userId,
					name: input.name,
					generalArtDirection: input.generalArtDirection,
					createdAt,
				})
				.returning();
			const revisionInsert = db
				.insert(contextRevisions)
				.values({
					id: revisionId,
					projectId: id,
					revisionNumber: 0,
					state: "baseline",
					contractVersion: "context-rule/1.0.0",
					rules: [],
					createdByUserId: userId,
					createdAt,
				})
				.returning();

			const [projectRows, revisionRows] = await db.batch([
				projectInsert,
				revisionInsert,
			]);
			const [projectRecord] = projectRows;
			const [revision] = revisionRows;
			if (!(projectRecord && revision)) {
				throw new Error("Project Context could not be created");
			}

			return projectContextSchema.parse({
				id: projectRecord.id,
				name: projectRecord.name,
				generalArtDirection: projectRecord.generalArtDirection,
				createdAt: toISOString(projectRecord.createdAt),
				currentContextRevision: mapContextRevision(revision),
			});
		},

		async getRevision(userId: string, projectId: string, revisionId: string) {
			const rows = await db
				.select({ revision: contextRevisions })
				.from(contextRevisions)
				.innerJoin(
					projectTable,
					eq(projectTable.id, contextRevisions.projectId)
				)
				.where(
					and(
						eq(contextRevisions.id, revisionId),
						eq(contextRevisions.projectId, projectId),
						eq(projectTable.ownerUserId, userId)
					)
				)
				.limit(1);
			const row = rows[0]?.revision;
			return row ? mapContextRevision(row) : null;
		},

		async createProposal(userId: string, proposal: ContextProposal) {
			await db.insert(contextProposals).values({
				id: proposal.id,
				projectId: proposal.projectId,
				baseContextRevisionId: proposal.baseContextRevisionId,
				createdByUserId: userId,
				contractVersion: proposal.contractVersion,
				sourceKind: proposal.source.kind,
				proposal,
				createdAt: new Date(proposal.createdAt),
			});
		},

		async listProposals(userId: string, projectId: string) {
			const rows = await db
				.select({ proposal: contextProposals.proposal })
				.from(contextProposals)
				.innerJoin(
					projectTable,
					eq(projectTable.id, contextProposals.projectId)
				)
				.where(
					and(
						eq(contextProposals.projectId, projectId),
						eq(projectTable.ownerUserId, userId)
					)
				)
				.orderBy(desc(contextProposals.createdAt));

			return rows.map((row) => contextProposalSchema.parse(row.proposal));
		},
	};
}
