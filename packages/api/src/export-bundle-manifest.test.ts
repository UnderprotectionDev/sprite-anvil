import { expect, test } from "bun:test";
import {
	buildExportBundle,
	checkExportBundleFiles,
	type ExportBundleProfilePin,
	type ExportBundleSource,
} from "./export-bundle-manifest";

const profile: ExportBundleProfilePin = {
	contentDigest: "a".repeat(64),
	contractVersion: "1.0.0",
	definition: {
		fileFormat: "png",
		layout: "grid",
		metadataMapping: [],
		namingTemplate: "{family}_{item}",
		padding: 0,
		scale: 1,
		trim: "none",
	},
	profileId: "p-1",
	revisionId: "r-1",
	revisionNumber: 2,
};

function source(
	overrides: Partial<ExportBundleSource> = {}
): ExportBundleSource {
	return {
		assetVersions: [
			{
				assetFamilyId: "fam-1",
				assetRecordId: "rec-1",
				byteSize: 120,
				contentType: "image/png",
				id: "av-1",
				productionEvidenceDigest: "b".repeat(64),
				providerGenerationRecordId: null,
				sha256: "c".repeat(64),
				versionNumber: 3,
			},
			{
				assetFamilyId: "fam-1",
				assetRecordId: "rec-2",
				byteSize: 80,
				contentType: "image/png",
				id: "av-2",
				productionEvidenceDigest: "d".repeat(64),
				providerGenerationRecordId: "gen-1",
				sha256: "e".repeat(64),
				versionNumber: 1,
			},
		],
		blockers: [],
		compositeVersions: [],
		context: { revisionId: "ctx-1", revisionNumber: 4 },
		families: [
			{
				assetFamilyId: "fam-1",
				assetFamilyName: "Hero",
				profileContractRevisionIds: [],
				requiredSet: {
					items: [
						{
							assetRecordIds: ["rec-1"],
							disposition: "required",
							id: "idle",
							kind: "state",
							name: "Idle",
						},
						{
							assetRecordIds: ["rec-2"],
							disposition: "required",
							id: "walk",
							kind: "animation",
							name: "Walk",
						},
					],
					revisionId: "rs-1",
					revisionNumber: 1,
				},
				selections: [
					{ assetVersionIds: ["av-1"], itemId: "idle" },
					{ assetVersionIds: ["av-2"], itemId: "walk" },
				],
			},
		],
		quality: [],
		rights: [
			{
				assetRecordId: "rec-1",
				rightsRecordId: "rr-1",
				state: "documented",
				versionNumber: 1,
			},
		],
		unitVersions: [],
		...overrides,
	};
}

const timestampPattern = /\d{4}-\d{2}-\d{2}T/;

const options = {
	adapterVersion: null,
	deliveryTargetRevisionId: null,
	profile,
};

async function sha256(text: string) {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text)
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

test("the same exact inputs give an identical manifest and checksums", async () => {
	const first = await buildExportBundle(source(), options);
	const reordered = source();
	reordered.assetVersions.reverse();
	reordered.families[0]?.selections.reverse();
	const second = await buildExportBundle(reordered, options);

	if (!(first.ok && second.ok)) {
		throw new Error("expected both bundles to build");
	}
	expect(second.bundle.manifestText).toBe(first.bundle.manifestText);
	expect(second.bundle.checksumsText).toBe(first.bundle.checksumsText);
	expect(second.bundle.manifestDigest).toBe(first.bundle.manifestDigest);
	// An independent expectation: path-sorted "<sha256>  <path>" lines.
	expect(first.bundle.checksumsText).toBe(
		`${"c".repeat(64)}  images/hero_idle.png\n${"e".repeat(64)}  images/hero_walk.png\n${await sha256(first.bundle.manifestText)}  manifest.json\n`
	);
});

test("pins context, Required Set, profile revision and nullable references", async () => {
	const result = await buildExportBundle(source(), options);
	if (!result.ok) {
		throw new Error("expected the bundle to build");
	}
	const { manifest } = result.bundle;
	expect(manifest.context).toEqual({ revisionId: "ctx-1", revisionNumber: 4 });
	expect(manifest.profile.revisionId).toBe("r-1");
	expect(manifest.profile.contentDigest).toBe("a".repeat(64));
	expect(manifest.adapterVersion).toBeNull();
	expect(manifest.deliveryTargetRevisionId).toBeNull();
	expect(manifest.requiredSets[0]?.revisionId).toBe("rs-1");
	expect(manifest.rightsEvidence).toHaveLength(1);
	expect(
		manifest.productionEvidence.map((entry) => entry.assetVersionId)
	).toEqual(["av-1", "av-2"]);
	// No timestamps or random ids are part of hashed content.
	expect(result.bundle.manifestText).not.toMatch(timestampPattern);
});

