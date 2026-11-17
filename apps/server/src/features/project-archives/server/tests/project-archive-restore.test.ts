import { expect, test } from "bun:test";
import {
	sha256Hex,
	verifyExportBundle,
} from "@sprite-anvil/api/export-bundle-verification";
import { verifyRestoredRecords } from "@sprite-anvil/api/project-archive-restore";
import { z } from "zod";
import {
	assetVersionObjectKeySchema,
	importInboxObjectKeySchema,
	referenceBoardObjectKeySchema,
} from "../../../../cloudflare";
import {
	deliveryIds,
	deliverySource,
} from "./project-archive-delivery-fixtures";
import { digest, ids, projectId } from "./project-archive-fixtures";
import { historyIds, historySource } from "./project-archive-history-fixtures";
import { restoreSetup } from "./project-archive-restore-fixtures";

const input = (archiveId: string, extra: Record<string, unknown> = {}) => ({
	archiveId,
	idempotencyKey: "restore-key",
	name: "Hero, restored",
	projectId,
	...extra,
});

const allSourceIds = Object.values({ ...ids, ...deliveryIds });

test("a restore builds an independent project whose records hold new cloud ids and keep their relations", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();

	const result = await setup.restore(input(archive.id));

	expect(result.status).toBe("created");
	const { restore } = result;
	expect(restore.restoredProjectId).not.toBe(projectId);
	expect(restore.archiveId).toBe(archive.id);
	expect(setup.memory.projects.get(restore.restoredProjectId)).toMatchObject({
		name: "Hero, restored",
	});

	const stored = setup.memory.restores.get(restore.id);
	const serialized = JSON.stringify(stored?.sections);
	// No archived id survives in the restored records; each one maps to a new id.
	for (const sourceId of allSourceIds) {
		expect(serialized).not.toContain(sourceId);
	}
	// Ids of records the archive does not carry are re-issued too, so nothing points back at the source project.
	for (const foreign of [
		"required-set-1",
		"fulfilment-draft-not-archived",
		"inbox-entry-1",
	]) {
		expect(serialized).not.toContain(foreign);
	}
	const mapped = new Map(restore.ids.map((entry) => [entry.sourceId, entry]));
	for (const sourceId of [ids.family, ids.record, ids.version2, ids.workingA]) {
		expect(mapped.get(sourceId)?.restoredId).toBeTruthy();
		expect(mapped.get(sourceId)?.restoredId).not.toBe(sourceId);
	}
	expect(
		await verifyRestoredRecords({
			files: stored?.files ?? [],
			sections: stored?.sections ?? [],
		})
	).toEqual([]);
});

test("the restored delivery group rebases verifiable bundle copies and re-derives its diffs under the new ids", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	const { restore } = await setup.restore(input(archive.id));
	const stored = setup.memory.restores.get(restore.id);
	const section = (name: string) =>
		stored?.sections.find((s) => s.group === "delivery" && s.name === name)
			?.records as Record<string, unknown>[];

	const archived = archive.sections.find(
		(s) => s.group === "delivery" && s.name === "exportBundles"
	)?.records as { manifestDigest: string }[];
	const restoredBundles = section("exportBundles") as {
		manifestDigest: string;
		contextRevisionId: string;
		files: {
			path: string;
			content: string | null;
			sha256: string;
			byteSize: number;
		}[];
	}[];
	expect(restoredBundles.map((bundle) => bundle.manifestDigest)).not.toEqual(
		archived.map((bundle) => bundle.manifestDigest)
	);
	await Promise.all(
		restoredBundles.map(async (bundle) => {
			const manifest = bundle.files.find(
				(file) => file.path === "manifest.json"
			);
			if (!manifest?.content) {
				throw new Error("Missing restored manifest");
			}
			expect(await sha256Hex(new TextEncoder().encode(manifest.content))).toBe(
				bundle.manifestDigest
			);
			expect(JSON.parse(manifest.content).context.revisionId).toBe(
				bundle.contextRevisionId
			);
			expect(
				await verifyExportBundle(
					bundle.files.map((file) => ({
						path: file.path,
						bytes: new TextEncoder().encode(file.content ?? ""),
						...(file.content === null
							? { recorded: { byteSize: file.byteSize, sha256: file.sha256 } }
							: {}),
					}))
				)
			).toMatchObject({ ok: true });
		})
	);
	const [diff] = section("deliveryDiffs") as {
		fromFulfilmentId: string;
		id: string;
		toFulfilmentId: string;
	}[];
	const fulfilmentIds = section("deliveryFulfilments").map((f) => f.id);
	expect(fulfilmentIds).not.toContain(deliveryIds.fulfilment1);
	expect(diff?.id).toBe(`${diff?.fromFulfilmentId}..${diff?.toFulfilmentId}`);
	expect(fulfilmentIds).toContain(diff?.fromFulfilmentId);
	expect(fulfilmentIds).toContain(diff?.toFulfilmentId);
});

