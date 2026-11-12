import { expect, test } from "bun:test";
import {
	deliveryIds,
	deliverySource,
} from "./project-archive-delivery-fixtures";
import { digest, foundationSource, setup } from "./project-archive-fixtures";

const deliverySection = (
	archive: { sections: { group: string; name: string; records: unknown[] }[] },
	name: string
) =>
	archive.sections.find(
		(section) => section.group === "delivery" && section.name === name
	)?.records as Record<string, unknown>[];

test("a created archive carries the delivery and validation history under its source ids", async () => {
	const { create, get } = setup({ source: deliverySource() });
	const created = await create();
	const reread = await get(created.archive.id);
	expect(reread).toEqual(created.archive);

	expect(deliverySection(reread, "exportProfiles")).toMatchObject([
		{ id: deliveryIds.profile },
	]);
	expect(deliverySection(reread, "exportProfileRevisions")).toMatchObject([
		{ id: deliveryIds.profileRevision, profileId: deliveryIds.profile },
	]);
	expect(deliverySection(reread, "deliveryRefreshLocks")).toMatchObject([
		{ bundleId: deliveryIds.bundle1, id: deliveryIds.lock },
	]);
	expect(deliverySection(reread, "exportBundles")).toHaveLength(2);
	expect(deliverySection(reread, "deliveryTargets")).toMatchObject([
		{ id: deliveryIds.target },
	]);
	expect(deliverySection(reread, "deliveryFulfilments")).toHaveLength(2);
	expect(deliverySection(reread, "historicalRiskNotices")).toMatchObject([
		{ fulfilmentId: deliveryIds.fulfilment1, id: deliveryIds.notice },
	]);
	expect(deliverySection(reread, "deliveryDiffs")).toMatchObject([
		{
			fromFulfilmentId: deliveryIds.fulfilment1,
			toFulfilmentId: deliveryIds.fulfilment2,
		},
	]);
	expect(deliverySection(reread, "runtimeValidations")).toMatchObject([
		{ bundleId: deliveryIds.bundle1, id: deliveryIds.validation },
	]);
	expect(reread.manifest.contents).toContainEqual(
		expect.objectContaining({
			group: "delivery",
			name: "deliveryFulfilments",
			recordCount: 2,
		})
	);
});

test("a runtime evidence file stays out of the archive and is kept by identity, digest and absence", async () => {
	const { create } = setup({ source: deliverySource() });
	const { archive } = await create();
	expect(
		archive.manifest.files.filter(
			(file) => file.kind === "runtime_evidence_file"
		)
	).toEqual([
		expect.objectContaining({
			byteSize: 5_000_000,
			exclusionReason: "evidence_not_archived",
			presence: "excluded",
			sha256: digest("e"),
			sourceId: deliveryIds.evidence,
		}),
	]);
	expect(JSON.stringify(archive)).not.toContain("projects/p/");
});

test("credential-like fields inside the delivery history keep the archive from being created", async () => {
	const source = deliverySource();
	source.delivery.exportProfileRevisions =
		source.delivery.exportProfileRevisions.map((revision) => ({
			...revision,
			definition: { upload: { accessToken: "abc" } },
		}));
	const { create, list } = setup({ source });
	await expect(create()).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "secret_detected" },
	});
	expect((await list()).archives).toEqual([]);
});

test("delivery records whose links or digests do not hold create no archive", async () => {
	const missing = "77777777-7777-4777-8777-777777777799";
	const breakers: ((source: ReturnType<typeof deliverySource>) => void)[] = [
		(s) => {
			s.delivery.deliveryRefreshLocks = s.delivery.deliveryRefreshLocks.map(
				(lock) => ({ ...lock, bundleId: missing })
			);
		},
		(s) => {
			s.delivery.deliveryRefreshLocks = s.delivery.deliveryRefreshLocks.map(
				(lock) => ({ ...lock, bundleManifestDigest: digest("0") })
			);
		},
		(s) => {
			s.delivery.exportBundles = s.delivery.exportBundles.map((bundle) => ({
				...bundle,
				profileRevisionId: missing,
			}));
		},
		(s) => {
			s.delivery.deliveryFulfilments = s.delivery.deliveryFulfilments.map(
				(fulfilment) => ({
					...fulfilment,
					requirements: fulfilment.requirements.map((r) => ({
						...r,
						assetVersionIds: [missing],
					})),
				})
			);
		},
		(s) => {
			s.delivery.historicalRiskNotices = s.delivery.historicalRiskNotices.map(
				(notice) => ({ ...notice, rightsRecordId: missing })
			);
		},
		(s) => {
			s.delivery.runtimeValidations = s.delivery.runtimeValidations.map(
				(validation) => ({ ...validation, manifestDigest: digest("0") })
			);
		},
		(s) => {
			s.delivery.runtimeValidations = s.delivery.runtimeValidations.map(
				(validation) => ({ ...validation, supersedesRecordId: missing })
			);
		},
		(s) => {
			s.delivery.deliveryDiffs = s.delivery.deliveryDiffs.map((diff) => ({
				...diff,
				context: { ...diff.context, changed: true },
			}));
		},
		(s) => {
			s.files = s.files.filter((file) => file.kind !== "runtime_evidence_file");
		},
	];
	for (const breakSource of breakers) {
		const source = deliverySource();
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

test("the same idempotency key replays the archive with its delivery history and never makes a second", async () => {
	const { create, list } = setup({ source: deliverySource() });
	const first = await create();
	const replay = await create();
	expect(replay.status).toBe("replayed");
	expect(replay.archive).toEqual(first.archive);
	expect((await list()).archives).toHaveLength(1);
});

test("a stored delivery section that no longer matches its manifest fails to read", async () => {
	let tamper = false;
	const { create, get } = setup({
		source: deliverySource(),
		wrapStorage: (storage) => ({
			...storage,
			find: async (...args) => {
				const found = await storage.find(...args);
				return found && tamper
					? {
							...found,
							sections: found.sections.map((section) =>
								section.name === "deliveryFulfilments"
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

test("a project without delivery history still archives, with every delivery section empty", async () => {
	const { create } = setup({ source: foundationSource() });
	const { archive } = await create();
	const sections = archive.sections.filter(
		(section) => section.group === "delivery"
	);
	expect(sections.length).toBeGreaterThan(0);
	expect(sections.every((section) => section.records.length === 0)).toBe(true);
});

test("building the archive leaves the source records unchanged", async () => {
	const source = deliverySource();
	const before = structuredClone(source);
	const { create } = setup({ source });
	await create();
	expect(source).toEqual(before);
});