test("a type without a specialized contract is General Asset Support without type blockers", async () => {
	const result = await buildExportBundle(source(), options);
	if (!result.ok) {
		throw new Error("expected the bundle to build");
	}
	expect(result.bundle.manifest.families[0]?.support).toBe(
		"general_asset_support"
	);
	const specialized = source();
	const [family] = specialized.families;
	if (family) {
		family.profileContractRevisionIds = ["pc-1"];
	}
	const next = await buildExportBundle(specialized, options);
	if (!next.ok) {
		throw new Error("expected the bundle to build");
	}
	expect(next.bundle.manifest.families[0]?.support).toBe("specialized");
	expect(next.bundle.manifest.families[0]?.profileContractRevisionIds).toEqual([
		"pc-1",
	]);
});

test("waivers travel with the version, rule, observed value and rationale", async () => {
	const result = await buildExportBundle(
		source({
			quality: [
				{
					assetFamilyId: "fam-1",
					assetVersionIds: ["av-1"],
					evidenceId: "ev-1",
					itemId: "idle",
					kind: "quality",
					observedValue: "12 colors",
					rationale: "Accepted for retro look",
					recordedAt: "2026-11-01T10:00:00.000Z",
					recordedByUserId: "user-1",
					result: "waived",
					ruleClass: "waivable_requirement",
					ruleId: "palette.max_colors",
					versionTarget: { id: "uv-1", kind: "unit" },
				},
			],
		}),
		options
	);
	if (!result.ok) {
		throw new Error("expected the bundle to build");
	}
	expect(result.bundle.manifest.qualityEvidence).toHaveLength(1);
	expect(result.bundle.manifest.waivers).toEqual([
		{
			assetVersionIds: ["av-1"],
			evidenceId: "ev-1",
			itemId: "idle",
			observedValue: "12 colors",
			rationale: "Accepted for retro look",
			recordedAt: "2026-11-01T10:00:00.000Z",
			recordedByUserId: "user-1",
			ruleClass: "waivable_requirement",
			ruleId: "palette.max_colors",
			versionTarget: { id: "uv-1", kind: "unit" },
		},
	]);
});

test("refuses to build while a Required Set item is not ready or a file has no digest", async () => {
	const blocked = await buildExportBundle(
		source({
			blockers: [
				{ assetFamilyId: "fam-1", codes: ["quality"], itemId: "walk" },
			],
		}),
		options
	);
	expect(blocked).toEqual({
		blockers: [{ assetFamilyId: "fam-1", codes: ["quality"], itemId: "walk" }],
		ok: false,
		reason: "not_ready",
	});

	const noDigest = source();
	const [version] = noDigest.assetVersions;
	if (version) {
		version.sha256 = null;
	}
	expect(await buildExportBundle(noDigest, options)).toEqual({
		assetVersionIds: ["av-1"],
		ok: false,
		reason: "asset_digest_missing",
	});
});

test("refuses colliding paths and unknown naming placeholders", async () => {
	const collision = await buildExportBundle(source(), {
		...options,
		profile: {
			...profile,
			definition: { ...profile.definition, namingTemplate: "{family}" },
		},
	});
	expect(collision).toEqual({
		ok: false,
		paths: ["images/hero.png"],
		reason: "path_collision",
	});

	const unknown = await buildExportBundle(source(), {
		...options,
		profile: {
			...profile,
			definition: { ...profile.definition, namingTemplate: "{nope}" },
		},
	});
	expect(unknown).toEqual({
		ok: false,
		placeholder: "nope",
		reason: "unknown_naming_placeholder",
	});
});

test("a changed profile revision changes the manifest digest", async () => {
	const first = await buildExportBundle(source(), options);
	const second = await buildExportBundle(source(), {
		...options,
		profile: { ...profile, contentDigest: "f".repeat(64), revisionId: "r-2" },
	});
	if (!(first.ok && second.ok)) {
		throw new Error("expected both bundles to build");
	}
	expect(second.bundle.manifestDigest).not.toBe(first.bundle.manifestDigest);
});

test("the integrity check passes a built bundle and rejects a corrupted one the same way", async () => {
	const result = await buildExportBundle(source(), options);
	if (!result.ok) {
		throw new Error("expected the bundle to build");
	}
	const { files } = result.bundle;
	expect(await checkExportBundleFiles(files)).toBeNull();

	const corruptedChecksums = files.map((file) =>
		file.path === "checksums.txt" ? { ...file, content: "x\n" } : file
	);
	expect(await checkExportBundleFiles(corruptedChecksums)).toBe(
		"checksums.txt does not match its recorded checksum."
	);

	const corruptedFile = files.map((file) =>
		file.path === "images/hero_idle.png"
			? { ...file, sha256: "0".repeat(64) }
			: file
	);
	expect(await checkExportBundleFiles(corruptedFile)).toBe(
		"The file images/hero_idle.png does not match the manifest."
	);

	expect(
		await checkExportBundleFiles(
			files.filter((file) => file.path !== "images/hero_walk.png")
		)
	).toBe("The file images/hero_walk.png is missing.");

	const unknownMajor = JSON.stringify({
		...result.bundle.manifest,
		contractVersion: "2.0.0",
	});
	const unknownMajorSha = await sha256(unknownMajor);
	expect(
		await checkExportBundleFiles(
			files.map((file) =>
				file.path === "manifest.json"
					? { ...file, content: unknownMajor, sha256: unknownMajorSha }
					: file
			)
		)
	).toBe("The manifest contract version is not supported.");
});
