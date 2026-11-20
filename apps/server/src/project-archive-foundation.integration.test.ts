import { expect, test } from "bun:test";
import { foundationSectionSchemas } from "@sprite-anvil/api/project-archives";
import { createDb } from "@sprite-anvil/db";
import { createInteractiveDatabase } from "@sprite-anvil/db/interactive-database";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import {
	createProjectImportInboxObjectKey,
	createProjectManagedSnapshotObjectKey,
	createProjectReferenceBoardObjectKey,
} from "./cloudflare";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createImportInboxStore } from "./features/imports/server/import-inbox-store";
import { createManagedSnapshotStore } from "./features/production-provenance/server/managed-snapshot-store";
import { createDatabaseProjectArchiveRestoreStorage } from "./features/project-archives/server/database-project-archive-restore-storage";
import { createDatabaseProjectArchiveStorage } from "./features/project-archives/server/database-project-archive-storage";
import { createProjectArchiveCanonicalVerifier } from "./features/project-archives/server/project-archive-canonical-verification";
import { createProjectArchiveSourceReader } from "./features/project-archives/server/project-archive-source-reader";
import { createProjectArchiveStore } from "./features/project-archives/server/project-archive-store";
import {
	ids,
	projectId,
} from "./features/project-archives/server/tests/project-archive-fixtures";
import { restoreSetup } from "./features/project-archives/server/tests/project-archive-restore-fixtures";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createReferenceProductionStore } from "./features/reference-production/server/reference-production-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const proxyDatabaseUrl = process.env.ARCHIVE_BATCH_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"restored foundation is readable through the normal asset stores",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required");
		}
		const db =
			proxyDatabaseUrl || new URL(databaseUrl).hostname !== "127.0.0.1"
				? createDb({ DATABASE_URL: proxyDatabaseUrl ?? databaseUrl })
				: createLocalTestDb({ DATABASE_URL: databaseUrl });
		const interactiveDb = createInteractiveDatabase({
			DATABASE_URL: databaseUrl,
		});
		const userId = crypto.randomUUID();
		const fixture = restoreSetup();
		const { archive } = await fixture.createArchive();
		const { restore } = await fixture.restore({
			archiveId: archive.id,
			projectId,
			idempotencyKey: crypto.randomUUID(),
			name: "Restored foundation",
		});
		const stored = fixture.memory.restores.get(restore.id);
		if (!stored) {
			throw new Error("Missing restore fixture");
		}
		const record = structuredClone(stored);
		record.sections = record.sections.filter(
			(section) => section.group === "foundation"
		);
		record.restore.createdByUserId = userId;
		const contextSection = record.sections.find(
			(section) => section.name === "contextRevisions"
		);
		const proposalSection = record.sections.find(
			(section) => section.name === "contextProposals"
		);
		if (!(contextSection && proposalSection)) {
			throw new Error("Missing context sections");
		}
		const baseRevision = contextSection.records[0] as
			| { id: string }
			| undefined;
		if (!baseRevision) {
			throw new Error("Missing base Context Revision");
		}
		const proposalId = crypto.randomUUID();
		const revisionId = crypto.randomUUID();
		const contextDate = "2026-11-02T10:00:00.000Z";
		contextSection.records.push({
			id: revisionId,
			contractVersion: "context-rule/1.0.0",
			createdAt: contextDate,
			revisionNumber: 2,
			rules: [],
			sourceProposalId: proposalId,
			state: "inactive",
		});
		proposalSection.records.push({
			id: proposalId,
			baseContextRevisionId: baseRevision.id,
			contractVersion: "context-agent/1.0.0",
			sourceKind: "structured_control",
			proposal: {
				id: proposalId,
				projectId: restore.restoredProjectId,
				baseContextRevisionId: baseRevision.id,
				contractVersion: "context-agent/1.0.0",
				ruleContractVersion: "context-rule/1.0.0",
				summary: "Keep palettes compact",
				source: {
					kind: "structured_control",
					controlId: "context-proposal-form",
					controlVersion: "1.0.0",
				},
				changes: [
					{
						operation: "add",
						ruleId: "palette",
						scope: { kind: "project", id: restore.restoredProjectId },
						value: { type: "text_list", value: ["Use a compact palette"] },
						rationale: "Preserve visual consistency",
						evidence: [
							{ kind: "user_decision", statement: "Keep palettes compact" },
						],
					},
				],
				validation: { isValid: true, checkedAt: contextDate, conflicts: [] },
				activationAllowed: false,
				createdAt: contextDate,
			},
			createdAt: contextDate,
		});
		const recordId = restore.ids.find(
			(entry) => entry.sourceId === ids.record
		)?.restoredId;
		const versionId = restore.ids.find(
			(entry) => entry.sourceId === ids.version1
		)?.restoredId;
		const version2Id = restore.ids.find(
			(entry) => entry.sourceId === ids.version2
		)?.restoredId;
		const snapshotId = restore.ids.find(
			(entry) => entry.sourceId === ids.workingA
		)?.restoredId;
		if (!(recordId && versionId && version2Id && snapshotId)) {
			throw new Error("Missing restored IDs");
		}
		const snapshot = record.files.find(
			(file) => file.restoredId === snapshotId && file.kind === "working_file"
		);
		if (!snapshot) {
			throw new Error("Missing snapshot");
		}
		snapshot.presence = "included";
		snapshot.exclusionReason = null;
		snapshot.objectKey = createProjectManagedSnapshotObjectKey(
			restore.restoredProjectId,
			recordId,
			version2Id,
			snapshotId
		);
		const inboxId = crypto.randomUUID();
		const boardId = crypto.randomUUID();
		const now = new Date().toISOString();
		const inbox = record.sections.find(
			(section) => section.name === "importInboxEntries"
		);
		const board = record.sections.find(
			(section) => section.name === "referenceBoardImages"
		);
		if (!(inbox && board)) {
			throw new Error("Missing sections");
		}
		inbox.records.push({
			id: inboxId,
			createdAt: now,
			fileName: "source.json",
			sourceContentType: "application/json",
			contentLength: 1,
			sha256: "a".repeat(64),
		});
		board.records.push({
			id: boardId,
			assetRecordId: recordId,
			createdAt: now,
			updatedAt: now,
			fileName: "reference.png",
			contentType: "image/png",
			contentLength: 1,
			sha256: "b".repeat(64),
			role: "style",
			customPurpose: null,
			transferredFeatures: ["style"],
			forbiddenFeatures: [],
			contextOverrideRationale: null,
			notes: null,
			sortOrder: 0,
			revision: 1,
		});
		record.files.push({
			kind: "import_inbox_file",
			sourceId: inboxId,
			restoredId: inboxId,
			assetRecordId: null,
			assetVersionId: null,
			byteSize: 1,
			sha256: "a".repeat(64),
			fileName: "source.json",
			contentType: "application/json",
			objectKey: createProjectImportInboxObjectKey(
				restore.restoredProjectId,
				inboxId,
				restore.id
			),
			presence: "included",
			exclusionReason: null,
		});
		record.files.push({
			kind: "reference_board_file",
			sourceId: boardId,
			restoredId: boardId,
			assetRecordId: recordId,
			assetVersionId: null,
			byteSize: 1,
			sha256: "b".repeat(64),
			fileName: "reference.png",
			contentType: "image/png",
			objectKey: createProjectReferenceBoardObjectKey(
				restore.restoredProjectId,
				recordId,
				boardId,
				restore.id
			),
			presence: "included",
			exclusionReason: null,
		});
		record.files = record.files.filter((file) =>
			[
				"asset_version_file",
				"working_file",
				"import_inbox_file",
				"reference_board_file",
			].includes(file.kind)
		);
		const storage = createDatabaseProjectArchiveRestoreStorage(
			db,
			interactiveDb,
			(transaction, current) =>
				createProjectArchiveCanonicalVerifier(
					createProjectArchiveSourceReader({
						db: transaction,
						assetFamilies: createAssetFamilyStore(transaction),
						assetRecords: createAssetRecordStore(transaction),
						assetVersions: createAssetVersionStore(transaction),
					})
				)(current)
		);
		await db.insert(user).values({
			id: userId,
			name: "Archive restore integration",
			email: `${userId}@example.test`,
		});
		try {
			const failingStorage = createDatabaseProjectArchiveRestoreStorage(
				db,
				interactiveDb,
				() => Promise.resolve(["missing record"])
			);
			await expect(failingStorage.insert(record)).rejects.toThrow(
				"missing record"
			);
			expect(
				await db
					.select({ id: project.id })
					.from(project)
					.where(eq(project.id, restore.restoredProjectId))
			).toEqual([]);
			expect(await storage.insert(record)).toEqual({ status: "inserted" });
			const canonicalReader = createProjectArchiveSourceReader({
				db,
				assetFamilies: createAssetFamilyStore(db),
				assetRecords: createAssetRecordStore(db),
				assetVersions: createAssetVersionStore(db),
			});
			const canonicalSource = await canonicalReader.read(
				userId,
				restore.restoredProjectId
			);
			expect(canonicalSource?.records.assetRecords).toEqual(
				foundationSectionSchemas.assetRecords
					.array()
					.parse(
						record.sections.find((section) => section.name === "assetRecords")
							?.records
					)
			);
			expect(
				await createProjectArchiveCanonicalVerifier(canonicalReader)(record)
			).toEqual([]);
			const restoredRecord = await createAssetRecordStore(db).get(
				userId,
				restore.restoredProjectId,
				recordId
			);
			expect(restoredRecord).toMatchObject({ id: recordId, name: "Hero idle" });
			const versions = await createAssetVersionStore(db).list(
				userId,
				restore.restoredProjectId
			);
			expect(versions?.assetVersions).toContainEqual(
				expect.objectContaining({ id: versionId, assetRecordId: recordId })
			);
			expect(
				await createProjectContextStore(db).getProposal(
					userId,
					restore.restoredProjectId,
					proposalId
				)
			).toMatchObject({
				id: proposalId,
				baseContextRevisionId: baseRevision.id,
			});
			expect(
				await createImportInboxStore(db).listEntries(
					userId,
					restore.restoredProjectId
				)
			).toContainEqual(
				expect.objectContaining({ id: inboxId, fileName: "source.json" })
			);
			expect(
				await createReferenceProductionStore(db).listImages(
					userId,
					restore.restoredProjectId,
					recordId
				)
			).toContainEqual(
				expect.objectContaining({ id: boardId, fileName: "reference.png" })
			);
			expect(
				await createManagedSnapshotStore(db).list(
					userId,
					restore.restoredProjectId,
					version2Id
				)
			).toContainEqual(
				expect.objectContaining({ id: snapshotId, fileName: "hero.aseprite" })
			);
			const sourceReader = createProjectArchiveSourceReader({
				db,
				assetFamilies: { list: () => Promise.resolve(null) },
				assetRecords: { list: () => Promise.resolve(null) },
				assetVersions: { list: () => Promise.resolve(null) },
			});
			const archiveStore = createProjectArchiveStore(db, {
				sourceReader,
				storage: createDatabaseProjectArchiveStorage(db),
				fileAvailable: () => Promise.resolve(true),
			});
			const workingFiles = await archiveStore.listWorkingFiles(
				userId,
				restore.restoredProjectId
			);
			expect(workingFiles?.files).toContainEqual(
				expect.objectContaining({
					id: snapshotId,
					fileName: "hero.aseprite",
					available: true,
				})
			);
			expect(
				await archiveStore.listWorkingFiles(
					"another-user",
					restore.restoredProjectId
				)
			).toBeNull();
			expect(versions?.unitVersions).toContainEqual(
				expect.objectContaining({ assetRecordId: recordId })
			);
		} finally {
			try {
				await storage.withdraw(restore.id);
				await db.delete(user).where(eq(user.id, userId));
			} finally {
				await interactiveDb.$client.close();
			}
		}
	}
);
