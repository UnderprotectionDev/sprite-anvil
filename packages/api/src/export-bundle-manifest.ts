/**
 * The Engine-Neutral Bundle manifest and checksum contract.
 *
 * Pure on purpose: no store, database or server import, so the Workbench and
 * the offline Package Verification Kit verifier can share it. Nothing hashed
 * here carries a generation time or a random id; the same exact inputs and
 * profile revision give the same manifest and checksums.
 */
import { z } from "zod";
import { buildExportBundleKitContent } from "./export-bundle-verification-kit";
import { exportBundleVerifierSource } from "./export-bundle-verifier-source";
import type { ExportProfileDefinition } from "./export-profiles";
import { recordContentDigest } from "./record-content-digest";

export const exportBundleManifestFormat = "sprite-anvil.export-bundle";
/** The Bundle Manifest contract version this build writes; its major gates reading. */
export const exportBundleManifestContractVersion = "1.0.0";
export const supportedExportBundleManifestMajor = 1;
/** The data-structure contract version the manifest pins for its fields. */
export const exportBundleDataStructureVersion = "1.0.0";

export const exportBundleManifestPath = "manifest.json";
export const exportBundleChecksumsPath = "checksums.txt";

export const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const idSchema = z.string().min(1);
const versionTargetSchema = z
	.object({ id: idSchema, kind: z.enum(["unit", "composite"]) })
	.strict();

export const exportBundleManifestSchema = z
	.object({
		adapterVersion: z.string().min(1).nullable(),
		compositeVersions: z.array(
			z
				.object({
					assetRecordId: idSchema,
					id: idSchema,
					memberUnitVersionIds: z.array(idSchema),
					versionNumber: z.number().int().positive(),
				})
				.strict()
		),
		context: z
			.object({
				revisionId: idSchema,
				revisionNumber: z.number().int().nonnegative(),
			})
			.strict(),
		contractVersion: versionSchema,
		dataStructureVersion: versionSchema,
		deliveryTargetRevisionId: idSchema.nullable(),
		engineNeutral: z.literal(true),
		families: z.array(
			z
				.object({
					assetFamilyId: idSchema,
					assetFamilyName: z.string(),
					profileContractRevisionIds: z.array(idSchema),
					support: z.enum(["general_asset_support", "specialized"]),
				})
				.strict()
		),
		files: z.array(
			z
				.object({
					assetFamilyId: idSchema,
					assetRecordId: idSchema,
					assetVersionId: idSchema,
					byteSize: z.number().int().positive(),
					contentType: z.string(),
					itemId: idSchema,
					path: z.string().min(1),
					sha256: sha256Schema,
				})
				.strict()
		),
		format: z.literal(exportBundleManifestFormat),
		kitFiles: z.array(
			z.object({ path: z.string().min(1), sha256: sha256Schema }).strict()
		),
		productionEvidence: z.array(
			z
				.object({
					assetVersionId: idSchema,
					evidenceDigest: sha256Schema,
					providerGenerationRecordId: idSchema.nullable(),
				})
				.strict()
		),
		profile: z
			.object({
				contentDigest: sha256Schema,
				contractVersion: versionSchema,
				definition: z.record(z.string(), z.unknown()),
				profileId: idSchema,
				revisionId: idSchema,
				revisionNumber: z.number().int().positive(),
			})
			.strict(),
		qualityEvidence: z.array(
			z
				.object({
					assetFamilyId: idSchema,
					assetVersionIds: z.array(idSchema),
					evidenceId: idSchema,
					itemId: idSchema,
					kind: z.string(),
					observedValue: z.string().nullable(),
					result: z.string(),
					ruleClass: z.string().nullable(),
					ruleId: z.string().nullable(),
					versionTarget: versionTargetSchema.nullable(),
				})
				.strict()
		),
		requiredSets: z.array(
			z
				.object({
					assetFamilyId: idSchema,
					items: z.array(
						z
							.object({
								assetRecordIds: z.array(idSchema),
								disposition: z.string(),
								id: idSchema,
								kind: z.string(),
								name: z.string(),
								testId: z.string().nullable(),
							})
							.strict()
					),
					revisionId: idSchema,
					revisionNumber: z.number().int().positive(),
				})
				.strict()
		),
		rightsEvidence: z.array(
			z
				.object({
					assetRecordId: idSchema,
					rightsRecordId: idSchema,
					state: z.string(),
					versionNumber: z.number().int().positive(),
				})
				.strict()
		),
		unitVersions: z.array(
			z
				.object({
					assetRecordId: idSchema,
					assetVersionId: idSchema,
					id: idSchema,
					unitKey: z.string(),
					unitType: z.string(),
					versionNumber: z.number().int().positive(),
				})
				.strict()
		),
		waivers: z.array(
			z
				.object({
					assetVersionIds: z.array(idSchema),
					evidenceId: idSchema,
					itemId: idSchema,
					observedValue: z.string().nullable(),
					rationale: z.string(),
					ruleClass: z.string().nullable(),
					ruleId: z.string().nullable(),
					versionTarget: versionTargetSchema.nullable(),
				})
				.strict()
		),
	})
	.strict();
