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
import {
	contextProposals,
	contextRevisions,
	projects,
} from "@sprite-anvil/db/schema/project-context";
import { and, asc, desc, eq } from "drizzle-orm";

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
					projectId: projects.id,
					name: projects.name,
					generalArtDirection: projects.generalArtDirection,
					projectCreatedAt: projects.createdAt,
					revisionId: contextRevisions.id,
					revisionNumber: contextRevisions.revisionNumber,
					revisionState: contextRevisions.state,
					ruleContractVersion: contextRevisions.contractVersion,
					rules: contextRevisions.rules,
					revisionCreatedAt: contextRevisions.createdAt,
				})
				.from(projects)
				.leftJoin(
					contextRevisions,
					and(
						eq(contextRevisions.projectId, projects.id),
						eq(contextRevisions.revisionNumber, 0)
					)
				)
				.where(eq(projects.ownerUserId, userId))
				.orderBy(asc(projects.createdAt));

			return rows.map((row) => {
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
					initialContextRevision: contextRevisionSchema.parse({
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
				.insert(projects)
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
			const [project] = projectRows;
			const [revision] = revisionRows;
			if (!(project && revision)) {
				throw new Error("Project Context could not be created");
			}

			return projectContextSchema.parse({
				id: project.id,
				name: project.name,
				generalArtDirection: project.generalArtDirection,
				createdAt: toISOString(project.createdAt),
				initialContextRevision: mapContextRevision(revision),
			});
		},

		async getRevision(userId: string, projectId: string, revisionId: string) {
			const rows = await db
				.select({ revision: contextRevisions })
				.from(contextRevisions)
				.innerJoin(projects, eq(projects.id, contextRevisions.projectId))
				.where(
					and(
						eq(contextRevisions.id, revisionId),
						eq(contextRevisions.projectId, projectId),
						eq(projects.ownerUserId, userId)
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
				.innerJoin(projects, eq(projects.id, contextProposals.projectId))
				.where(
					and(
						eq(contextProposals.projectId, projectId),
						eq(projects.ownerUserId, userId)
					)
				)
				.orderBy(desc(contextProposals.createdAt));

			return rows.map((row) => contextProposalSchema.parse(row.proposal));
		},
	};
}
