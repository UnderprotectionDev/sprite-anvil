import { expect, test } from "bun:test";
import { managedSnapshots } from "@sprite-anvil/db/schema/asset-production-history";
import { assetRecordReferences } from "@sprite-anvil/db/schema/asset-record-references";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { themes, visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { referenceBoardImages } from "@sprite-anvil/db/schema/reference-production";
import { createDatabaseProjectArchiveRestoreStorage } from "../database-project-archive-restore-storage";
import { ids, projectId } from "./project-archive-fixtures";
import { restoreSetup } from "./project-archive-restore-fixtures";

test("the restore transaction materializes Visual Worlds and Themes using restored ids", async () => {
	const fixture = restoreSetup();
	const { archive } = await fixture.createArchive();
	const themeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	await fixture.forgeArchive(archive, (sections) => {
		const section = sections.find((entry) => entry.name === "themes");
		if (!section) {
			throw new Error("Missing themes section");
		}
		section.records.push({
			id: themeId,
			visualWorldId: ids.world,
			name: "Theme",
			description: "Description",
			createdAt: "2026-11-01T10:00:00.000Z",
		});
	});
	const { restore } = await fixture.restore({
		archiveId: archive.id,
		idempotencyKey: "world-test",
		name: "Restored",
		projectId,
	});
	const record = fixture.memory.restores.get(restore.id);
	if (!record) {
		throw new Error("Missing restored record");
	}
	const inbox = record.sections.find(
		(section) => section.name === "importInboxEntries"
	);
	const board = record.sections.find(
		(section) => section.name === "referenceBoardImages"
	);
	if (!(inbox && board)) {
		throw new Error("Missing sections");
	}
	const recordId = restore.ids.find(
		(row) => row.sourceId === ids.record
	)?.restoredId;
	if (!recordId) {
		throw new Error("Missing Asset Record");
	}
	const inboxId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const boardId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
	const createdAt = "2026-11-01T10:00:00.000Z";
	inbox.records.push({
		id: inboxId,
		createdAt,
		fileName: "source.json",
		sourceContentType: "application/json",
		contentLength: 1,
		sha256: "a".repeat(64),
	});
	board.records.push({
		id: boardId,
		assetRecordId: recordId,
		createdAt,
		updatedAt: createdAt,
		fileName: "ref.png",
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
		objectKey: "inbox-key",
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
		fileName: "ref.png",
		contentType: "image/png",
		objectKey: "reference-key",
		presence: "included",
		exclusionReason: null,
	});
	const snapshot = record.files.find(
		(file) => file.kind === "working_file" && file.sourceId === ids.workingA
	);
	if (!snapshot) {
		throw new Error("Missing snapshot file");
	}
	snapshot.presence = "included";
	snapshot.exclusionReason = null;
	snapshot.objectKey = "snapshot-key";
	const fullRecord = structuredClone(record);
	fullRecord.sections.push({
		group: "future",
		name: "unknown",
		records: [{ id: "unknown" }],
		recordCount: 1,
		digest: "a".repeat(64),
		sourceDigest: "b".repeat(64),
	});
	const supported = new Set([
		"importInboxEntries",
		"referenceBoardImages",
		"referenceBoardImageHistory",
		"managedSnapshots",
		"visualWorlds",
		"themes",
		"subjectIdentities",
		"assetFamilies",
		"assetRecords",
		"assetVersions",
		"contextRevisions",
		"contextProposals",
		"unitVersions",
		"references",
	]);
	record.sections = record.sections.map((section) =>
		supported.has(section.name) && section.group === "foundation"
			? section
			: { ...section, records: [], recordCount: 0 }
	);
	const writes = new Map<unknown, unknown[]>();
	const db = {
		transaction: async (run: (tx: unknown) => Promise<void>) =>
			run({
				insert: (table: unknown) => ({
					values: (rows: unknown | unknown[]) => {
						writes.set(table, [
							...(writes.get(table) ?? []),
							...(Array.isArray(rows) ? rows : [rows]),
						]);
						return Promise.resolve();
					},
				}),
			}),
	};
	const storage = createDatabaseProjectArchiveRestoreStorage(
		db as never,
		db as never
	);
	await expect(storage.insert(fullRecord)).rejects.toThrow(
		"cannot yet materialize"
	);
	expect(writes.size).toBe(0);
	await storage.insert(record);
	const worldId = restore.ids.find(
		(row) => row.sourceId === ids.world
	)?.restoredId;
	expect(writes.get(visualWorlds)).toEqual([
		expect.objectContaining({
			id: worldId,
			name: "World",
			projectId: restore.restoredProjectId,
		}),
	]);
	expect(writes.get(subjectIdentities)).toEqual([
		expect.objectContaining({
			id: restore.ids.find((row) => row.sourceId === ids.subject)?.restoredId,
			projectId: restore.restoredProjectId,
		}),
	]);
	expect(writes.get(assetFamilies)).toEqual([
		expect.objectContaining({
			id: restore.ids.find((row) => row.sourceId === ids.family)?.restoredId,
			visualWorldId: worldId,
		}),
	]);
	expect(writes.get(assetRecords)).toEqual([
		expect.objectContaining({
			id: restore.ids.find((row) => row.sourceId === ids.record)?.restoredId,
			projectId: restore.restoredProjectId,
		}),
	]);
	expect(writes.get(unitVersions)).toContainEqual(
		expect.objectContaining({
			id: restore.ids.find((row) => row.sourceId === ids.unit)?.restoredId,
			projectId: restore.restoredProjectId,
		})
	);
	expect(writes.get(assetRecordReferences)).toContainEqual(
		expect.objectContaining({
			id: restore.ids.find((row) => row.sourceId === ids.reference)?.restoredId,
			projectId: restore.restoredProjectId,
		})
	);
	expect(writes.get(managedSnapshots)).toContainEqual(
		expect.objectContaining({
			id: snapshot.restoredId,
			objectKey: "snapshot-key",
		})
	);
	expect(writes.get(importInboxEntries)).toContainEqual(
		expect.objectContaining({ id: inboxId, objectKey: "inbox-key" })
	);
	expect(writes.get(referenceBoardImages)).toContainEqual(
		expect.objectContaining({
			id: boardId,
			objectKey: "reference-key",
			assetRecordId: recordId,
		})
	);
	expect(writes.get(assetVersions)).toHaveLength(2);
	expect(writes.get(assetVersions)).toContainEqual(
		expect.objectContaining({
			id: restore.ids.find((row) => row.sourceId === ids.version1)?.restoredId,
			projectId: restore.restoredProjectId,
		})
	);
	expect(writes.get(themes)).toEqual([
		expect.objectContaining({
			id: restore.ids.find((row) => row.sourceId === themeId)?.restoredId,
			visualWorldId: worldId,
			name: "Theme",
			projectId: restore.restoredProjectId,
		}),
	]);
});