export type ExportBundleManifest = z.infer<typeof exportBundleManifestSchema>;

/** The exact profile revision a bundle is built with. */
export interface ExportBundleProfilePin {
	contentDigest: string;
	contractVersion: string;
	definition: ExportProfileDefinition;
	profileId: string;
	revisionId: string;
	revisionNumber: number;
}

export interface ExportBundleSourceAssetVersion {
	assetFamilyId: string;
	assetRecordId: string;
	byteSize: number;
	contentType: string;
	id: string;
	/** Digest of the version's production evidence, so the manifest pins it without copying it. */
	productionEvidenceDigest: string;
	providerGenerationRecordId: string | null;
	/** SHA-256 of the file bytes; a version stored without one cannot be pinned. */
	sha256: string | null;
	versionNumber: number;
}

export interface ExportBundleSourceItem {
	assetRecordIds: string[];
	disposition: string;
	id: string;
	kind: string;
	name: string;
	testId?: string;
}

export interface ExportBundleSourceFamily {
	assetFamilyId: string;
	assetFamilyName: string;
	/** Exact specialized contract revisions the evidence used; empty for General Asset Support. */
	profileContractRevisionIds: string[];
	requiredSet: {
		items: ExportBundleSourceItem[];
		revisionId: string;
		revisionNumber: number;
	};
	/** The Asset Versions chosen for each Required Set item. */
	selections: { assetVersionIds: string[]; itemId: string }[];
}

export interface ExportBundleSourceQuality {
	assetFamilyId: string;
	assetVersionIds: string[];
	evidenceId: string;
	itemId: string;
	kind: string;
	observedValue: string | null;
	rationale: string;
	result: string;
	ruleClass: string | null;
	ruleId: string | null;
	versionTarget: { id: string; kind: "composite" | "unit" } | null;
}

/** Everything the bundle pins, resolved from the project's persisted records. */
export interface ExportBundleSource {
	assetVersions: ExportBundleSourceAssetVersion[];
	/** Required Set items that are not Context-Applicable and Export-Ready. */
	blockers: { assetFamilyId: string; codes: string[]; itemId: string }[];
	compositeVersions: {
		assetRecordId: string;
		id: string;
		memberUnitVersionIds: string[];
		versionNumber: number;
	}[];
	context: { revisionId: string; revisionNumber: number };
	families: ExportBundleSourceFamily[];
	quality: ExportBundleSourceQuality[];
	rights: {
		assetRecordId: string;
		rightsRecordId: string;
		state: string;
		versionNumber: number;
	}[];
	unitVersions: {
		assetRecordId: string;
		assetVersionId: string;
		id: string;
		unitKey: string;
		unitType: string;
		versionNumber: number;
	}[];
}

export interface ExportBundleBuildOptions {
	/** Verified Engine Adapter version, when one applies. */
	adapterVersion: string | null;
	/** Delivery Target revision the bundle fulfils, when it is started for one. */
	deliveryTargetRevisionId: string | null;
	profile: ExportBundleProfilePin;
}