test("included files are verified and copied to new object keys; excluded files stay excluded", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	const { restore } = await setup.restore(input(archive.id));

	const included = restore.files.filter((file) => file.presence === "included");
	expect(included.length).toBeGreaterThan(0);
	expect(setup.copies).toHaveLength(included.length);
	for (const copy of setup.copies) {
		expect(copy.to).not.toBe(copy.from);
		expect(copy.to).toContain(restore.restoredProjectId);
		expect(
			[
				assetVersionObjectKeySchema,
				importInboxObjectKeySchema,
				referenceBoardObjectKeySchema,
			].some((schema) => schema.safeParse(copy.to).success)
		).toBe(true);
	}
	const excluded = restore.files.filter((file) => file.presence === "excluded");
	expect(excluded.map((file) => file.kind)).toContain("working_file");
	const stored = setup.memory.restores.get(restore.id);
	const excludedKeys = (stored?.files ?? [])
		.filter((file) => file.presence === "excluded")
		.map((file) => file.objectKey);
	expect(excludedKeys.length).toBeGreaterThan(0);
	expect(excludedKeys.every((key) => key === null)).toBe(true);
});

test("the source archive is left unchanged and no existing project is touched", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	const before = await setup.archiveStore.get("user-1", projectId, archive.id);

	await setup.restore(input(archive.id));

	expect(await setup.archiveStore.get("user-1", projectId, archive.id)).toEqual(
		before
	);
	expect([...setup.memory.projects.keys()]).not.toContain(projectId);
	expect(setup.memory.projects.size).toBe(1);
});

test("the same key replays the first restore and never makes a second project", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();

	const first = await setup.restore(input(archive.id));
	const second = await setup.restore(input(archive.id));

	expect(second.status).toBe("replayed");
	expect(second.restore).toEqual(first.restore);
	expect(setup.memory.projects.size).toBe(1);
	expect((await setup.listRestores()).restores).toHaveLength(1);
	expect(await setup.getRestore(first.restore.id)).toEqual(first.restore);
});

test("another key makes another independent project with other ids", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();

	const first = await setup.restore(input(archive.id));
	const second = await setup.restore(
		input(archive.id, { idempotencyKey: "restore-key-2" })
	);

	expect(setup.memory.projects.size).toBe(2);
	expect(second.restore.restoredProjectId).not.toBe(
		first.restore.restoredProjectId
	);
	expect(second.restore.ids[0]?.restoredId).not.toBe(
		first.restore.ids[0]?.restoredId
	);
});

test("the same key with another name is a conflict and creates nothing", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	await setup.restore(input(archive.id));

	await expect(
		setup.restore(input(archive.id, { name: "Another name" }))
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(setup.memory.projects.size).toBe(1);
});

test("an archive whose record no longer matches its digest is refused and leaves no project", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	await setup.corruptArchive(archive, (sections) => {
		const names = sections.find((s) => s.name === "assetFamilies");
		(names?.records[0] as { name: string }).name = "Tampered";
	});

	await expect(setup.restore(input(archive.id))).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "archive_invalid" },
	});
	expect(setup.memory.projects.size).toBe(0);
	expect(setup.copies).toEqual([]);
});

