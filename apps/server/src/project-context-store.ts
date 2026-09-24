import type {
	ContextProposal,
	ContextRevision,
	ContextRule,
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
		sourceProposalId: row.sourceProposalId,
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
					sourceProposalId: contextRevisions.sourceProposalId,
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
						row.sourceProposalId !== undefined &&
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
						sourceProposalId: row.sourceProposalId,
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
					sourceProposalId: null,
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

		async getProposal(userId: string, projectId: string, proposalId: string) {
			const rows = await db
				.select({ proposal: contextProposals.proposal })
				.from(contextProposals)
				.innerJoin(
					projectTable,
					eq(projectTable.id, contextProposals.projectId)
				)
				.where(
					and(
						eq(contextProposals.id, proposalId),
						eq(contextProposals.projectId, projectId),
						eq(projectTable.ownerUserId, userId)
					)
				)
				.limit(1);
			const proposal = rows[0]?.proposal;
			return proposal ? contextProposalSchema.parse(proposal) : null;
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

		async activateProposal(input) {
			const id = crypto.randomUUID();
			const createdAt = new Date();
			const result = await db.execute(sql`
				WITH already_activated AS (
					SELECT revision.*
					FROM context_revisions AS revision
					INNER JOIN context_proposals AS proposal
						ON proposal.id = revision.source_proposal_id
						AND proposal.project_id = revision.project_id
					INNER JOIN project AS owned_project
						ON owned_project.id = revision.project_id
					WHERE revision.project_id = ${input.projectId}
						AND revision.source_proposal_id = ${input.proposalId}
						AND revision.state = 'active'
						AND owned_project.owner_user_id = ${input.userId}
				), authorized_proposal AS (
					SELECT proposal.id
					FROM context_proposals AS proposal
					INNER JOIN project AS owned_project
						ON owned_project.id = proposal.project_id
					WHERE proposal.id = ${input.proposalId}
						AND proposal.project_id = ${input.projectId}
						AND owned_project.owner_user_id = ${input.userId}
						AND NOT EXISTS (
							SELECT 1
							FROM context_revisions AS prior_revision
							WHERE prior_revision.project_id = proposal.project_id
								AND prior_revision.source_proposal_id = proposal.id
						)
				), target_revision AS (
					SELECT revision.id, revision.revision_number
					FROM context_revisions AS revision
					INNER JOIN project AS owned_project
						ON owned_project.id = revision.project_id
					WHERE revision.project_id = ${input.projectId}
						AND revision.id = ${input.expectedCurrentRevisionId}
						AND revision.state IN ('baseline', 'active')
						AND owned_project.owner_user_id = ${input.userId}
				), deactivated AS (
					UPDATE context_revisions AS revision
					SET state = 'inactive'
					FROM target_revision
					WHERE revision.id = target_revision.id
						AND revision.state IN ('baseline', 'active')
						AND revision.revision_number = target_revision.revision_number
						AND EXISTS (SELECT 1 FROM authorized_proposal)
						AND NOT EXISTS (SELECT 1 FROM already_activated)
					RETURNING revision.revision_number
				), inserted AS (
					INSERT INTO context_revisions (
						id,
						project_id,
						revision_number,
						state,
						source_proposal_id,
						contract_version,
						rules,
						created_by_user_id,
						created_at
					)
					SELECT
						${id},
						${input.projectId},
						deactivated.revision_number + 1,
						'active',
						${input.proposalId},
						${input.ruleContractVersion},
						${JSON.stringify(input.rules)}::jsonb,
						${input.userId},
						${createdAt}
					FROM deactivated
					ON CONFLICT DO NOTHING
					RETURNING *
				)
				SELECT
					id,
					project_id AS "projectId",
					revision_number AS "revisionNumber",
					state,
					source_proposal_id AS "sourceProposalId",
					contract_version AS "contractVersion",
					rules,
					created_by_user_id AS "createdByUserId",
					created_at AS "createdAt"
				FROM already_activated
				UNION ALL
				SELECT
					id,
					project_id AS "projectId",
					revision_number AS "revisionNumber",
					state,
					source_proposal_id AS "sourceProposalId",
					contract_version AS "contractVersion",
					rules,
					created_by_user_id AS "createdByUserId",
					created_at AS "createdAt"
				FROM inserted
				LIMIT 1
			`);
			const [row] = result.rows as Array<{
				id: string;
				projectId: string;
				revisionNumber: number;
				state: "baseline" | "active" | "inactive";
				sourceProposalId: string | null;
				contractVersion: string;
				rules: ContextRule[];
				createdAt: Date | string;
			}>;
			if (row) {
				return contextRevisionSchema.parse({
					id: row.id,
					projectId: row.projectId,
					revisionNumber: row.revisionNumber,
					sourceProposalId: row.sourceProposalId,
					ruleContractVersion: row.contractVersion,
					isActive: row.state === "active",
					rules: row.rules,
					createdAt: toISOString(row.createdAt),
				});
			}

			const existingRows = await db
				.select({ revision: contextRevisions })
				.from(contextRevisions)
				.innerJoin(
					projectTable,
					eq(projectTable.id, contextRevisions.projectId)
				)
				.where(
					and(
						eq(contextRevisions.projectId, input.projectId),
						eq(contextRevisions.sourceProposalId, input.proposalId),
						eq(projectTable.ownerUserId, input.userId)
					)
				)
				.limit(1);
			const existing = existingRows[0]?.revision;
			return existing ? mapContextRevision(existing) : null;
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
