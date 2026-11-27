import { deliverySectionSchemas } from "@sprite-anvil/api/project-archive-delivery";
import { historySectionSchemas } from "@sprite-anvil/api/project-archive-history";
import type { FoundationRecords } from "@sprite-anvil/api/project-archives";
import type { Database } from "@sprite-anvil/db";
import { hasErrorCode } from "@sprite-anvil/db/error-codes";
import type {
	InteractiveDatabase,
	InteractiveTransaction,
} from "@sprite-anvil/db/interactive-database";
import { assertAvailableProjectNameInTransaction } from "@sprite-anvil/db/project-name";
import {
	assetFamilyCanonicalDesigns,
	assetFamilyRelationships,
} from "@sprite-anvil/db/schema/asset-families";
import { managedSnapshots } from "@sprite-anvil/db/schema/asset-production-history";
import { assetRecordMeasurements } from "@sprite-anvil/db/schema/asset-record-measurements";
import {
	assetRecordReferenceHistory,
	assetRecordReferences,
} from "@sprite-anvil/db/schema/asset-record-references";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	compositeVersions,
	compositionMemberships,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { themes, visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import {
	projectArchiveRestoreFiles,
	projectArchiveRestoreIds,
	projectArchiveRestoreRequests,
	projectArchiveRestoreSections,
	projectArchiveRestores,
} from "@sprite-anvil/db/schema/project-archives";
import {
	contextProposals,
	contextRevisions,
} from "@sprite-anvil/db/schema/project-context";
import {
	referenceBoardImageHistory,
	referenceBoardImages,
} from "@sprite-anvil/db/schema/reference-production";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import {
	archiveDeliveryDeleteQueries,
	canMaterializeArchiveDelivery,
	insertArchiveDelivery,
} from "./project-archive-delivery-materialization";
import { insertFoundationRelations } from "./project-archive-foundation-relations";
import {
	archiveHistoryDeleteQueries,
	canMaterializeArchiveHistory,
	insertArchiveHistory,
} from "./project-archive-history-materialization";
import { insertManagedFoundation } from "./project-archive-managed-foundation";
import type {
	ProjectArchiveRestoreRequestStorage,
	ProjectArchiveRestoreStorage,
	StoredProjectArchiveRestore,
	StoredProjectArchiveRestoreRecord,
	StoredProjectArchiveRestoreRequest,
} from "./project-archive-restore-storage";

const uniqueViolationCode = "23505";
/** Rows per insert statement, well under the database's bound-parameter limit. */
const insertChunkSize = 500;

function chunks<T>(rows: T[]): T[][] {
	const parts: T[][] = [];
	for (let index = 0; index < rows.length; index += insertChunkSize) {
		parts.push(rows.slice(index, index + insertChunkSize));
	}
	return parts;
}

function toRestore(
	row: typeof projectArchiveRestores.$inferSelect
): StoredProjectArchiveRestore {
	return {
		archiveId: row.archiveId,
		canonicalVerified: row.canonicalVerified,
		createdAt: row.createdAt,
		createdByUserId: row.createdByUserId,
		id: row.id,
		manifestDigest: row.manifestDigest,
		requestDigest: row.requestDigest,
		restoredProjectId: row.restoredProjectId,
		sourceProjectId: row.sourceProjectId,
		operationProjectId: row.operationProjectId,
	};
}

function toRequest(
	row: typeof projectArchiveRestoreRequests.$inferSelect
): StoredProjectArchiveRestoreRequest {
	return {
		archiveId: row.archiveId,
		createdAt: row.createdAt,
		id: row.id,
		idempotencyKey: row.idempotencyKey,
		projectId: row.projectId,
		projectName: row.projectName,
		requestDigest: row.requestDigest,
		requestedByUserId: row.requestedByUserId,
	};
}

async function insertFoundation(
	tx: InteractiveTransaction,
	record: StoredProjectArchiveRestoreRecord
) {
	const { restore } = record;
	const foundation = (name: keyof FoundationRecords) =>
		record.sections.find(
			(section) => section.group === "foundation" && section.name === name
		)?.records ?? [];
	const worlds = foundation(
		"visualWorlds"
	) as FoundationRecords["visualWorlds"];
	const restoredThemes = foundation("themes") as FoundationRecords["themes"];
	for (const rows of chunks(worlds)) {
		// biome-ignore lint/performance/noAwaitInLoops: The transaction writes records in FK order.
		await tx.insert(visualWorlds).values(
			rows.map((world) => ({
				...world,
				createdAt: new Date(world.createdAt),
				projectId: restore.restoredProjectId,
				createdByUserId: restore.createdByUserId,
			}))
		);
	}
	for (const rows of chunks(restoredThemes)) {
		// biome-ignore lint/performance/noAwaitInLoops: The transaction writes records in FK order.
		await tx.insert(themes).values(
			rows.map((theme) => ({
				...theme,
				createdAt: new Date(theme.createdAt),
				projectId: restore.restoredProjectId,
				createdByUserId: restore.createdByUserId,
			}))
		);
	}
	const subjects = foundation(
		"subjectIdentities"
	) as FoundationRecords["subjectIdentities"];
	const families = foundation(
		"assetFamilies"
	) as FoundationRecords["assetFamilies"];
	const records = foundation(
		"assetRecords"
	) as FoundationRecords["assetRecords"];
	for (const rows of chunks(subjects)) {
		// biome-ignore lint/performance/noAwaitInLoops: FK-ordered transaction.
		await tx.insert(subjectIdentities).values(
			rows.map((row) => ({
				...row,
				createdAt: new Date(row.createdAt),
				projectId: restore.restoredProjectId,
				createdByUserId: restore.createdByUserId,
			}))
		);
	}
	for (const rows of chunks(families)) {
		// biome-ignore lint/performance/noAwaitInLoops: FK-ordered transaction.
		await tx.insert(assetFamilies).values(
			rows.map((row) => ({
				...row,
				createdAt: new Date(row.createdAt),
				projectId: restore.restoredProjectId,
				createdByUserId: restore.createdByUserId,
			}))
		);
	}
	for (const rows of chunks(records)) {
		// biome-ignore lint/performance/noAwaitInLoops: FK-ordered transaction.
		await tx.insert(assetRecords).values(
			rows.map(({ measurements: _measurements, ...row }) => ({
				...row,
				createdAt: new Date(row.createdAt),
				projectId: restore.restoredProjectId,
				createdByUserId: restore.createdByUserId,
			}))
		);
		await tx.insert(assetRecordMeasurements).values(
			rows.map((row) => ({
				assetRecordId: row.id,
				projectId: restore.restoredProjectId,
				measurements: row.measurements,
			}))
		);
	}
	const versions = foundation(
		"assetVersions"
	) as FoundationRecords["assetVersions"];
	const sourceKind = z.enum([
		"manual_import",
		"external_working_file_edit",
		"legacy_asset",
		"derived",
		"unknown",
	]);
	const productionSource = z.enum([
		"unknown",
		"user_reported_provider",
		"connected_provider",
	]);
	for (const rows of chunks(versions)) {
		const values = rows.map((version) => {
			const file = record.files.find(
				(item) =>
					item.kind === "asset_version_file" &&
					item.restoredId === version.id &&
					item.presence === "included"
			);
			if (!file?.objectKey) {
				throw new Error("Restored Asset Version file is missing.");
			}
			return {
				id: version.id,
				projectId: restore.restoredProjectId,
				assetRecordId: version.assetRecordId,
				assetFamilyId: version.assetFamilyId,
				versionNumber: version.versionNumber,
				fileName: file.fileName,
				contentType: version.contentType,
				sourceKind: sourceKind.parse(version.sourceKind),
				productionSource: productionSource.parse(version.productionSource),
				sourceImageWidth: version.sourceImageDimensions?.width ?? null,
				sourceImageHeight: version.sourceImageDimensions?.height ?? null,
				sha256: file.sha256,
				byteSize: version.byteSize,
				contentDigest: version.contentDigest,
				integrityVerified: version.integrityVerified,
				objectKey: file.objectKey,
				createdAt: new Date(version.createdAt),
				createdByUserId: restore.createdByUserId,
			};
		});
		// biome-ignore lint/performance/noAwaitInLoops: Versions depend on Asset Records in this transaction.
		await tx.insert(assetVersions).values(values);
	}
}

async function verifyNewRestore(
	tx: InteractiveTransaction,
	record: StoredProjectArchiveRestoreRecord,
	verifyCanonical?: (
		db: Database,
		record: StoredProjectArchiveRestoreRecord
	) => Promise<string[]>
) {
	if (!verifyCanonical) {
		return;
	}
	await tx
		.update(projectArchiveRestores)
		.set({ canonicalVerified: true })
		.where(eq(projectArchiveRestores.id, record.restore.id));
	const failures = await verifyCanonical(tx as unknown as Database, record);
	if (failures.length) {
		throw new Error(
			`Restored project failed canonical readback: ${failures.join(" ")}`
		);
	}
}

export function createDatabaseProjectArchiveRestoreStorage(
	db: Database,
	interactiveDb: InteractiveDatabase,
	verifyCanonical?: (
		db: Database,
		record: StoredProjectArchiveRestoreRecord
	) => Promise<string[]>
): ProjectArchiveRestoreStorage {
	return {
		async find(sourceProjectId, restoreId) {
			const [row] = await db
				.select()
				.from(projectArchiveRestores)
				.where(
					and(
						or(
							eq(projectArchiveRestores.operationProjectId, sourceProjectId),
							and(
								isNull(projectArchiveRestores.operationProjectId),
								eq(projectArchiveRestores.sourceProjectId, sourceProjectId)
							)
						),
						eq(projectArchiveRestores.id, restoreId)
					)
				);
			if (!row) {
				return null;
			}
			const [[restoredProject], ids, sections, files] = await Promise.all([
				db
					.select({ name: project.name })
					.from(project)
					.where(eq(project.id, row.restoredProjectId)),
				db
					.select()
					.from(projectArchiveRestoreIds)
					.where(eq(projectArchiveRestoreIds.restoreId, restoreId))
					.orderBy(
						asc(projectArchiveRestoreIds.recordGroup),
						asc(projectArchiveRestoreIds.name),
						asc(projectArchiveRestoreIds.sourceId)
					),
				db
					.select()
					.from(projectArchiveRestoreSections)
					.where(eq(projectArchiveRestoreSections.restoreId, restoreId))
					.orderBy(
						asc(projectArchiveRestoreSections.recordGroup),
						asc(projectArchiveRestoreSections.name)
					),
				db
					.select()
					.from(projectArchiveRestoreFiles)
					.where(eq(projectArchiveRestoreFiles.restoreId, restoreId))
					.orderBy(
						asc(projectArchiveRestoreFiles.kind),
						asc(projectArchiveRestoreFiles.sourceId)
					),
			]);
			return {
				files: files.map((file) => ({
					assetRecordId: file.assetRecordId,
					assetVersionId: file.assetVersionId,
					byteSize: file.byteSize,
					contentType: file.contentType,
					exclusionReason: file.exclusionReason as
						| "evidence_not_archived"
						| "not_selected"
						| null,
					fileName: file.fileName,
					kind: file.kind as never,
					objectKey: file.objectKey,
					presence: file.presence,
					restoredId: file.restoredId,
					sha256: file.sha256,
					sourceId: file.sourceId,
				})),
				ids: ids.map((entry) => ({
					group: entry.recordGroup,
					name: entry.name,
					restoredId: entry.restoredId,
					sourceId: entry.sourceId,
				})),
				projectName: restoredProject?.name ?? "",
				restore: toRestore(row),
				sections: sections.map((section) => ({
					digest: section.digest,
					group: section.recordGroup,
					name: section.name,
					recordCount: section.recordCount,
					records: section.records,
					sourceDigest: section.sourceDigest,
				})),
			};
		},

		canMaterialize(plan) {
			const supportedSections = new Set([
				"managedSnapshots",
				"importInboxEntries",
				"referenceBoardImages",
				"referenceBoardImageHistory",
				"visualWorlds",
				"themes",
				"subjectIdentities",
				"assetFamilies",
				"assetRecords",
				"assetVersions",
				"contextRevisions",
				"contextProposals",
				"canonicalDesigns",
				"unitVersions",
				"compositeVersions",
				"compositionMemberships",
				"references",
				"referenceHistory",
				"relationships",
			]);
			return (
				canMaterializeArchiveHistory(plan) &&
				canMaterializeArchiveDelivery(plan) &&
				!(
					plan.sections.some(
						(section) =>
							section.records.length > 0 &&
							!(
								(section.group === "foundation" &&
									supportedSections.has(section.name)) ||
								(section.group === "history" &&
									section.name in historySectionSchemas) ||
								(section.group === "delivery" &&
									section.name in deliverySectionSchemas)
							)
					) ||
					plan.files.some(
						(file) =>
							file.presence === "included" &&
							![
								"asset_version_file",
								"import_inbox_file",
								"reference_board_file",
								"working_file",
							].includes(file.kind)
					)
				)
			);
		},
		async insert(record) {
			if (!this.canMaterialize?.(record)) {
				throw new Error(
					"Project Archive restore cannot yet materialize every included record or file."
				);
			}
			const { restore } = record;
			const revisions = (record.sections.find(
				(section) =>
					section.group === "foundation" && section.name === "contextRevisions"
			)?.records ?? []) as FoundationRecords["contextRevisions"];
			try {
				await interactiveDb.transaction(async (tx) => {
					await assertAvailableProjectNameInTransaction(
						tx,
						restore.createdByUserId,
						record.projectName,
						restore.restoredProjectId
					);
					await tx.insert(project).values({
						id: restore.restoredProjectId,
						name: record.projectName,
						ownerUserId: restore.createdByUserId,
					});
					await insertFoundation(tx, record);
					await insertFoundationRelations(tx, record);
					await insertManagedFoundation(tx, record);
					await tx.insert(projectArchiveRestores).values({
						archiveId: restore.archiveId,
						createdAt: restore.createdAt,
						createdByUserId: restore.createdByUserId,
						id: restore.id,
						manifestDigest: restore.manifestDigest,
						requestDigest: restore.requestDigest,
						restoredProjectId: restore.restoredProjectId,
						sourceProjectId: restore.sourceProjectId,
						operationProjectId: restore.operationProjectId ?? null,
						canonicalVerified: false,
					});
					// The Project Context travels as live revisions, so the new project opens with its own context.
					for (const rows of chunks(revisions)) {
						// biome-ignore lint/performance/noAwaitInLoops: Statements of one transaction run one after another.
						await tx.insert(contextRevisions).values(
							rows.map((revision) => ({
								contractVersion: revision.contractVersion,
								createdAt: new Date(revision.createdAt),
								createdByUserId: restore.createdByUserId,
								id: revision.id,
								projectId: restore.restoredProjectId,
								revisionNumber: revision.revisionNumber,
								rules: revision.rules,
								sourceProposalId: revision.sourceProposalId,
								state: revision.state,
							}))
						);
					}
					const proposals = (record.sections.find(
						(section) =>
							section.group === "foundation" &&
							section.name === "contextProposals"
					)?.records ?? []) as FoundationRecords["contextProposals"];
					for (const rows of chunks(proposals)) {
						// biome-ignore lint/performance/noAwaitInLoops: Proposals depend on Context Revisions in this transaction.
						await tx.insert(contextProposals).values(
							rows.map((proposal) => ({
								...proposal,
								createdAt: new Date(proposal.createdAt),
								projectId: restore.restoredProjectId,
								createdByUserId: restore.createdByUserId,
							}))
						);
					}
					await insertArchiveHistory(tx, record);
					await insertArchiveDelivery(tx, record);
					for (const rows of chunks(record.ids)) {
						// biome-ignore lint/performance/noAwaitInLoops: Statements of one transaction run one after another.
						await tx.insert(projectArchiveRestoreIds).values(
							rows.map((entry) => ({
								name: entry.name,
								recordGroup: entry.group,
								restoredId: entry.restoredId,
								restoreId: restore.id,
								sourceId: entry.sourceId,
							}))
						);
					}
					if (record.sections.length > 0) {
						await tx.insert(projectArchiveRestoreSections).values(
							record.sections.map((section) => ({
								digest: section.digest,
								name: section.name,
								recordCount: section.recordCount,
								recordGroup: section.group,
								records: section.records,
								restoreId: restore.id,
								sourceDigest: section.sourceDigest,
							}))
						);
					}
					for (const rows of chunks(record.files)) {
						// biome-ignore lint/performance/noAwaitInLoops: Statements of one transaction run one after another.
						await tx.insert(projectArchiveRestoreFiles).values(
							rows.map((file) => ({
								assetRecordId: file.assetRecordId,
								assetVersionId: file.assetVersionId,
								byteSize: file.byteSize,
								contentType: file.contentType,
								exclusionReason: file.exclusionReason,
								fileName: file.fileName,
								kind: file.kind,
								objectKey: file.objectKey,
								presence: file.presence,
								restoredId: file.restoredId,
								restoreId: restore.id,
								sha256: file.sha256,
								sourceId: file.sourceId,
							}))
						);
					}
					await verifyNewRestore(tx, record, verifyCanonical);
				});
				return { status: "inserted" };
			} catch (error) {
				if (hasErrorCode(error, uniqueViolationCode)) {
					return { status: "conflict" };
				}
				throw error;
			}
		},

		...(verifyCanonical
			? {
					async verifyAndMark(
						sourceProjectId: string,
						restoreId: string,
						record: StoredProjectArchiveRestoreRecord
					) {
						await interactiveDb.transaction(async (tx) => {
							const [updated] = await tx
								.update(projectArchiveRestores)
								.set({ canonicalVerified: true })
								.where(
									and(
										eq(projectArchiveRestores.id, restoreId),
										eq(
											projectArchiveRestores.restoredProjectId,
											record.restore.restoredProjectId
										),
										or(
											eq(
												projectArchiveRestores.operationProjectId,
												sourceProjectId
											),
											and(
												isNull(projectArchiveRestores.operationProjectId),
												eq(
													projectArchiveRestores.sourceProjectId,
													sourceProjectId
												)
											)
										)
									)
								)
								.returning({ id: projectArchiveRestores.id });
							if (!updated) {
								throw new Error(
									"Project Archive restore could not be verified."
								);
							}
							const failures = await verifyCanonical(
								tx as unknown as Database,
								record
							);
							if (failures.length) {
								throw new Error(
									`Restored project failed canonical readback: ${failures.join(" ")}`
								);
							}
						});
					},
				}
			: {}),
		markVerified() {
			return Promise.reject(
				new Error(
					"Canonical verification must run in the publication transaction."
				)
			);
		},

		async list(sourceProjectId) {
			const rows = await db
				.select()
				.from(projectArchiveRestores)
				.where(
					and(
						eq(projectArchiveRestores.canonicalVerified, true),
						or(
							eq(projectArchiveRestores.operationProjectId, sourceProjectId),
							and(
								isNull(projectArchiveRestores.operationProjectId),
								eq(projectArchiveRestores.sourceProjectId, sourceProjectId)
							)
						)
					)
				)
				.orderBy(
					asc(projectArchiveRestores.createdAt),
					asc(projectArchiveRestores.id)
				);
			return rows.map(toRestore);
		},

		async withdraw(restoreId) {
			const [row] = await db
				.select({ restoredProjectId: projectArchiveRestores.restoredProjectId })
				.from(projectArchiveRestores)
				.where(eq(projectArchiveRestores.id, restoreId));
			if (row) {
				const restoredId = row.restoredProjectId;
				await db.batch([
					...archiveDeliveryDeleteQueries(db, restoredId),
					...archiveHistoryDeleteQueries(db, restoredId),
					db
						.delete(managedSnapshots)
						.where(eq(managedSnapshots.projectId, restoredId)),
					db
						.delete(referenceBoardImageHistory)
						.where(eq(referenceBoardImageHistory.projectId, restoredId)),
					db
						.delete(referenceBoardImages)
						.where(eq(referenceBoardImages.projectId, restoredId)),
					db
						.delete(importInboxEntries)
						.where(eq(importInboxEntries.projectId, restoredId)),
					db
						.delete(assetRecordReferenceHistory)
						.where(eq(assetRecordReferenceHistory.projectId, restoredId)),
					db
						.delete(assetRecordReferences)
						.where(eq(assetRecordReferences.projectId, restoredId)),
					db
						.delete(assetFamilyRelationships)
						.where(eq(assetFamilyRelationships.projectId, restoredId)),
					db
						.delete(assetFamilyCanonicalDesigns)
						.where(eq(assetFamilyCanonicalDesigns.projectId, restoredId)),
					db
						.delete(compositionMemberships)
						.where(eq(compositionMemberships.projectId, restoredId)),
					db
						.delete(compositeVersions)
						.where(eq(compositeVersions.projectId, restoredId)),
					db.delete(unitVersions).where(eq(unitVersions.projectId, restoredId)),
					db
						.delete(assetVersions)
						.where(eq(assetVersions.projectId, restoredId)),
					db
						.delete(assetRecordMeasurements)
						.where(eq(assetRecordMeasurements.projectId, restoredId)),
					db.delete(assetRecords).where(eq(assetRecords.projectId, restoredId)),
					db
						.delete(assetFamilies)
						.where(eq(assetFamilies.projectId, restoredId)),
					db
						.delete(subjectIdentities)
						.where(eq(subjectIdentities.projectId, restoredId)),
					db.delete(project).where(eq(project.id, restoredId)),
				]);
			}
		},
	};
}

export function createDatabaseProjectArchiveRestoreRequestStorage(
	db: Database
): ProjectArchiveRestoreRequestStorage {
	return {
		async find(projectId, requestId) {
			const [row] = await db
				.select()
				.from(projectArchiveRestoreRequests)
				.where(
					and(
						eq(projectArchiveRestoreRequests.projectId, projectId),
						eq(projectArchiveRestoreRequests.id, requestId)
					)
				);
			return row ? toRequest(row) : null;
		},
		async insert(request) {
			const [created] = await db
				.insert(projectArchiveRestoreRequests)
				.values(request)
				.onConflictDoNothing()
				.returning({ id: projectArchiveRestoreRequests.id });
			if (created) {
				return { status: "inserted" };
			}
			const [existing] = await db
				.select()
				.from(projectArchiveRestoreRequests)
				.where(eq(projectArchiveRestoreRequests.id, request.id));
			if (!existing) {
				throw new Error("The restore request could not be re-read.");
			}
			return { existing: toRequest(existing), status: "existing" };
		},
	};
}
