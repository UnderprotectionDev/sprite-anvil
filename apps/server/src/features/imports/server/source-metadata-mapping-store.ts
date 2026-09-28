import type { SourceMetadataMappingProposalStore } from "@sprite-anvil/api/source-metadata-mapping";
import { sourceMetadataMappingProposalSchema } from "@sprite-anvil/api/source-metadata-mapping";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import { sourceMetadataMappingProposals } from "@sprite-anvil/db/schema/source-metadata-mapping";
import { and, desc, eq, inArray } from "drizzle-orm";

export function createSourceMetadataMappingProposalStore(
	db: Database
): SourceMetadataMappingProposalStore {
	return {
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