export interface ExportBundleFile {
	/** Generated text content; absent for an asset file read from storage by `assetVersionId`. */
	assetVersionId: string | null;
	byteSize: number;
	content: string | null;
	path: string;
	sha256: string;
}

export interface BuiltExportBundle {
	checksumsText: string;
	/** Every file of the bundle directory, path-sorted, including manifest and checksums. */
	files: ExportBundleFile[];
	manifest: ExportBundleManifest;
	manifestDigest: string;
	manifestText: string;
}

export type ExportBundleBuildResult =
	| { bundle: BuiltExportBundle; ok: true }
	| { assetVersionIds: string[]; ok: false; reason: "asset_digest_missing" }
	| { blockers: ExportBundleSource["blockers"]; ok: false; reason: "not_ready" }
	| { ok: false; paths: string[]; reason: "path_collision" }
	| { ok: false; placeholder: string; reason: "unknown_naming_placeholder" }
	| { ok: false; reason: "selection_unavailable"; assetVersionIds: string[] };

const namingPlaceholders = ["family", "item", "version"] as const;
const placeholderPattern = /\{([^{}]*)\}/g;

/** The major number of a `major.minor.patch` contract version. */
export function exportBundleContractMajorOf(version: string): number {
	return Number(version.split(".")[0]);
}

function compare(left: string, right: string): number {
	return Number(left > right) - Number(left < right);
}

function sortBy<T>(items: T[], key: (item: T) => string): T[] {
	return [...items].sort((left, right) => compare(key(left), key(right)));
}

function slug(value: string): string {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "item"
	);
}

/** SHA-256 (hex) of UTF-8 text. */
export async function exportBundleSha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(text)
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

/** The checksum list text: one `<sha256>  <path>` line per file, sorted by path. */
export function renderExportBundleChecksums(
	files: { path: string; sha256: string }[]
): string {
	return sortBy(files, (file) => file.path)
		.map((file) => `${file.sha256}  ${file.path}\n`)
		.join("");
}

/** Canonical manifest text: sorted keys, two-space indent, newline-terminated. */
export function renderExportBundleManifest(
	manifest: ExportBundleManifest
): string {
	return `${JSON.stringify(sortKeys(manifest), null, 2)}\n`;
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, member]) => member !== undefined)
				.sort(([left], [right]) => compare(left, right))
				.map(([key, member]) => [key, sortKeys(member)])
		);
	}
	return value;
}

function extensionOf(contentType: string): string {
	return contentType === "image/webp" ? "webp" : "png";
}

type ManifestFile = ExportBundleManifest["files"][number];

type ExportBundleFailure = Exclude<ExportBundleBuildResult, { ok: true }>;

function unknownPlaceholder(template: string): string | null {
	for (const match of template.matchAll(placeholderPattern)) {
		const name = match[1] ?? "";
		if (!(namingPlaceholders as readonly string[]).includes(name)) {
			return name;
		}
	}
	return null;
}

/** One manifest file per selected Asset Version, or the failure that stops the bundle. */
function collectFiles(
	source: ExportBundleSource,
	template: string
): ManifestFile[] | ExportBundleFailure {
	const versions = new Map(source.assetVersions.map((v) => [v.id, v]));
	const missing = new Set<string>();
	const unavailable = new Set<string>();
	const files: ManifestFile[] = [];
	for (const family of source.families) {
		const itemsById = new Map(
			family.requiredSet.items.map((item) => [item.id, item])
		);
		for (const selection of family.selections) {
			const item = itemsById.get(selection.itemId);
			for (const versionId of selection.assetVersionIds) {
				const version = versions.get(versionId);
				if (!(item && version)) {
					unavailable.add(versionId);
				} else if (version.sha256) {
					const values = {
						family: family.assetFamilyName,
						item: item.name,
						version: String(version.versionNumber),
					};
					const rendered = template.replace(placeholderPattern, (_, name) =>
						slug(values[name as keyof typeof values])
					);
					files.push({
						assetFamilyId: family.assetFamilyId,
						assetRecordId: version.assetRecordId,
						assetVersionId: version.id,
						byteSize: version.byteSize,
						contentType: version.contentType,
						itemId: item.id,
						path: `images/${rendered}.${extensionOf(version.contentType)}`,
						sha256: version.sha256,
					});
				} else {
					missing.add(version.id);
				}
			}
		}
	}
	if (unavailable.size > 0) {
		return {
			assetVersionIds: [...unavailable].sort(compare),
			ok: false,
			reason: "selection_unavailable",
		};
	}
	if (missing.size > 0) {
		return {
			assetVersionIds: [...missing].sort(compare),
			ok: false,
			reason: "asset_digest_missing",
		};
	}
	return files;
}

