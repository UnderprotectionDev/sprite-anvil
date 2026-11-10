/**
 * Test fixture: a small but complete Engine-Neutral Bundle directory with its
 * Package Verification Kit, built through the real manifest contract. Shared
 * by the unit tests and the end-to-end specs; never imported by product code.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	buildExportBundle,
	type ExportBundleProfilePin,
	type ExportBundleSource,
	exportBundleSha256,
} from "./export-bundle-manifest";
import {
	type ExportBundleVerificationFile,
	sha256Hex,
} from "./export-bundle-verification";
import { buildExportBundleVerificationKit } from "./export-bundle-verification-kit";

const encoder = new TextEncoder();

export const fixtureProfile: ExportBundleProfilePin = {
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

export const fixtureAssetBytes = {
	"av-1": Uint8Array.from([137, 80, 78, 71, 1, 2, 3]),
	"av-2": Uint8Array.from([137, 80, 78, 71, 9, 8, 7, 6]),
} as const;

const bytesDigest = sha256Hex;

export async function fixtureSource(): Promise<ExportBundleSource> {
	return {
		assetVersions: [
			{
				assetFamilyId: "fam-1",
				assetRecordId: "rec-1",
				byteSize: fixtureAssetBytes["av-1"].length,
				contentType: "image/png",
				id: "av-1",
				productionEvidenceDigest: "b".repeat(64),
				providerGenerationRecordId: null,
				sha256: await bytesDigest(fixtureAssetBytes["av-1"]),
				versionNumber: 3,
			},
			{
				assetFamilyId: "fam-1",
				assetRecordId: "rec-2",
				byteSize: fixtureAssetBytes["av-2"].length,
				contentType: "image/png",
				id: "av-2",
				productionEvidenceDigest: "d".repeat(64),
				providerGenerationRecordId: "gen-1",
				sha256: await bytesDigest(fixtureAssetBytes["av-2"]),
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
	};
}

/** The verifier module's own text, as the kit ships it. */
export function verifierSource(): string {
	return readFileSync(
		join(import.meta.dirname, "export-bundle-verification.ts"),
		"utf8"
	);
}

/** Every file of the bundle directory, kit included, as bytes. */
export async function buildFixtureBundleFiles(): Promise<
	ExportBundleVerificationFile[]
> {
	const result = await buildExportBundle(await fixtureSource(), {
		adapterVersion: null,
		deliveryTargetRevisionId: null,
		profile: fixtureProfile,
	});
	if (!result.ok) {
		throw new Error("The fixture bundle must build.");
	}
	const { bundle } = result;
	const kit = buildExportBundleVerificationKit({
		checksumsText: bundle.checksumsText,
		manifest: bundle.manifest,
		verifierSource: verifierSource(),
	});
	const assets = bundle.files
		.filter((file) => file.assetVersionId !== null)
		.map((file) => ({
			bytes: fixtureAssetBytes[file.assetVersionId as "av-1" | "av-2"],
			path: file.path,
		}));
	return [
		...assets,
		{ bytes: encoder.encode(bundle.manifestText), path: "manifest.json" },
		{ bytes: encoder.encode(bundle.checksumsText), path: "checksums.txt" },
		...kit.map((file) => ({
			bytes: encoder.encode(file.content),
			path: file.path,
		})),
	];
}

/**
 * Rewrites `manifest.json` and keeps every list that records its digest
 * consistent, so a test can change one contract fact and nothing else.
 */
export async function withManifest(
	files: ExportBundleVerificationFile[],
	change: (manifest: Record<string, unknown>) => void
): Promise<ExportBundleVerificationFile[]> {
	const manifestFile = files.find((file) => file.path === "manifest.json");
	const checksumsFile = files.find((file) => file.path === "checksums.txt");
	if (!(manifestFile && checksumsFile)) {
		throw new Error("The fixture needs a manifest and a checksum list.");
	}
	const manifest = JSON.parse(new TextDecoder().decode(manifestFile.bytes));
	change(manifest);
	const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
	const manifestDigest = await exportBundleSha256(manifestText);
	const checksumsText = new TextDecoder()
		.decode(checksumsFile.bytes)
		.split("\n")
		.map((line) =>
			line.endsWith("  manifest.json")
				? `${manifestDigest}  manifest.json`
				: line
		)
		.join("\n");
	return files.map((file) => {
		if (file.path === "manifest.json") {
			return { ...file, bytes: encoder.encode(manifestText) };
		}
		if (file.path === "checksums.txt" || file.path.endsWith("/checksums.txt")) {
			return { ...file, bytes: encoder.encode(checksumsText) };
		}
		return file;
	});
}

export function replaceFile(
	files: ExportBundleVerificationFile[],
	path: string,
	content: string | Uint8Array
): ExportBundleVerificationFile[] {
	const bytes = typeof content === "string" ? encoder.encode(content) : content;
	return files.map((file) => (file.path === path ? { ...file, bytes } : file));
}

export function writeBundleDirectory(
	files: ExportBundleVerificationFile[],
	directory: string
): void {
	for (const file of files) {
		const target = join(directory, file.path);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, file.bytes);
	}
}
