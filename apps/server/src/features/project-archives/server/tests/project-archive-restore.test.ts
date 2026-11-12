import { expect, test } from "bun:test";
import { verifyRestoredRecords } from "@sprite-anvil/api/project-archive-restore";
import { deliveryIds } from "./project-archive-delivery-fixtures";
import { ids, projectId } from "./project-archive-fixtures";
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

test("the restored delivery group keeps its bundle digests and re-derives its diffs under the new ids", async () => {
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
	expect(section("exportBundles").map((b) => b.manifestDigest)).toEqual(
		archived.map((b) => b.manifestDigest)
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
		expect(copy.to).toContain(restore.id);
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