test("an archive with a broken relation is refused with the failing relation and leaves no project", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	await setup.forgeArchive(archive, (sections) => {
		const versions = sections.find((s) => s.name === "assetVersions");
		(versions?.records[0] as { assetRecordId: string }).assetRecordId =
			"99999999-9999-4999-8999-999999999999";
	});

	const error = await setup.restore(input(archive.id)).catch((e) => e);

	expect(error).toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "archive_invalid" },
	});
	expect(JSON.stringify(error.data.failures)).toContain("Asset Version");
	expect(setup.memory.projects.size).toBe(0);
	expect(setup.copies).toEqual([]);
});

test("a repeated record key inside one section is refused", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	await setup.forgeArchive(archive, (sections) => {
		const families = sections.find((s) => s.name === "subjectIdentities");
		families?.records.push(structuredClone(families.records[0]));
	});

	await expect(setup.restore(input(archive.id))).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "duplicate_key" },
	});
	expect(setup.memory.projects.size).toBe(0);
});

test("an archive that carries a secret is never restored", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	await setup.forgeArchive(archive, (sections) => {
		const revisions = sections.find((s) => s.name === "contextRevisions");
		const [revision] = (revisions?.records ?? []) as { rules: unknown[] }[];
		revision?.rules.push({
			apiKey: "sk-live-123456",
		});
	});

	await expect(setup.restore(input(archive.id))).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "secret_detected" },
	});
	expect(setup.memory.projects.size).toBe(0);
});

test("a file that no longer matches its digest stops the restore before anything is copied", async () => {
	const setup = restoreSetup({
		verifyFile: (file) =>
			Promise.resolve(file.objectKey !== "projects/p/versions/v2"),
	});
	const { archive } = await setup.createArchive();

	await expect(setup.restore(input(archive.id))).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "file_unverifiable", sourceIds: [ids.version2] },
	});
	expect(setup.copies).toEqual([]);
	expect(setup.memory.projects.size).toBe(0);
});

test("a file copy that fails leaves no project behind and the same key restores later", async () => {
	let failing = true;
	const setup = restoreSetup({
		copyFile: () =>
			failing ? Promise.reject(new Error("storage down")) : Promise.resolve(),
	});
	const { archive } = await setup.createArchive();

	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(setup.memory.projects.size).toBe(0);

	failing = false;
	const retried = await setup.restore(input(archive.id));
	expect(retried.status).toBe("created");
	expect(setup.memory.projects.size).toBe(1);
});

test("a write that fails halfway leaves no partial project", async () => {
	const setup = restoreSetup({
		wrapRestoreStorage: (storage) => ({
			...storage,
			insert: () => Promise.reject(new Error("connection lost")),
		}),
	});
	const { archive } = await setup.createArchive();

	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(setup.memory.projects.size).toBe(0);
	expect((await setup.listRestores()).restores).toEqual([]);
});

test("an uncertain write retains its copies until ownership can be determined", async () => {
	const reserved = new Set<string>();
	const setup = restoreSetup({
		reservations: {
			markSettled: () => Promise.resolve(),
			reserve: ({ objectKey }) => {
				reserved.add(objectKey);
				return Promise.resolve();
			},
			release: (key) => {
				reserved.delete(key);
				return Promise.resolve();
			},
		},
		copyFile: ({ to }) => {
			expect(reserved.has(to)).toBe(true);
			return Promise.resolve();
		},
		wrapRestoreStorage: (storage) => ({
			...storage,
			insert: () => Promise.reject(new Error("connection lost")),
		}),
	});
	const { archive } = await setup.createArchive();

	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(setup.copies.length).toBeGreaterThan(0);
	expect(setup.removed).toEqual([]);
	expect(reserved.size).toBe(setup.copies.length);
});

