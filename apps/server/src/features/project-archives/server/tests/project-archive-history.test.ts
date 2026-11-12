import { expect, test } from "bun:test";
import {
	digest,
	foundationSource,
	ids,
	setup,
} from "./project-archive-fixtures";
import { historyIds, historySource } from "./project-archive-history-fixtures";

const historySection = (
	archive: { sections: { group: string; name: string; records: unknown[] }[] },
	name: string
) =>
	archive.sections.find(
		(section) => section.group === "history" && section.name === name
	)?.records as Record<string, unknown>[];

test("a created archive carries the production and review history under its source ids", async () => {
	const { create, get } = setup({ source: historySource() });
	const created = await create();
	const reread = await get(created.archive.id);
	expect(reread).toEqual(created.archive);

	expect(historySection(reread, "reviews")).toMatchObject([
		{ assetFamilyId: ids.family, id: historyIds.review, kind: "icon_family" },
	]);
	expect(historySection(reread, "metadataProposals")).toMatchObject([
		{ id: historyIds.proposal },
	]);
	expect(historySection(reread, "metadataDecisions")).toMatchObject([
		{ assetVersionId: ids.version2, id: historyIds.proposal },
	]);
	expect(historySection(reread, "generationPackages")).toMatchObject([
		{ assetRecordId: ids.record, id: historyIds.generationPackage },
	]);
	expect(historySection(reread, "experimentTrials")).toMatchObject([
		{ assetVersionId: ids.version2, experimentId: historyIds.experiment },
	]);
	expect(historySection(reread, "recipeVersions")).toMatchObject([
		{ recipeId: historyIds.recipe, versionNumber: 1 },
	]);
	expect(historySection(reread, "rightsRecords")).toMatchObject([
		{ assetRecordId: ids.record, id: historyIds.rights },
	]);
	expect(reread.manifest.contents).toContainEqual(
		expect.objectContaining({
			group: "history",
			name: "reviews",
			recordCount: 1,
		})
	);
});

test("a rights evidence file stays out of the archive and is kept by identity, digest and absence", async () => {
	const { create } = setup({ source: historySource() });
	const { archive } = await create();
	expect(
		archive.manifest.files.filter(
			(file) => file.kind === "rights_evidence_file"
		)
	).toEqual([
		expect.objectContaining({
			byteSize: 400_000,
			exclusionReason: "evidence_not_archived",
			presence: "excluded",
			sha256: digest("f"),
			sourceId: historyIds.rights,
		}),
	]);
	expect(JSON.stringify(archive)).not.toContain("projects/p/");
});

test("credential-like fields inside the history keep the archive from being created", async () => {
	const source = historySource();
	source.history.generationPackages = source.history.generationPackages.map(
		(pkg) => ({ ...pkg, snapshot: { provider: { apiKey: "abc" } } })
	);
	const { create, list } = setup({ source });
	await expect(create()).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "secret_detected" },
	});
	expect((await list()).archives).toEqual([]);
});

test("history that points at a record the archive does not hold creates no archive", async () => {
	const missing = "77777777-7777-4777-8777-777777777799";
	const breakers: ((source: ReturnType<typeof historySource>) => void)[] = [
		(s) => {
			s.history.experimentTrials = s.history.experimentTrials.map((t) => ({
				...t,
				assetVersionId: missing,
			}));
		},
		(s) => {
			s.history.metadataDecisions = s.history.metadataDecisions.map((d) => ({
				...d,
				id: missing,
			}));
		},
		(s) => {
			s.history.reviews = s.history.reviews.map((r) => ({
				...r,
				contractRevisionId: missing,
			}));
		},
		(s) => {
			s.history.rightsRecords = s.history.rightsRecords.map((r) => ({
				...r,
				assetRecordId: missing,
			}));
		},
		(s) => {
			s.history.recipeVersions = s.history.recipeVersions.map((v) => ({
				...v,
				recipeId: missing,
			}));
		},
		(s) => {
			s.history.experiments = s.history.experiments.map((e) => ({
				...e,
				selectedTrialId: missing,
			}));
		},
	];
	for (const breakSource of breakers) {
		const source = historySource();
		breakSource(source);
		const { create, list } = setup({ source });
		// biome-ignore lint/performance/noAwaitInLoops: Each case needs its own isolated store.
		await expect(create()).rejects.toMatchObject({
			code: "BAD_REQUEST",
			data: { reason: "inconsistent_records" },
		});
		expect((await list()).archives).toEqual([]);
	}
});

test("the same idempotency key replays the archive with its history and never makes a second", async () => {
	const { create, list } = setup({ source: historySource() });
	const first = await create();
	const replay = await create();
	expect(replay.status).toBe("replayed");
	expect(replay.archive).toEqual(first.archive);
	expect((await list()).archives).toHaveLength(1);
});

test("a stored history section that no longer matches its manifest fails to read", async () => {
	let tamper = false;
	const { create, get } = setup({
		source: historySource(),
		wrapStorage: (storage) => ({
			...storage,
			find: async (...args) => {
				const found = await storage.find(...args);
				return found && tamper
					? {
							...found,
							sections: found.sections.map((section) =>
								section.name === "rightsRecords"
									? { ...section, records: [] }
									: section
							),
						}
					: found;
			},
		}),
	});
	const { archive } = await create();
	tamper = true;
	await expect(get(archive.id)).rejects.toMatchObject({ code: "CONFLICT" });
});

test("a project without history still archives, with every history section empty", async () => {
	const { create } = setup({ source: foundationSource() });
	const { archive } = await create();
	const sections = archive.sections.filter(
		(section) => section.group === "history"
	);
	expect(sections.length).toBeGreaterThan(0);
	expect(sections.every((section) => section.records.length === 0)).toBe(true);
});

test("building the archive leaves the source records unchanged", async () => {
	const source = historySource();
	const before = structuredClone(source);
	const { create } = setup({ source });
	await create();
	expect(source).toEqual(before);
});
