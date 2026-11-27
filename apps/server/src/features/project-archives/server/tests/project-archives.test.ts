import { expect, test } from "bun:test";
import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import {
	digest,
	foundationSource,
	ids,
	otherProjectId,
	projectId,
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

test("a new archive retains Visual World, Theme and independent Asset Record data", async () => {
	const source = foundationSource();
	source.records.visualWorlds = [
		{
			id: ids.world,
			name: "World",
			description: "World description",
			createdAt: "2026-11-01T10:00:00.000Z",
		},
	];
	source.records.themes = [
		{
			id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			visualWorldId: ids.world,
			name: "Theme",
			description: "Theme description",
			createdAt: "2026-11-01T10:00:00.000Z",
		},
	];
	const [family] = source.records.assetFamilies;
	if (!family) {
		throw new Error("Missing family");
	}
	family.canonicalVersionId = ids.version2;
	const [record] = source.records.assetRecords;
	if (!record) {
		throw new Error("Missing fixture record");
	}
	source.records.assetRecords.push({
		...record,
		id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		assetFamilyId: null,
	});
	const { create } = setup({ source });
	const { archive } = await create();
	expect(archive.schemaVersion).toBe("project-archive/1.1.0");
	expect(
		archive.sections.find((section) => section.name === "assetFamilies")
			?.records
	).toContainEqual(
		expect.objectContaining({ canonicalVersionId: ids.version2 })
	);
	expect(
		archive.sections.find((section) => section.name === "visualWorlds")?.records
	).toEqual(source.records.visualWorlds);
	expect(
		archive.sections.find((section) => section.name === "themes")?.records
	).toEqual(source.records.themes);
	expect(
		archive.sections.find((section) => section.name === "assetRecords")?.records
	).toContainEqual(expect.objectContaining({ assetFamilyId: null }));
});

test("a stored 1.0 archive remains readable without inventing its missing context", async () => {
	const { recordContentDigest } = await import(
		"@sprite-anvil/api/record-content-digest"
	);
	let legacy = false;
	const { create, get } = setup({
		wrapStorage: (storage) => ({
			...storage,
			find: async (project, id) => {
				const record = await storage.find(project, id);
				if (!(record && legacy)) {
					return record;
				}
				record.sections = record.sections.filter(
					(section) =>
						![
							"visualWorlds",
							"themes",
							"importInboxEntries",
							"referenceBoardImages",
							"referenceBoardImageHistory",
							"managedSnapshots",
							"contextProposals",
						].includes(section.name)
				);
				record.archive.schemaVersion = "project-archive/1.0.0";
				record.archive.manifestDigest = await recordContentDigest({
					contents: record.sections.map(
						({ digest: sectionHash, group, name, recordCount }) => ({
							digest: sectionHash,
							group,
							name,
							recordCount,
						})
					),
					files: record.files
						.map(({ sourceObjectKey: _key, ...file }) => file)
						.sort(
							(a, b) =>
								a.kind.localeCompare(b.kind) ||
								a.sourceId.localeCompare(b.sourceId)
						),
					schemaVersion: record.archive.schemaVersion,
					source: { projectId: record.archive.projectId },
				});
				return record;
			},
		}),
	});
	const { archive } = await create();
	legacy = true;
	const result = await get(archive.id);
	expect(result.schemaVersion).toBe("project-archive/1.0.0");
	expect(
		result.sections.some((section) => section.name === "visualWorlds")
	).toBe(false);
});

test("a version without its pinned file cannot be archived as complete", async () => {
	const source = foundationSource();
	source.files = source.files.filter((file) => file.sourceId !== ids.version1);
	const { create } = setup({ source });
	await expect(create()).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("an archive includes Import Inbox and Reference Board records and their managed files", async () => {
	const source = foundationSource();
	const createdAt = "2026-11-01T10:00:00.000Z";
	const inboxId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
	const referenceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
	source.records.importInboxEntries = [
		{
			id: inboxId,
			createdAt,
			fileName: "source.json",
			sourceContentType: "application/json",
			contentLength: 42,
			sha256: digest("a"),
		},
	];
	source.records.referenceBoardImages = [
		{
			id: referenceId,
			createdAt,
			updatedAt: createdAt,
			assetRecordId: ids.record,
			fileName: "reference.png",
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
		},
	];
	source.records.referenceBoardImageHistory = [];
	source.files.push({
		kind: "import_inbox_file",
		sourceId: inboxId,
		assetRecordId: null,
		assetVersionId: null,
		byteSize: 42,
		sha256: digest("a"),
		fileName: "source.json",
		contentType: "application/json",
		objectKey: "private/inbox",
	});
	source.files.push({
		kind: "reference_board_file",
		sourceId: referenceId,
		assetRecordId: ids.record,
		assetVersionId: null,
		byteSize: 20,
		sha256: digest("b"),
		fileName: "reference.png",
		contentType: "image/png",
		objectKey: "private/reference",
	});
	const { archive } = await setup({ source }).create();
	expect(archive.manifest.files).toContainEqual(
		expect.objectContaining({
			kind: "import_inbox_file",
			sourceId: inboxId,
			presence: "included",
		})
	);
	expect(archive.manifest.files).toContainEqual(
		expect.objectContaining({
			kind: "reference_board_file",
			sourceId: referenceId,
			presence: "included",
		})
	);
	expect(
		archive.sections.find((section) => section.name === "referenceBoardImages")
			?.records
	).toEqual(source.records.referenceBoardImages);
	expect(JSON.stringify(archive)).not.toContain("private/");
});

test("selected Managed Snapshot retains its creation metadata in the archive", async () => {
	const source = foundationSource();

	const { archive } = await setup({ source }).create({
		workingFileIds: [ids.workingA],
	});
	expect(
		archive.sections.find((section) => section.name === "managedSnapshots")
			?.records
	).toEqual(source.records.managedSnapshots);
	expect(archive.manifest.files).toContainEqual(
		expect.objectContaining({
			kind: "working_file",
			sourceId: ids.workingA,
			presence: "included",
		})
	);
});

test("archive retains the Context Proposal behind a revision", async () => {
	const source = foundationSource();
	const proposalId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
	source.records.contextProposals = [
		{
			id: proposalId,
			baseContextRevisionId: ids.contextRevision,
			contractVersion: "context-agent/1.0.0",
			sourceKind: "structured_control",
			proposal: {
				id: proposalId,
				projectId,
				baseContextRevisionId: ids.contextRevision,
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
						scope: { kind: "project", id: projectId },
						value: { type: "text_list", value: ["Use a compact palette"] },
						rationale: "Preserve consistency",
						evidence: [
							{ kind: "user_decision", statement: "Keep palettes compact" },
						],
					},
				],
				validation: {
					isValid: true,
					checkedAt: "2026-11-01T10:00:00.000Z",
					conflicts: [],
				},
				activationAllowed: false,
				createdAt: "2026-11-01T10:00:00.000Z",
			},
			createdAt: "2026-11-01T10:00:00.000Z",
		},
	];
	const [revision] = source.records.contextRevisions;
	if (!revision) {
		throw new Error("Missing revision");
	}
	revision.sourceProposalId = proposalId;
	const { archive } = await setup({ source }).create();
	expect(
		archive.sections.find((section) => section.name === "contextProposals")
			?.records
	).toEqual(source.records.contextProposals);
});

test("lists only authorized project working files and rejects unknown selections", async () => {
	const authorized = setup();
	const catalog = await authorized.listWorkingFiles();
	expect(catalog.files).toContainEqual(
		expect.objectContaining({
			id: ids.workingA,
			fileName: "hero.aseprite",
			available: true,
		})
	);
	const unavailable = setup({ verifyFile: () => Promise.resolve(false) });
	expect(
		(await unavailable.listWorkingFiles()).files.every(
			(file) => !file.available
		)
	).toBe(true);
	const foreign = setup({ hasAccess: false });
	await expect(foreign.listWorkingFiles()).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
	await expect(
		authorized.create({
			workingFileIds: ["88888888-8888-4888-8888-888888888899"],
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("rejects a file beyond PostgreSQL integer storage capacity before publication", async () => {
	const source = foundationSource();
	source.files = source.files.map((file) =>
		file.sourceId === ids.workingA ? { ...file, byteSize: 2_147_483_648 } : file
	);
	source.records.managedSnapshots = source.records.managedSnapshots.map(
		(file) =>
			file.id === ids.workingA ? { ...file, byteSize: 2_147_483_648 } : file
	);
	const { create } = setup({ source });
	await expect(create()).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: expect.objectContaining({ reason: "file_storage_limit" }),
	});
	source.files = source.files.map((file) =>
		file.sourceId === ids.workingA ? { ...file, byteSize: 2_147_483_647 } : file
	);
	source.records.managedSnapshots = source.records.managedSnapshots.map(
		(file) =>
			file.id === ids.workingA ? { ...file, byteSize: 2_147_483_647 } : file
	);
	expect((await setup({ source }).create()).status).toBe("created");
});

test("an archive preserves the initial Context Revision zero and the active revision", async () => {
	const source = foundationSource();
	const [active] = source.records.contextRevisions;
	if (!active) {
		throw new Error("Missing active revision");
	}
	const baseline = {
		...active,
		id: crypto.randomUUID(),
		revisionNumber: 0,
		state: "baseline" as const,
	};
	source.records.contextRevisions.unshift(baseline);
	const { create, get } = setup({ source });
	const created = await create();
	const archive = await get(created.archive.id);
	expect(
		archive.sections.find((section) => section.name === "contextRevisions")
			?.records
	).toContainEqual(baseline);
});