test("replay releases reservations after an uncertain commit is found published", async () => {
	const held = new Set<string>();
	const setup = restoreSetup({
		reservations: {
			markSettled: () => Promise.resolve(),
			reserve: ({ objectKey }) => {
				held.add(objectKey);
				return Promise.resolve();
			},
			release: (key) => {
				held.delete(key);
				return Promise.resolve();
			},
		},
		wrapRestoreStorage: (storage) => ({
			...storage,
			insert: async (record) => {
				await storage.insert(record);
				throw new Error("lost acknowledgement");
			},
		}),
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(held.size).toBeGreaterThan(0);
	expect((await setup.restore(input(archive.id))).status).toBe("replayed");
	expect(held.size).toBe(0);
});

test("a copy that fails halfway removes the files already copied", async () => {
	let calls = 0;
	const setup = restoreSetup({
		copyFile: () => {
			calls += 1;
			return calls === 2
				? Promise.reject(new Error("storage down"))
				: Promise.resolve();
		},
	});
	const { archive } = await setup.createArchive();

	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(setup.removed).toEqual(setup.copies.map((copy) => copy.to));
	expect(setup.removed.length).toBe(1);
});

test("reservation failure prevents copying and a failed delete retains its reservation", async () => {
	const held = new Set<string>();
	let count = 0;
	const setup = restoreSetup({
		reservations: {
			markSettled: () => Promise.resolve(),
			reserve: ({ objectKey }) => {
				count += 1;
				if (count === 2) {
					return Promise.reject(new Error("erasure active"));
				}
				held.add(objectKey);
				return Promise.resolve();
			},
			release: (key) => {
				held.delete(key);
				return Promise.resolve();
			},
		},
		removeFile: () => Promise.reject(new Error("delete failed")),
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(setup.copies).toHaveLength(1);
	expect(held.has(setup.copies[0]?.to ?? "")).toBe(true);
});

test("marks only acknowledged copies settled and preserves uncertain writes", async () => {
	const reserved = new Set<string>();
	const settled = new Set<string>();
	let writes = 0;
	const setup = restoreSetup({
		reservations: {
			reserve: ({ objectKey }) => {
				reserved.add(objectKey);
				return Promise.resolve();
			},
			markSettled: (key) => {
				settled.add(key);
				return Promise.resolve();
			},
			release: (key) => {
				reserved.delete(key);
				return Promise.resolve();
			},
		},
		copyFile: () => {
			writes += 1;
			return writes === 2
				? Promise.reject(new Error("unknown PUT"))
				: Promise.resolve();
		},
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(settled.size).toBe(1);
	expect(reserved.size).toBe(1);
	expect([...reserved].every((key) => !settled.has(key))).toBe(true);
});

test("fails and can replay when published reservation release fails", async () => {
	let fail = true;
	const setup = restoreSetup({
		reservations: {
			reserve: () => Promise.resolve(),
			markSettled: () => Promise.resolve(),
			release: () =>
				fail
					? Promise.reject(new Error("release unavailable"))
					: Promise.resolve(),
		},
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	fail = false;
	expect((await setup.restore(input(archive.id))).status).toBe("replayed");
});

test("a lost race keeps the files the winning restore owns", async () => {
	const setup = restoreSetup({
		wrapRestoreStorage: (storage) => ({
			...storage,
			// The same key's other request wins just before this insert.
			insert: async (record) => {
				await storage.insert(record);
				return storage.insert(record);
			},
		}),
	});
	const { archive } = await setup.createArchive();

	const result = await setup.restore(input(archive.id));

	expect(result.status).toBe("replayed");
	expect(setup.copies.length).toBeGreaterThan(0);
	expect(setup.removed).toEqual([]);
});

test("overlapping attempts never delete the other attempt's verified files", async () => {
	const objects = new Set<string>();
	const targets = new Set<string>();
	let insertCount = 0;
	const attemptKeys: string[][] = [];
	let firstReady!: () => void;
	let secondReady!: () => void;
	let releaseSecond!: () => void;
	const firstAtInsert = new Promise<void>((resolve) => {
		firstReady = resolve;
	});
	const secondAtInsert = new Promise<void>((resolve) => {
		secondReady = resolve;
	});
	const secondMayInsert = new Promise<void>((resolve) => {
		releaseSecond = resolve;
	});
	const setup = restoreSetup({
		copyFile: ({ to }) => {
			targets.add(to);
			objects.add(to);
			return Promise.resolve();
		},
		removeFile: (key) => {
			objects.delete(key);
			return Promise.resolve();
		},
		verifyFile: ({ objectKey }) =>
			Promise.resolve(!targets.has(objectKey) || objects.has(objectKey)),
		wrapRestoreStorage: (storage) => ({
			...storage,
			insert: async (record) => {
				attemptKeys.push(
					record.files.flatMap((file) =>
						file.objectKey ? [file.objectKey] : []
					)
				);
				insertCount += 1;
				if (insertCount === 1) {
					firstReady();
					await secondAtInsert;
					throw new Error("uncertain commit");
				}
				secondReady();
				await secondMayInsert;
				for (const file of record.files) {
					if (file.objectKey && !objects.has(file.objectKey)) {
						throw new Error("winner file deleted");
					}
				}
				return storage.insert(record);
			},
		}),
	});
	const { archive } = await setup.createArchive();
	const first = setup.restore(input(archive.id));
	await firstAtInsert;
	const second = setup.restore(input(archive.id));
	await expect(first).rejects.toThrow();
	releaseSecond();
	expect((await second).status).toBe("created");
	expect(attemptKeys).toHaveLength(2);
	expect(attemptKeys[0]?.some((key) => attemptKeys[1]?.includes(key))).toBe(
		false
	);
});

test("a losing concurrent attempt removes only its own copies", async () => {
	let calls = 0;
	let firstReady!: () => void;
	let releaseFirst!: () => void;
	const firstAtInsert = new Promise<void>((resolve) => {
		firstReady = resolve;
	});
	const firstMayInsert = new Promise<void>((resolve) => {
		releaseFirst = resolve;
	});
	const setup = restoreSetup({
		wrapRestoreStorage: (storage) => ({
			...storage,
			insert: async (record) => {
				calls += 1;
				if (calls === 1) {
					firstReady();
					await firstMayInsert;
				}
				return storage.insert(record);
			},
		}),
	});
	const { archive } = await setup.createArchive();
	const first = setup.restore(input(archive.id));
	await firstAtInsert;
	const winner = await setup.restore(input(archive.id));
	releaseFirst();
	expect((await first).status).toBe("replayed");
	const stored = setup.memory.restores.get(winner.restore.id);
	const winnerKeys = new Set(
		stored?.files.flatMap((file) => (file.objectKey ? [file.objectKey] : []))
	);
	expect(setup.removed.length).toBeGreaterThan(0);
	expect(setup.removed.some((key) => winnerKeys.has(key))).toBe(false);
});

test("an unknown archive or a project the user cannot open is not found", async () => {
	const setup = restoreSetup();
	await setup.createArchive();
	await expect(
		setup.restore(input("11111111-1111-4111-8111-1111111111ff"))
	).rejects.toMatchObject({ code: "NOT_FOUND" });

	const denied = restoreSetup({ hasAccess: false });
	await expect(
		denied.restore(input("11111111-1111-4111-8111-1111111111ff"))
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("does not restore a 1.0 archive missing required world evidence", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	await setup.setArchiveVersion(archive, "project-archive/1.0.0");
	const result = await setup.projectArchiveRestoreStore.restore(
		"user-1",
		input(archive.id) as never
	);
	expect(result).toMatchObject({
		status: "rejected",
		reason: "unsupported_version",
	});
	expect(setup.memory.projects.size).toBe(0);
	expect(setup.copies).toHaveLength(0);
});

test("refuses unsupported record families before copying files", async () => {
	const setup = restoreSetup({
		wrapRestoreStorage: (storage) => ({
			...storage,
			canMaterialize: () => false,
		}),
	});
	const { archive } = await setup.createArchive();
	const result = await setup.projectArchiveRestoreStore.restore(
		"user-1",
		input(archive.id) as never
	);
	expect(result).toMatchObject({
		status: "rejected",
		reason: "unsupported_content",
	});
	expect(setup.copies).toHaveLength(0);
	expect(setup.memory.projects.size).toBe(0);
});

test("preserves the canonical global Profile Contract ID in restore mapping and review references", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	const { restore } = await setup.restore(input(archive.id));
	expect(
		restore.ids.find(
			(entry) =>
				entry.group === "history" &&
				entry.name === "contractRevisions" &&
				entry.sourceId === historyIds.contractRevision
		)?.restoredId
	).toBe(historyIds.contractRevision);
	const stored = setup.memory.restores.get(restore.id);
	const reviews = stored?.sections.find(
		(section) => section.group === "history" && section.name === "reviews"
	)?.records as { contractRevisionId: string }[];
	expect(reviews[0]?.contractRevisionId).toBe(historyIds.contractRevision);
});

test("restores Import Inbox and Reference Board file keys at their normal boundaries", async () => {
	const source = deliverySource();
	const createdAt = "2026-11-01T10:00:00.000Z";
	const inboxId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const imageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
	source.records.importInboxEntries.push({
		id: inboxId,
		createdAt,
		fileName: "source.json",
		sourceContentType: "image/png",
		contentLength: 42,
		sha256: digest("a"),
	});
	source.records.referenceBoardImages.push({
		id: imageId,
		assetRecordId: ids.record,
		createdAt,
		updatedAt: createdAt,
		fileName: "ref.png",
		contentType: "image/png",
		contentLength: 20,
		sha256: digest("b"),
		role: "style",
		customPurpose: null,
		transferredFeatures: ["style"],
		forbiddenFeatures: [],
		contextOverrideRationale: null,
		notes: null,
		sortOrder: 0,
		revision: 1,
	});
	source.files.push({
		kind: "import_inbox_file",
		sourceId: inboxId,
		assetRecordId: null,
		assetVersionId: null,
		byteSize: 42,
		sha256: digest("a"),
		fileName: "source.json",
		contentType: "image/png",
		objectKey: "private/inbox",
	});
	source.files.push({
		kind: "reference_board_file",
		sourceId: imageId,
		assetRecordId: ids.record,
		assetVersionId: null,
		byteSize: 20,
		sha256: digest("b"),
		fileName: "ref.png",
		contentType: "image/png",
		objectKey: "private/board",
	});
	let inboxContentType: string | null | undefined;
	const setup = restoreSetup({
		source,
		copyFile: (file) => {
			if (file.from === "private/inbox") {
				inboxContentType = file.contentType;
			}
			return Promise.resolve();
		},
	});
	const { archive } = await setup.createArchive();
	const result = await setup.restore(input(archive.id));
	const inbox = setup.copies.find((copy) => copy.from === "private/inbox");
	const image = setup.copies.find((copy) => copy.from === "private/board");
	expect(inbox && importInboxObjectKeySchema.safeParse(inbox.to).success).toBe(
		true
	);
	expect(
		image && referenceBoardObjectKeySchema.safeParse(image.to).success
	).toBe(true);
	expect(result.status).toBe("created");
	expect(inboxContentType).toBe(null);
});

test("rewrites the project identity inside immutable package snapshots", async () => {
	const setup = restoreSetup({ source: historySource() });
	const { archive } = await setup.createArchive();
	const { restore } = await setup.restore(input(archive.id));
	const stored = setup.memory.restores.get(restore.id);
	const entries = stored?.sections.find(
		(section) =>
			section.group === "history" && section.name === "generationPackages"
	)?.records as { snapshot: { projectId: string; instruction: string } }[];
	expect(entries[0]?.snapshot.projectId).toBe(restore.restoredProjectId);
	expect(entries[0]?.snapshot.instruction).toBe(projectId);
});

test("rejects a Profile Contract whose definition disagrees with its canonical ID", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	await setup.forgeArchive(archive, (sections) => {
		const contract = sections.find(
			(section) =>
				section.group === "history" && section.name === "contractRevisions"
		)?.records[0] as { id: string };
		contract.id = "icon@9.9.9";
		const reviews = sections.find(
			(section) => section.group === "history" && section.name === "reviews"
		)?.records as { contractRevisionId: string }[];
		for (const review of reviews) {
			review.contractRevisionId = contract.id;
		}
		const activations = sections.find(
			(section) =>
				section.group === "history" && section.name === "contractActivations"
		)?.records as { id: string; contractRevisionId: string }[];
		for (const activation of activations) {
			activation.id = contract.id;
			activation.contractRevisionId = contract.id;
		}
	});
	await expect(setup.restore(input(archive.id))).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "archive_invalid" },
	});
	expect(setup.memory.projects.size).toBe(0);
	expect(setup.copies).toHaveLength(0);
});

test("preserves Required Set item keys while remapping project-owned revision and record IDs", async () => {
	const source = historySource();
	source.history.metadataProposals = [];
	source.history.metadataDecisions = [];
	source.history.requiredSetRevisions = [
		{
			id: "revision-one",
			assetFamilyId: ids.family,
			revisionNumber: 1,
			items: [
				{
					id: "idle",
					name: "Idle",
					kind: "animation",
					disposition: "required",
					assetRecordIds: [ids.record],
				},
			],
			createdAt: "2026-11-01T00:00:00.000Z",
		},
	];
	const setup = restoreSetup({ source });
	const { archive } = await setup.createArchive();
	const { restore } = await setup.restore(input(archive.id));
	const stored = setup.memory.restores.get(restore.id);
	const records = stored?.sections.find(
		(section) => section.name === "requiredSetRevisions"
	)?.records as {
		id: string;
		items: { id: string; assetRecordIds: string[] }[];
	}[];
	expect(records[0]?.id).not.toBe("revision-one");
	expect(records[0]?.items[0]?.id).toBe("idle");
	expect(records[0]?.items[0]?.assetRecordIds[0]).not.toBe(ids.record);
});

test("maps the latest bundle marker to the restored project in both records and ID inventory", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	const { restore } = await setup.restore(input(archive.id));
	const marker = restore.ids.find(
		(entry) =>
			entry.group === "delivery" && entry.name === "exportBundleMarkers"
	);
	expect(marker).toMatchObject({
		sourceId: projectId,
		restoredId: restore.restoredProjectId,
	});
	const stored = setup.memory.restores.get(restore.id);
	const entries = stored?.sections.find(
		(section) => section.name === "exportBundleMarkers"
	)?.records as { id: string }[];
	expect(entries[0]?.id).toBe(restore.restoredProjectId);
});

test("restores a supplied archive when its source project is unavailable and replays once", async () => {
	const setup = restoreSetup();
	const { archive } = await setup.createArchive();
	const stored = await setup.archives.find(projectId, archive.id);
	if (!stored) {
		throw new Error("Missing archive");
	}
	const scope = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
	const request = {
		projectId: scope,
		archiveId: archive.id,
		idempotencyKey: "portable-key",
		name: "Portable restore",
	};
	const first = await setup.projectArchiveRestoreStore.restoreFromArchive(
		"user-1",
		request,
		stored
	);
	const again = await setup.projectArchiveRestoreStore.restoreFromArchive(
		"user-1",
		request,
		stored
	);
	expect(first).toMatchObject({
		status: "created",
		restore: { sourceProjectId: projectId },
	});
	expect(again).toMatchObject({ status: "replayed" });
	expect(setup.memory.projects.size).toBe(1);
	if (!first || first.status === "rejected") {
		throw new Error("Restore failed");
	}
	expect(
		await setup.projectArchiveRestoreStore.get(
			"user-1",
			scope,
			first.restore.id
		)
	).toMatchObject({ id: first.restore.id });
	expect(
		(await setup.projectArchiveRestoreStore.list("user-1", projectId))?.restores
	).toEqual([]);
});

test("preserves tied Review Event ID order while mapping independent identities", async () => {
	const source = historySource();
	const at = "2026-11-01T00:00:00.000Z";
	source.history.assetVersionReviews = [
		{
			id: "10000000-0000-4000-8000-000000000001",
			assetRecordId: ids.record,
			versionId: ids.version2,
			decision: "approved",
			rationale: "approved first",
			createdAt: at,
		},
		{
			id: "90000000-0000-4000-8000-000000000001",
			assetRecordId: ids.record,
			versionId: ids.version2,
			decision: "rejected",
			rationale: "rejected second",
			createdAt: at,
		},
	];
	const setup = restoreSetup({ source });
	const { archive } = await setup.createArchive();
	const { restore } = await setup.restore(input(archive.id));
	const mapped = new Map(
		restore.ids.map((entry) => [entry.sourceId, entry.restoredId])
	);
	const first = mapped.get(source.history.assetVersionReviews[0]?.id ?? "");
	const second = mapped.get(source.history.assetVersionReviews[1]?.id ?? "");
	expect(first).toBeDefined();
	expect(second).toBeDefined();
	expect(
		first === undefined || second === undefined ? false : first < second
	).toBe(true);
	expect(first).not.toBe(source.history.assetVersionReviews[0]?.id);
	expect(z.uuid().safeParse(first).success).toBe(true);
	expect(z.uuid().safeParse(second).success).toBe(true);
	const replay = await setup.restore(input(archive.id));
	expect(
		replay.restore.ids.find(
			(entry) => entry.sourceId === source.history.assetVersionReviews[0]?.id
		)?.restoredId
	).toBe(first);
	const another = await setup.restore(
		input(archive.id, { idempotencyKey: "another-review-restore" })
	);
	expect(
		another.restore.ids.find(
			(entry) => entry.sourceId === source.history.assetVersionReviews[0]?.id
		)?.restoredId
	).not.toBe(first);
});

test("withdraws copied files and does not publish when a restored object fails readback", async () => {
	const setup = restoreSetup({
		verifyFile: ({ objectKey }) =>
			Promise.resolve(!objectKey.includes("/asset-records/")),
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(setup.memory.projects.size).toBe(0);
	expect(setup.removed).toHaveLength(1);
});

test("withdraws a restore when canonical record readback disagrees", async () => {
	const setup = restoreSetup({
		verifyCanonical: () => Promise.resolve(["Missing Asset Record"]),
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(setup.memory.projects.size).toBe(0);
	expect(setup.removed).toEqual([]);
});

test("a failed canonical read cannot be replayed as a completed restore", async () => {
	let checks = 0;
	const setup = restoreSetup({
		verifyCanonical: () => {
			checks += 1;
			return checks === 1
				? Promise.reject(new Error("read unavailable"))
				: Promise.resolve([]);
		},
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	const retry = await setup.restore(input(archive.id));
	expect(checks).toBe(2);
	expect(retry.status).toBe("created");
	expect(setup.memory.projects.size).toBe(1);
});

test("an unverified restore stays hidden and is rechecked before replay", async () => {
	let attempts = 0;
	let checks = 0;
	const setup = restoreSetup({
		verifyCanonical: () => {
			checks += 1;
			return Promise.resolve([]);
		},
		wrapRestoreStorage: (storage) => ({
			...storage,
			markVerified: (scope, id) => {
				attempts += 1;
				return attempts === 1
					? Promise.reject(new Error("write unavailable"))
					: storage.markVerified(scope, id);
			},
		}),
	});
	const { archive } = await setup.createArchive();
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	const [pending] = setup.memory.restores.values();
	if (!pending) {
		throw new Error("Missing pending restore");
	}
	expect(pending.restore.canonicalVerified).toBe(false);
	expect(
		await setup.projectArchiveRestoreStore.get(
			"user-1",
			projectId,
			pending.restore.id
		)
	).toBeNull();
	expect((await setup.listRestores()).restores).toEqual([]);
	const retry = await setup.restore(input(archive.id));
	expect(retry.status).toBe("replayed");
	expect(checks).toBe(2);
	expect((await setup.listRestores()).restores).toHaveLength(1);
});

test("a legacy unverified restore fails closed until canonical recovery succeeds", async () => {
	let available = true;
	const setup = restoreSetup({
		verifyCanonical: () =>
			available ? Promise.resolve([]) : Promise.resolve(["missing record"]),
	});
	const { archive } = await setup.createArchive();
	const completed = await setup.restore(input(archive.id));
	const stored = setup.memory.restores.get(completed.restore.id);
	if (!stored) {
		throw new Error("Missing restore fixture");
	}
	stored.restore.canonicalVerified = false;
	available = false;
	await expect(setup.restore(input(archive.id))).rejects.toThrow();
	expect(stored.restore.canonicalVerified).toBe(false);
	available = true;
	expect((await setup.restore(input(archive.id))).status).toBe("replayed");
	expect(stored.restore.canonicalVerified).toBe(true);
});
