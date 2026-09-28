import type { SourceMetadataMappingProposalStore } from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataMappingFinalizationSchema,
	sourceMetadataMappingProposalSchema,
} from "@sprite-anvil/api/source-metadata-mapping";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import {
	sourceMetadataMappingFinalizations,
	sourceMetadataMappingProposals,
} from "@sprite-anvil/db/schema/source-metadata-mapping";
import { and, desc, eq, inArray } from "drizzle-orm";

export function createSourceMetadataMappingProposalStore(
	db: Database
): SourceMetadataMappingProposalStore {
	return {
		async getFinalization(userId, projectId, proposalId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return null;
			}
			const [row] = await db
				.select()
				.from(sourceMetadataMappingFinalizations)
				.where(
					and(
						eq(sourceMetadataMappingFinalizations.projectId, projectId),
						eq(sourceMetadataMappingFinalizations.proposalId, proposalId),
						eq(sourceMetadataMappingFinalizations.createdByUserId, userId)
					)
				)
				.limit(1);
			return row?.status === "completed" && row.assetVersionId
				? sourceMetadataMappingFinalizationSchema.parse({
						proposalId: row.proposalId,
						assetRecordId: row.assetRecordId,
						assetVersionId: row.assetVersionId,
						decisions: row.decisions,
						createdAt: row.createdAt.toISOString(),
					})
				: null;
		},
		async reserveFinalization(userId, projectId, proposalId, input) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return "not_found";
			}
			const [proposal] = await db
				.select({ id: sourceMetadataMappingProposals.id })
				.from(sourceMetadataMappingProposals)
				.where(
					and(
						eq(sourceMetadataMappingProposals.id, proposalId),
						eq(sourceMetadataMappingProposals.projectId, projectId)
					)
				)
				.limit(1);
			if (!proposal) {
				return "not_found";
			}
			await db
				.insert(sourceMetadataMappingFinalizations)
				.values({
					proposalId,
					projectId,
					assetRecordId: input.assetRecordId,
					assetVersionId: null,
					decisions: input.decisions,
					status: "pending",
					createdByUserId: userId,
				})
				.onConflictDoNothing();
			const [row] = await db
				.select()
				.from(sourceMetadataMappingFinalizations)
				.where(eq(sourceMetadataMappingFinalizations.proposalId, proposalId))
				.limit(1);
			return row?.projectId === projectId &&
				row.createdByUserId === userId &&
				row.assetRecordId === input.assetRecordId &&
				JSON.stringify(row.decisions) === JSON.stringify(input.decisions)
				? "reserved"
				: "conflict";
		},
		async completeFinalization(userId, projectId, proposalId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return null;
			}
			const [row] = await db
				.update(sourceMetadataMappingFinalizations)
				.set({
					assetVersionId: proposalId,
					status: "completed",
				})
				.where(
					and(
						eq(sourceMetadataMappingFinalizations.proposalId, proposalId),
						eq(sourceMetadataMappingFinalizations.projectId, projectId),
						eq(sourceMetadataMappingFinalizations.createdByUserId, userId)
					)
				)
				.returning();
			return row
				? sourceMetadataMappingFinalizationSchema.parse({
						proposalId: row.proposalId,
						assetRecordId: row.assetRecordId,
						assetVersionId: row.assetVersionId,
						decisions: row.decisions,
						createdAt: row.createdAt.toISOString(),
					})
				: null;
		},
		async createProposal(userId, projectId, sourceEntryId, rawProposal) {
			const proposal = sourceMetadataMappingProposalSchema.parse(rawProposal);
			if (
				proposal.projectId !== projectId ||
				proposal.source.entryId !== sourceEntryId
			) {
				return null;
			}

			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}

			const entryIds = new Set([
				sourceEntryId,
				...proposal.sidecars.map((sidecar) => sidecar.entryId),
			]);
			const ownedEntries = await db
				.select({ id: importInboxEntries.id })
				.from(importInboxEntries)
				.innerJoin(project, eq(project.id, importInboxEntries.projectId))
				.where(
					and(
						eq(importInboxEntries.projectId, projectId),
						eq(project.ownerUserId, userId),
						inArray(importInboxEntries.id, [...entryIds])
					)
				);
			if (ownedEntries.length !== entryIds.size) {
				return null;
			}

			await db.insert(sourceMetadataMappingProposals).values({
				createdByUserId: userId,
				id: proposal.id,
				projectId,
				proposal,
				sourceEntryId,
			});
			return proposal;
		},

		async listProposals(userId, projectId, sourceEntryId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [sourceEntry] = await db
				.select({ id: importInboxEntries.id })
				.from(importInboxEntries)
				.innerJoin(project, eq(project.id, importInboxEntries.projectId))
				.where(
					and(
						eq(importInboxEntries.id, sourceEntryId),
						eq(importInboxEntries.projectId, projectId),
						eq(project.ownerUserId, userId)
					)
				)
				.limit(1);
			if (!sourceEntry) {
				return null;
			}

			const rows = await db
				.select({ proposal: sourceMetadataMappingProposals.proposal })
				.from(sourceMetadataMappingProposals)
				.where(
					and(
						eq(sourceMetadataMappingProposals.projectId, projectId),
						eq(sourceMetadataMappingProposals.sourceEntryId, sourceEntryId)
					)
				)
				.orderBy(desc(sourceMetadataMappingProposals.createdAt));
			return rows.map((row) =>
				sourceMetadataMappingProposalSchema.parse(row.proposal)
			);
		},
	};
}
