import { isDeepStrictEqual } from "node:util";
import {
	type GameplayMetadataFrame,
	type GameplayMetadataStore,
	gameplayMetadataCatalogSchema,
	gameplayMetadataRecordSchema,
} from "@sprite-anvil/api/gameplay-metadata";
import type {
	SourceMetadataMappingFinalization,
	SourceMetadataMappingProposal,
} from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataMappingDecisionSchema,
	sourceMetadataMappingProposalSchema,
} from "@sprite-anvil/api/source-metadata-mapping";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { unitVersions } from "@sprite-anvil/db/schema/asset-versions";
import { gameplayMetadataRecords } from "@sprite-anvil/db/schema/gameplay-metadata";
import {
	sourceMetadataMappingFinalizations,
	sourceMetadataMappingProposals,
} from "@sprite-anvil/db/schema/source-metadata-mapping";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

function selectedFields(
	proposal: SourceMetadataMappingProposal,
	decisions: SourceMetadataMappingFinalization["decisions"]
) {
	return proposal.fields.filter((field) => {
		if (
			!proposal.conflicts.some(
				(conflict) =>
					conflict.field === field.field && conflict.key === field.key
			)
		) {
			return true;
		}
		return decisions.some(
			(decision) =>
				decision.field === field.field &&
				decision.key === field.key &&
				decision.sourceEntryId === field.sourceEntryId &&
				decision.sourcePath === field.sourcePath
		);
	});
}

export function createGameplayMetadataStore(
	db: Database
): GameplayMetadataStore {
	const store: GameplayMetadataStore = {
		async list(userId, projectId, assetRecordId) {
			if (!(await getProjectForUser(db, userId, projectId))) {
				return null;
			}
			const [record] = await db
				.select({ id: assetRecords.id })
				.from(assetRecords)
				.where(
					and(
						eq(assetRecords.projectId, projectId),
						eq(assetRecords.id, assetRecordId)
					)
				)
				.limit(1);
			if (!record) {
				return null;
			}
			const units = await db
				.select()
				.from(unitVersions)
				.where(
					and(
						eq(unitVersions.projectId, projectId),
						eq(unitVersions.assetRecordId, assetRecordId),
						eq(unitVersions.unitType, "frame")
					)
				);
			const frames: GameplayMetadataFrame[] = units.map((unit) => ({
				assetVersionId: unit.assetVersionId,
				frameKey: unit.unitKey,
				sourcePivots: [],
			}));
			const mappings = await db
				.select({
					proposal: sourceMetadataMappingProposals.proposal,
					assetVersionId: sourceMetadataMappingFinalizations.assetVersionId,
					decisions: sourceMetadataMappingFinalizations.decisions,
				})
				.from(sourceMetadataMappingFinalizations)
				.innerJoin(
					sourceMetadataMappingProposals,
					eq(
						sourceMetadataMappingProposals.id,
						sourceMetadataMappingFinalizations.proposalId
					)
				)
				.where(
					and(
						eq(sourceMetadataMappingFinalizations.projectId, projectId),
						eq(sourceMetadataMappingFinalizations.assetRecordId, assetRecordId),
						eq(sourceMetadataMappingFinalizations.status, "completed")
					)
				);
			for (const mapping of mappings) {
				if (!mapping.assetVersionId) {
					continue;
				}
				const proposal = sourceMetadataMappingProposalSchema.parse(
					mapping.proposal
				);
				const decisions = z
					.array(sourceMetadataMappingDecisionSchema)
					.parse(mapping.decisions);
				const fields = selectedFields(proposal, decisions);
				for (const field of fields.filter(
					(candidate) => candidate.field === "frame"
				)) {
					let frame = frames.find(
						(candidate) =>
							candidate.assetVersionId === mapping.assetVersionId &&
							candidate.frameKey === field.key
					);
					if (!frame) {
						frame = {
							assetVersionId: mapping.assetVersionId,
							frameKey: field.key,
							sourcePivots: [],
						};
						frames.push(frame);
					}
					frame.sourcePivots.push(
						...fields
							.filter(
								(candidate) =>
									candidate.field === "pivot" && candidate.key === field.key
							)
							.map((pivot) => ({
								kind: "finalized_source" as const,
								proposalId: proposal.id,
								sourceEntryId: pivot.sourceEntryId,
								sourcePath: pivot.sourcePath,
								value:
									pivot.value as GameplayMetadataFrame["sourcePivots"][number]["value"],
							}))
					);
				}
			}
			const rows = await db
				.select()
				.from(gameplayMetadataRecords)
				.where(
					and(
						eq(gameplayMetadataRecords.projectId, projectId),
						eq(gameplayMetadataRecords.assetRecordId, assetRecordId)
					)
				)
				.orderBy(
					desc(gameplayMetadataRecords.createdAt),
					desc(gameplayMetadataRecords.id)
				);
			return gameplayMetadataCatalogSchema.parse({
				frames,
				records: rows.map((row) => row.record),
			});
		},
		async append(userId, rawRecord) {
			const record = gameplayMetadataRecordSchema.parse(rawRecord);
			const catalog = await store.list(
				userId,
				record.projectId,
				record.assetRecordId
			);
			if (
				!catalog?.frames.some(
					(frame) =>
						frame.assetVersionId === record.assetVersionId &&
						frame.frameKey === record.frameKey
				)
			) {
				return null;
			}
			await db
				.insert(gameplayMetadataRecords)
				.values({
					id: record.id,
					projectId: record.projectId,
					assetRecordId: record.assetRecordId,
					assetVersionId: record.assetVersionId,
					contractRevisionId: record.contractRevisionId,
					record,
					createdByUserId: userId,
				})
				.onConflictDoNothing();
			const [row] = await db
				.select()
				.from(gameplayMetadataRecords)
				.where(
					and(
						eq(gameplayMetadataRecords.id, record.id),
						eq(gameplayMetadataRecords.projectId, record.projectId),
						eq(gameplayMetadataRecords.assetRecordId, record.assetRecordId),
						eq(gameplayMetadataRecords.createdByUserId, userId)
					)
				)
				.limit(1);
			if (!row) {
				return null;
			}
			const saved = gameplayMetadataRecordSchema.parse(row.record);
			return isDeepStrictEqual(
				{ ...saved, createdAt: null },
				{ ...record, createdAt: null }
			)
				? saved
				: null;
		},
	};
	return store;
}