/**
 * Pins the source into a deterministic bundle: manifest text, checksum list
 * and the path of every file. It does not read or copy file bytes; asset files
 * are referenced by Asset Version and verified by SHA-256.
 */
export async function buildExportBundle(
	source: ExportBundleSource,
	options: ExportBundleBuildOptions
): Promise<ExportBundleBuildResult> {
	if (source.blockers.length > 0) {
		return {
			blockers: sortBy(
				source.blockers,
				(blocker) => `${blocker.assetFamilyId}/${blocker.itemId}`
			),
			ok: false,
			reason: "not_ready",
		};
	}

	const families = sortBy(source.families, (family) => family.assetFamilyId);
	const template = options.profile.definition.namingTemplate;
	const placeholder = unknownPlaceholder(template);
	if (placeholder !== null) {
		return { ok: false, placeholder, reason: "unknown_naming_placeholder" };
	}
	const files = collectFiles(source, template);
	if (!Array.isArray(files)) {
		return files;
	}

	const sortedFiles = sortBy(files, (file) => file.path);
	const seen = new Set<string>();
	const collisions = new Set<string>();
	for (const file of sortedFiles) {
		const key = file.path.toLowerCase();
		if (seen.has(key)) {
			collisions.add(file.path);
		}
		seen.add(key);
	}
	if (collisions.size > 0) {
		return { ok: false, paths: [...collisions], reason: "path_collision" };
	}

	const pinnedVersionIds = new Set(
		sortedFiles.map((file) => file.assetVersionId)
	);
	const pinnedRecordIds = new Set(
		sortedFiles.map((file) => file.assetRecordId)
	);
	const quality = sortBy(source.quality, (entry) => entry.evidenceId);
	const versionTarget = (entry: ExportBundleSourceQuality) =>
		entry.versionTarget ? { ...entry.versionTarget } : null;

	const kitFiles = sortBy(
		await Promise.all(
			buildExportBundleKitContent({
				contractVersion: exportBundleManifestContractVersion,
				profileContractVersion: options.profile.contractVersion,
				verifierSource: exportBundleVerifierSource,
			}).map(async (file) => ({
				path: file.path,
				sha256: await exportBundleSha256(file.content),
			}))
		),
		(file) => file.path
	);

	const manifest: ExportBundleManifest = {
		adapterVersion: options.adapterVersion,
		compositeVersions: sortBy(
			source.compositeVersions,
			(composite) => composite.id
		).map((composite) => ({
			...composite,
			memberUnitVersionIds: [...composite.memberUnitVersionIds].sort(compare),
		})),
		context: { ...source.context },
		contractVersion: exportBundleManifestContractVersion,
		dataStructureVersion: exportBundleDataStructureVersion,
		deliveryTargetRevisionId: options.deliveryTargetRevisionId,
		engineNeutral: true,
		families: families.map((family) => ({
			assetFamilyId: family.assetFamilyId,
			assetFamilyName: family.assetFamilyName,
			profileContractRevisionIds: [...family.profileContractRevisionIds].sort(
				compare
			),
			support:
				family.profileContractRevisionIds.length === 0
					? "general_asset_support"
					: "specialized",
		})),
		files: sortedFiles,
		format: exportBundleManifestFormat,
		kitFiles,
		productionEvidence: sortBy(
			source.assetVersions.filter((version) =>
				pinnedVersionIds.has(version.id)
			),
			(version) => version.id
		).map((version) => ({
			assetVersionId: version.id,
			evidenceDigest: version.productionEvidenceDigest,
			providerGenerationRecordId: version.providerGenerationRecordId,
		})),
		profile: {
			contentDigest: options.profile.contentDigest,
			contractVersion: options.profile.contractVersion,
			definition: options.profile.definition,
			profileId: options.profile.profileId,
			revisionId: options.profile.revisionId,
			revisionNumber: options.profile.revisionNumber,
		},
		qualityEvidence: quality.map((entry) => ({
			assetFamilyId: entry.assetFamilyId,
			assetVersionIds: [...entry.assetVersionIds].sort(compare),
			evidenceId: entry.evidenceId,
			itemId: entry.itemId,
			kind: entry.kind,
			observedValue: entry.observedValue,
			result: entry.result,
			ruleClass: entry.ruleClass,
			ruleId: entry.ruleId,
			versionTarget: versionTarget(entry),
		})),
		requiredSets: families.map((family) => ({
			assetFamilyId: family.assetFamilyId,
			items: family.requiredSet.items.map((item) => ({
				assetRecordIds: [...item.assetRecordIds].sort(compare),
				disposition: item.disposition,
				id: item.id,
				kind: item.kind,
				name: item.name,
				testId: item.testId ?? null,
			})),
			revisionId: family.requiredSet.revisionId,
			revisionNumber: family.requiredSet.revisionNumber,
		})),
		rightsEvidence: sortBy(
			source.rights.filter((entry) => pinnedRecordIds.has(entry.assetRecordId)),
			(entry) => entry.rightsRecordId
		),
		unitVersions: sortBy(source.unitVersions, (unit) => unit.id),
		waivers: quality
			.filter((entry) => entry.result === "waived")
			.map((entry) => ({
				assetVersionIds: [...entry.assetVersionIds].sort(compare),
				evidenceId: entry.evidenceId,
				itemId: entry.itemId,
				observedValue: entry.observedValue,
				rationale: entry.rationale,
				ruleClass: entry.ruleClass,
				ruleId: entry.ruleId,
				versionTarget: versionTarget(entry),
			})),
	};

	const manifestText = renderExportBundleManifest(manifest);
	const manifestDigest = await exportBundleSha256(manifestText);
	const checksumsText = renderExportBundleChecksums([
		...sortedFiles,
		{ path: exportBundleManifestPath, sha256: manifestDigest },
	]);
	const encoder = new TextEncoder();
	const generated: ExportBundleFile[] = [
		{
			assetVersionId: null,
			byteSize: encoder.encode(checksumsText).length,
			content: checksumsText,
			path: exportBundleChecksumsPath,
			sha256: await exportBundleSha256(checksumsText),
		},
		{
			assetVersionId: null,
			byteSize: encoder.encode(manifestText).length,
			content: manifestText,
			path: exportBundleManifestPath,
			sha256: manifestDigest,
		},
	];
	return {
		bundle: {
			checksumsText,
			files: sortBy(
				[
					...sortedFiles.map(
						(file): ExportBundleFile => ({
							assetVersionId: file.assetVersionId,
							byteSize: file.byteSize,
							content: null,
							path: file.path,
							sha256: file.sha256,
						})
					),
					...generated,
				],
				(file) => file.path
			),
			manifest,
			manifestDigest,
			manifestText,
		},
		ok: true,
	};
}

/** Digest of what a create request asked for, so a repeated key with other content is a conflict. */
export function exportBundleRequestDigest(request: {
	adapterVersion: string | null;
	assetFamilyIds: string[];
	deliveryTargetRevisionId: string | null;
	profileRevisionId: string;
}): Promise<string> {
	return recordContentDigest({
		adapterVersion: request.adapterVersion,
		assetFamilyIds: [...request.assetFamilyIds].sort(compare),
		deliveryTargetRevisionId: request.deliveryTargetRevisionId,
		profileRevisionId: request.profileRevisionId,
	});
}
