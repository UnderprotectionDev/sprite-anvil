import { expect, test } from "bun:test";
import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import {
	digest,
	foundationSource,
	ids,
	otherProjectId,
	setup,
} from "./project-archive-fixtures";

test("a created archive is re-read with its records tied to the same source records", async () => {
	const { create, get } = setup();
	const created = await create();
	expect(created.status).toBe("created");

	const reread = await get(created.archive.id);
	expect(reread).toEqual(created.archive);

	const section = (name: string) =>
		reread.sections.find(
			(entry) => entry.group === "foundation" && entry.name === name
		)?.records as { id: string }[];
	expect(section("contextRevisions").map((r) => r.id)).toEqual([
		ids.contextRevision,
	]);
	expect(section("assetVersions").map((r) => r.id)).toEqual([
		ids.version1,
		ids.version2,
	]);
	expect(section("references")).toMatchObject([
		{
			assetRecordId: ids.record,
			role: "style",
			targetVersionId: ids.version1,
		},
	]);
	expect(section("unitVersions")).toMatchObject([
		{ assetVersionId: ids.version2, sourceAssetVersionId: ids.version1 },
	]);
	expect(reread.manifest.contents).toContainEqual(
		expect.objectContaining({
			group: "foundation",
			name: "assetVersions",
			recordCount: 2,
		})
	);
	expect(
		reread.manifest.files.filter((file) => file.kind === "asset_version_file")
	).toMatchObject([
		{ presence: "included", sha256: digest("a"), sourceId: ids.version1 },
		{ presence: "included", sha256: digest("b"), sourceId: ids.version2 },
	]);
});

test("working files not selected are listed as excluded by identity and digest, never as included", async () => {
	const { create } = setup();
	const { archive } = await create({ workingFileIds: [ids.workingA] });

	const workingFiles = archive.manifest.files.filter(
		(file) => file.kind === "working_file"
	);
	expect(workingFiles).toEqual([
		expect.objectContaining({
			byteSize: 9_000_000,
			exclusionReason: null,
			presence: "included",
			sha256: digest("c"),
			sourceId: ids.workingA,
		}),
		expect.objectContaining({
			byteSize: 8_000_000,
			exclusionReason: "not_selected",
			presence: "excluded",
			sha256: digest("d"),
			sourceId: ids.workingB,
		}),
	]);
	expect(JSON.stringify(archive)).not.toContain("projects/p/");
});

test("a working file the project does not hold is refused and creates no archive", async () => {
	const { create, list } = setup();
	await expect(
		create({ workingFileIds: ["88888888-8888-4888-8888-888888888899"] })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect((await list()).archives).toEqual([]);
});

function withRule(rule: unknown): ProjectArchiveSource {
	const source = foundationSource();
	source.records.contextRevisions = source.records.contextRevisions.map(
		(revision) => ({ ...revision, rules: [rule] })
	);
	return source;
}

test("credential-like fields keep the archive from being created", async () => {
	const { create, list } = setup({
		source: withRule({ id: "r", settings: { accessToken: "abc" } }),
	});
	await expect(create()).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "secret_detected" },
	});
	expect((await list()).archives).toEqual([]);
});

test("a server secret value never reaches the archive even without a telling field name", async () => {
	const { create, list } = setup({
		secretValues: ["s3cr3t-server-value"],
		source: withRule({ id: "r", note: "use s3cr3t-server-value here" }),
	});
	await expect(create()).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect((await list()).archives).toEqual([]);
});

test("the same idempotency key replays one archive and different content under it conflicts", async () => {
	const { create, list } = setup();
	const first = await create();
	const replay = await create();
	expect(replay.status).toBe("replayed");
	expect(replay.archive).toEqual(first.archive);
	expect((await list()).archives).toHaveLength(1);

	await expect(
		create({ workingFileIds: [ids.workingA] })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect((await list()).archives).toHaveLength(1);
});

test("a failed write leaves no archive", async () => {
	const { create, list } = setup({
		wrapStorage: (storage) => ({
			...storage,
			insert: () => Promise.reject(new Error("disk full")),
		}),
	});
	await expect(create()).rejects.toBeDefined();
	expect((await list()).archives).toEqual([]);
});

test("a stored archive that no longer matches its manifest fails to read", async () => {
	let tamper: "none" | "record" | "group" = "none";
	const { create, get } = setup({
		wrapStorage: (storage) => ({
			...storage,
			find: async (...args) => {
				const found = await storage.find(...args);
				if (!found || tamper === "none") {
					return found;
				}
				return tamper === "record"
					? {
							...found,
							sections: found.sections.map((section) =>
								section.name === "assetVersions"
									? { ...section, records: section.records.slice(1) }
									: section
							),
						}
					: {
							...found,
							sections: [
								...found.sections,
								{
									digest: digest("e"),
									group: "unregistered",
									name: "x",
									recordCount: 0,
									records: [],
								},
							],
						};
			},
		}),
	});
	const { archive } = await create();
	tamper = "record";
	await expect(get(archive.id)).rejects.toMatchObject({ code: "CONFLICT" });
	tamper = "group";
	await expect(get(archive.id)).rejects.toMatchObject({ code: "CONFLICT" });
});

test("records that point at something the archive does not hold create no archive", async () => {
	const source = foundationSource();
	source.records.references = source.records.references.map((reference) => ({
		...reference,
		targetVersionId: "77777777-7777-4777-8777-777777777799",
	}));
	const { create, list } = setup({ source });
	await expect(create()).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "inconsistent_records" },
	});
	expect((await list()).archives).toEqual([]);
});

test("an included file that cannot be verified against its digest creates no archive", async () => {
	const { create, list } = setup({
		verifyFile: ({ objectKey }) =>
			Promise.resolve(objectKey !== "projects/p/versions/v2"),
	});
	await expect(create()).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "file_unverifiable", sourceIds: [ids.version2] },
	});
	expect((await list()).archives).toEqual([]);
});

test("an Asset Version without a digest cannot be pinned", async () => {
	const source = foundationSource();
	source.records.assetVersions = source.records.assetVersions.map(
		(version) => ({ ...version, contentDigest: null })
	);
	const { create } = setup({ source });
	await expect(create()).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("archives stay inside the project and its owner", async () => {
	const { create, get, list } = setup();
	const { archive } = await create();
	await expect(get(archive.id, otherProjectId)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	expect((await list(otherProjectId)).archives).toEqual([]);

	const denied = setup({ hasAccess: false });
	await expect(denied.create()).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(denied.list()).rejects.toMatchObject({ code: "NOT_FOUND" });
});
