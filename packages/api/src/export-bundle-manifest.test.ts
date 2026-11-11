import { expect, test } from "bun:test";
import {
	buildExportBundle,
	type ExportBundleProfilePin,
	type ExportBundleSource,
	exportBundleHasEngineData,
	exportBundleManifestSchema,
} from "./export-bundle-manifest";
import { exportBundleVerifierSource } from "./export-bundle-verifier-source";

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

test("the manifest pins every kit file except the checksum list by digest", async () => {
	const result = await buildExportBundle(source(), options);
	if (!result.ok) {
		throw new Error("expected the bundle to build");
	}
	const { kitFiles } = result.bundle.manifest;
	expect(kitFiles.map((file) => file.path)).toEqual([
		"verification-kit/README.md",
		"verification-kit/examples/file-mapping.example.json",
		"verification-kit/schema/manifest.schema.json",
		"verification-kit/verify.ts",
	]);
	const verify = kitFiles.find(
		(file) => file.path === "verification-kit/verify.ts"
	);
	expect(verify?.sha256).toBe(await sha256(exportBundleVerifierSource));
});

const animation = {
	assetFamilyId: "fam-1",
	directions: [
		{
			direction: "south",
			frames: [
				{
					assetVersionId: "av-2",
					durationMs: 120,
					events: [{ id: "footstep", timeMs: 40 }],
					frameKey: "walk_01",
					pivot: { x: 8, y: 15 },
					region: { height: 16, width: 16, x: 16, y: 0 },
				},
				{
					assetVersionId: "av-2",
					durationMs: 80,
					events: [],
					frameKey: "walk_00",
					pivot: null,
					region: null,
				},
			],
		},
	],
	looping: true,
	name: "walk",
	playbackSpeed: 1,
};

test("a bundle pins engine data and writes contract 1.1.0 deterministically", async () => {
	const engineData = {
		animations: [animation],
		tilesets: [],
		uiComponents: [],
	};
	const first = await buildExportBundle(source({ engineData }), options);
	const second = await buildExportBundle(source({ engineData }), options);
	if (!(first.ok && second.ok)) {
		throw new Error("expected both bundles to build");
	}
	expect(first.bundle.manifest.contractVersion).toBe("1.1.0");
	expect(first.bundle.manifest.engineData?.animations[0]?.name).toBe("walk");
	expect(first.bundle.manifestText).toBe(second.bundle.manifestText);
});

test("a bundle without engine data pins empty lists, and a 1.0.0 manifest without the section still parses", async () => {
	const result = await buildExportBundle(source(), options);
	if (!result.ok) {
		throw new Error("expected the bundle to build");
	}
	expect(result.bundle.manifest.engineData).toEqual({
		animations: [],
		tilesets: [],
		uiComponents: [],
	});
	const { engineData: _omitted, ...legacy } = result.bundle.manifest;
	expect(
		exportBundleManifestSchema.safeParse({
			...legacy,
			contractVersion: "1.0.0",
		}).success
	).toBe(true);
});

test("only manifest contracts from 1.1.0 pin engine data", () => {
	expect(exportBundleHasEngineData("1.0.0")).toBe(false);
	expect(exportBundleHasEngineData("1.0.9")).toBe(false);
	expect(exportBundleHasEngineData("1.1.0")).toBe(true);
	expect(exportBundleHasEngineData("1.2.0")).toBe(true);
	expect(exportBundleHasEngineData("2.0.0")).toBe(true);
	expect(exportBundleHasEngineData("0.9.0")).toBe(false);
});
