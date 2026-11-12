import { z } from "zod";
import {
	referenceFeatureSchema,
	referenceRoleSchema,
} from "./asset-record-tracking";
import {
	assetRecordAvailabilityValues,
	assetRecordCategorySchema,
	assetRecordIdentityCriteriaSchema,
	assetRecordMeasurementsSchema,
	assetRecordSupportLevels,
	assetRecordTagsSchema,
} from "./asset-records";
import {
	type DeliveryRecords,
	deliveryGroup,
	deliveryRelationFailures,
	deliverySectionSchemas,
} from "./project-archive-delivery";
import {
	type HistoryRecords,
	historyGroup,
	historyRelationFailures,
	historySectionSchemas,
} from "./project-archive-history";
import { recordContentDigest } from "./record-content-digest";
import { idempotencyKeySchema } from "./record-publication";

/** The portable file format of a Project Archive; a later record group adds sections, never reshapes these. */
export const projectArchiveSchemaVersion = "project-archive/1.0.0";

const idSchema = z.string().trim().min(1).max(128);
const uuidSchema = z.uuid();
const timestampSchema = z.iso.datetime();
export const archiveSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

// ---------------------------------------------------------------------------
// Foundation record group
// ---------------------------------------------------------------------------

const unitTypeSchema = z.enum(["frame", "direction", "tile", "state"]);

export const foundationSectionSchemas = {
	assetFamilies: z
		.object({
			createdAt: timestampSchema,
			id: idSchema,
			name: z.string(),
			subjectIdentityId: idSchema,
			useContext: z.string(),
			visualWorldId: idSchema,
		})
		.strict(),
	assetRecords: z
		.object({
			assetCategory: assetRecordCategorySchema.nullable().optional(),
			assetFamilyId: idSchema,
			availability: z.enum(assetRecordAvailabilityValues),
			createdAt: timestampSchema,
			id: idSchema,
			identityCriteria: z.array(assetRecordIdentityCriteriaSchema),
			measurements: assetRecordMeasurementsSchema,
			name: z.string(),
			supportLevel: z.enum(assetRecordSupportLevels),
			tags: assetRecordTagsSchema.optional(),
			themeId: idSchema.nullable().optional(),
			visualWorldId: idSchema.nullable().optional(),
		})
		.strict(),
	assetVersions: z
		.object({
			assetFamilyId: idSchema,
			assetRecordId: idSchema,
			byteSize: z.number().int().positive(),
			contentDigest: archiveSha256Schema.nullable(),
			contentType: z.enum(["image/png", "image/webp"]),
			createdAt: timestampSchema,
			id: idSchema,
			integrityVerified: z.boolean(),
			productionSource: z.string(),
			sourceImageDimensions: z
				.object({
					height: z.number().int().positive(),
					width: z.number().int().positive(),
				})
				.strict()
				.nullable(),
			sourceKind: z.string(),
			versionNumber: z.number().int().positive(),
		})
		.strict(),
	canonicalDesigns: z
		.object({
			assetFamilyId: idSchema,
			assetRecordId: idSchema,
			assetVersionId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
		})
		.strict(),
	compositeVersions: z
		.object({
			assetRecordId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
			versionNumber: z.number().int().positive(),
		})
		.strict(),
	compositionMemberships: z
		.object({
			assetRecordId: idSchema,
			compositeVersionId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
			unitKey: z.string(),
			unitType: unitTypeSchema,
			unitVersionId: idSchema,
		})
		.strict(),
	contextRevisions: z
		.object({
			contractVersion: z.string(),
			createdAt: timestampSchema,
			id: idSchema,
			revisionNumber: z.number().int().positive(),
			rules: z.array(z.unknown()),
			sourceProposalId: idSchema.nullable(),
			state: z.enum(["baseline", "active", "inactive"]),
		})
		.strict(),
	referenceHistory: z
		.object({
			assetRecordId: idSchema,
			contextOverrideRationale: z.string().nullable(),
			customPurpose: z.string().nullable(),
			forbiddenFeatures: z.array(referenceFeatureSchema),
			id: idSchema,
			notes: z.string().nullable(),
			recordedAt: timestampSchema,
			referenceId: idSchema,
			revision: z.number().int().positive(),
			role: referenceRoleSchema,
			transferredFeatures: z.array(referenceFeatureSchema),
		})
		.strict(),
	references: z
		.object({
			assetRecordId: idSchema,
			contextOverrideRationale: z.string().nullable(),
			createdAt: timestampSchema,
			customPurpose: z.string().nullable(),
			forbiddenFeatures: z.array(referenceFeatureSchema),
			id: idSchema,
			notes: z.string().nullable(),
			revision: z.number().int().positive(),
			role: referenceRoleSchema,
			targetVersionId: idSchema,
			transferredFeatures: z.array(referenceFeatureSchema),
			updatedAt: timestampSchema,
		})
		.strict(),
	relationships: z
		.object({
			assetFamilyId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
			sourceAssetRecordId: idSchema,
			sourceAssetVersionId: idSchema.nullable(),
			targetAssetRecordId: idSchema,
			type: z.enum(["direction", "animation", "state", "derivative"]),
		})
		.strict(),
	subjectIdentities: z
		.object({ createdAt: timestampSchema, id: idSchema, name: z.string() })
		.strict(),
	unitVersions: z
		.object({
			assetRecordId: idSchema,
			assetVersionId: idSchema,
			createdAt: timestampSchema,
			id: idSchema,
			sourceAssetVersionId: idSchema,
			unitKey: z.string(),
			unitType: unitTypeSchema,
			versionNumber: z.number().int().positive(),
		})
		.strict(),
} as const;

export type FoundationSectionName = keyof typeof foundationSectionSchemas;
export type FoundationRecords = {
	[Name in FoundationSectionName]: z.infer<
		(typeof foundationSectionSchemas)[Name]
	>[];
};

/**
 * Every record group the archive format knows, with the schema of each of its
 * sections. A later ticket registers its group here; a section outside this
 * registry is an unknown record group and fails verification.
 */
export const projectArchiveSectionRegistry: Record<
	string,
	Record<string, z.ZodType>
> = {
	foundation: foundationSectionSchemas,
	[historyGroup]: historySectionSchemas,
	[deliveryGroup]: deliverySectionSchemas,
};

export const foundationGroup = "foundation";

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/** Kinds of file an archive accounts for. A later record group adds its own kinds. */
export const projectArchiveFileKinds = [
	"asset_version_file",
	"rights_evidence_file",
	"runtime_evidence_file",
	"working_file",
] as const;

export const projectArchiveFileEntrySchema = z
	.object({
		assetRecordId: idSchema.nullable(),
		assetVersionId: idSchema.nullable(),
		byteSize: z.number().int().positive(),
		contentType: z.string().nullable(),
		/** Why an excluded file is absent; null for an included file. */
		exclusionReason: z
			.enum(["evidence_not_archived", "not_selected"])
			.nullable(),
		fileName: z.string().nullable(),
		kind: z.enum(projectArchiveFileKinds),
		/** Included: the archive holds the file. Excluded: only identity, digest and size are kept. */
		presence: z.enum(["included", "excluded"]),
		sha256: archiveSha256Schema,
		sourceId: idSchema,
	})
	.strict();
export type ProjectArchiveFileEntry = z.infer<
	typeof projectArchiveFileEntrySchema
>;

// ---------------------------------------------------------------------------
// Manifest and archive
// ---------------------------------------------------------------------------

export const projectArchiveContentSchema = z
	.object({
		digest: archiveSha256Schema,
		group: z.string().min(1),
		name: z.string().min(1),
		recordCount: z.number().int().nonnegative(),
	})
	.strict();

export const projectArchiveManifestSchema = z
	.object({
		contents: z.array(projectArchiveContentSchema),
		files: z.array(projectArchiveFileEntrySchema),
		schemaVersion: z.literal(projectArchiveSchemaVersion),
		source: z.object({ projectId: idSchema }).strict(),
	})
	.strict();
export type ProjectArchiveManifest = z.infer<
	typeof projectArchiveManifestSchema
>;

export const projectArchiveSectionSchema = z
	.object({
		group: z.string().min(1),
		name: z.string().min(1),
		records: z.array(z.unknown()),
	})
	.strict();
export type ProjectArchiveSection = z.infer<typeof projectArchiveSectionSchema>;

export const projectArchiveSummarySchema = z
	.object({
		createdAt: timestampSchema,
		id: uuidSchema,
		manifestDigest: archiveSha256Schema,
		projectId: idSchema,
		schemaVersion: z.string(),
	})
	.strict();
export type ProjectArchiveSummary = z.infer<typeof projectArchiveSummarySchema>;

/** An archive re-read from its persisted rows. */
export const projectArchiveSchema = projectArchiveSummarySchema
	.extend({
		manifest: projectArchiveManifestSchema,
		sections: z.array(projectArchiveSectionSchema),
	})
	.strict();
export type ProjectArchive = z.infer<typeof projectArchiveSchema>;

export const projectArchiveCatalogSchema = z
	.object({ archives: z.array(projectArchiveSummarySchema) })
	.strict();
export type ProjectArchiveCatalog = z.infer<typeof projectArchiveCatalogSchema>;

export const projectArchiveListInputSchema = z
	.object({ projectId: uuidSchema })
	.strict();

export const projectArchiveGetInputSchema = z
	.object({ archiveId: uuidSchema, projectId: uuidSchema })
	.strict();

/**
 * Starts one Project Archive. Which working files travel with it is a user
 * choice; the same `idempotencyKey` replays the first archive and never makes
 * a second one.
 */
export const projectArchiveCreateInputSchema = z
	.object({
		idempotencyKey: idempotencyKeySchema,
		projectId: uuidSchema,
		/** Managed Snapshot ids included as working files; every other working file is listed as excluded. */
		workingFileIds: z
			.array(uuidSchema)
			.default([])
			.refine(
				(list) => new Set(list).size === list.length,
				"A working file can be selected only once."
			),
	})
	.strict();
export type ProjectArchiveCreateInput = z.infer<
	typeof projectArchiveCreateInputSchema
>;

// ---------------------------------------------------------------------------
// Building and verifying
// ---------------------------------------------------------------------------

export interface ProjectArchiveSourceFile
	extends Omit<ProjectArchiveFileEntry, "exclusionReason" | "presence"> {
	/** Cloud storage location; kept beside the archive, never in the portable manifest. */
	objectKey: string;
}

export interface ProjectArchiveSource {
	/** Delivery and validation history; every list is empty for a project without any. */
	delivery: DeliveryRecords;
	files: ProjectArchiveSourceFile[];
	/** Production and review history; every list is empty for a project without any. */
	history: HistoryRecords;
	records: FoundationRecords;
}

export type ProjectArchiveRejection =
	| { assetVersionIds: string[]; reason: "asset_digest_missing" }
	| { failures: string[]; reason: "inconsistent_records" }
	| { paths: string[]; reason: "secret_detected" }
	| { reason: "file_unverifiable"; sourceIds: string[] }
	| { reason: "working_file_unavailable"; workingFileIds: string[] };

export interface BuiltProjectArchive {
	/** Included files with the object keys they are read from. */
	fileLocations: { kind: string; objectKey: string; sourceId: string }[];
	manifest: ProjectArchiveManifest;
	manifestDigest: string;
	sections: ProjectArchiveSection[];
}

const secretKeyPattern =
	/secret|token|password|passphrase|credential|api[-_]?key|private[-_]?key|encryption[-_]?key|authorization/i;

/** Key paths whose name looks like a credential; values are never reported. */
export function findSecretKeyPaths(value: unknown, path = ""): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((item, index) =>
			findSecretKeyPaths(item, `${path}[${index}]`)
		);
	}
	if (value && typeof value === "object") {
		return Object.entries(value).flatMap(([key, member]) => {
			const here = path ? `${path}.${key}` : key;
			return [
				...(secretKeyPattern.test(key) ? [here] : []),
				...findSecretKeyPaths(member, here),
			];
		});
	}
	return [];
}

/** Whether any of the exact secret values appears in the serialized archive. */
export function containsSecretValue(
	value: unknown,
	secretValues: readonly string[]
): boolean {
	const text = JSON.stringify(value);
	return secretValues.some(
		(secret) => secret.length >= 8 && text.includes(secret)
	);
}

function byId(left: { id: string }, right: { id: string }) {
	return Number(left.id > right.id) - Number(left.id < right.id);
}

/** The relations that must hold inside the foundation group: every link points at a record the archive holds. */
export function foundationRelationFailures(
	records: FoundationRecords,
	files: Pick<
		ProjectArchiveFileEntry,
		"assetRecordId" | "assetVersionId" | "kind" | "sourceId"
	>[]
): string[] {
	const failures: string[] = [];
	const idSet = (list: { id: string }[]) => new Set(list.map((r) => r.id));
	const families = idSet(records.assetFamilies);
	const subjects = idSet(records.subjectIdentities);
	const assetRecords = idSet(records.assetRecords);
	const versions = idSet(records.assetVersions);
	const units = idSet(records.unitVersions);
	const composites = idSet(records.compositeVersions);
	const references = idSet(records.references);
	const expect = (ok: boolean, message: string) => {
		if (!ok) {
			failures.push(message);
		}
	};
	for (const family of records.assetFamilies) {
		expect(
			subjects.has(family.subjectIdentityId),
			`Asset Family ${family.id} points at a missing Subject Identity.`
		);
	}
	for (const record of records.assetRecords) {
		expect(
			families.has(record.assetFamilyId),
			`Asset Record ${record.id} points at a missing Asset Family.`
		);
	}
	for (const version of records.assetVersions) {
		expect(
			assetRecords.has(version.assetRecordId),
			`Asset Version ${version.id} points at a missing Asset Record.`
		);
	}
	for (const design of records.canonicalDesigns) {
		expect(
			versions.has(design.assetVersionId),
			`Canonical Design ${design.id} points at a missing Asset Version.`
		);
	}
	for (const unit of records.unitVersions) {
		expect(
			versions.has(unit.assetVersionId) &&
				versions.has(unit.sourceAssetVersionId),
			`Unit Version ${unit.id} points at a missing Asset Version.`
		);
	}
	for (const composite of records.compositeVersions) {
		expect(
			assetRecords.has(composite.assetRecordId),
			`Composite Version ${composite.id} points at a missing Asset Record.`
		);
	}
	for (const membership of records.compositionMemberships) {
		expect(
			composites.has(membership.compositeVersionId) &&
				units.has(membership.unitVersionId),
			`Composition membership ${membership.id} points at a missing version.`
		);
	}
	for (const relationship of records.relationships) {
		expect(
			families.has(relationship.assetFamilyId) &&
				assetRecords.has(relationship.sourceAssetRecordId) &&
				assetRecords.has(relationship.targetAssetRecordId) &&
				(relationship.sourceAssetVersionId === null ||
					versions.has(relationship.sourceAssetVersionId)),
			`Relationship ${relationship.id} points at a missing record.`
		);
	}
	for (const reference of records.references) {
		expect(
			assetRecords.has(reference.assetRecordId) &&
				versions.has(reference.targetVersionId),
			`Reference ${reference.id} points at a missing record or Asset Version.`
		);
	}
	for (const entry of records.referenceHistory) {
		expect(
			references.has(entry.referenceId),
			`Reference history ${entry.id} points at a missing reference.`
		);
	}
	for (const file of files) {
		expect(
			file.assetVersionId === null || versions.has(file.assetVersionId),
			`File ${file.sourceId} points at a missing Asset Version.`
		);
		expect(
			file.assetRecordId === null || assetRecords.has(file.assetRecordId),
			`File ${file.sourceId} points at a missing Asset Record.`
		);
	}
	return failures;
}

export function sectionDigest(records: readonly { id: string }[]) {
	return recordContentDigest([...records].sort(byId));
}

/**
 * Builds the portable archive of one project's foundation records. Pure: it
 * decides what is included, pins every section and file by digest, and
 * refuses what cannot be pinned or must not travel.
 */
export async function buildProjectArchive(
	source: ProjectArchiveSource,
	options: {
		projectId: string;
		secretValues?: readonly string[];
		workingFileIds: readonly string[];
	}
): Promise<
	| { archive: BuiltProjectArchive; ok: true }
	| ({ ok: false } & ProjectArchiveRejection)
> {
	const workingFiles = new Set(
		source.files
			.filter((file) => file.kind === "working_file")
			.map((file) => file.sourceId)
	);
	const unavailable = options.workingFileIds.filter(
		(id) => !workingFiles.has(id)
	);
	if (unavailable.length > 0) {
		return {
			ok: false,
			reason: "working_file_unavailable",
			workingFileIds: unavailable,
		};
	}
	const undigested = source.records.assetVersions
		.filter((version) => version.contentDigest === null)
		.map((version) => version.id);
	if (undigested.length > 0) {
		return {
			assetVersionIds: undigested,
			ok: false,
			reason: "asset_digest_missing",
		};
	}

	const selected = new Set(options.workingFileIds);
	const files = source.files
		.map((file): ProjectArchiveFileEntry => {
			// Rights and runtime evidence files are never carried; only identity, digest and absence are.
			const exclusionReason = (() => {
				if (
					file.kind === "rights_evidence_file" ||
					file.kind === "runtime_evidence_file"
				) {
					return "evidence_not_archived" as const;
				}
				if (file.kind === "working_file" && !selected.has(file.sourceId)) {
					return "not_selected" as const;
				}
				return null;
			})();
			const included = exclusionReason === null;
			return {
				assetRecordId: file.assetRecordId,
				assetVersionId: file.assetVersionId,
				byteSize: file.byteSize,
				contentType: file.contentType,
				exclusionReason,
				fileName: file.fileName,
				kind: file.kind,
				presence: included ? "included" : "excluded",
				sha256: file.sha256,
				sourceId: file.sourceId,
			};
		})
		.sort(
			(left, right) =>
				Number(left.kind > right.kind) - Number(left.kind < right.kind) ||
				Number(left.sourceId > right.sourceId) -
					Number(left.sourceId < right.sourceId)
		);

	const sections: ProjectArchiveSection[] = [];
	const groups: [
		string,
		Record<string, z.ZodType>,
		Record<string, unknown[]>,
	][] = [
		[foundationGroup, foundationSectionSchemas, source.records],
		[historyGroup, historySectionSchemas, source.history],
		[deliveryGroup, deliverySectionSchemas, source.delivery],
	];
	for (const [group, schemas, recordsByName] of groups) {
		for (const [name, schema] of Object.entries(schemas)) {
			const records = (recordsByName[name] ?? [])
				.map((record) => schema.parse(record) as { id: string })
				.sort(byId);
			sections.push({ group, name, records });
		}
	}

	// A re-read archive lists its sections ordered by group and name; build in the same order.
	sections.sort(
		(left, right) =>
			Number(left.group > right.group) - Number(left.group < right.group) ||
			Number(left.name > right.name) - Number(left.name < right.name)
	);

	const secretPaths = [
		...findSecretKeyPaths(
			Object.fromEntries(
				sections.map((s) => [`${s.group}.${s.name}`, s.records])
			)
		),
		...findSecretKeyPaths(files),
	];
	if (
		secretPaths.length > 0 ||
		containsSecretValue([sections, files], options.secretValues ?? [])
	) {
		return {
			ok: false,
			paths: secretPaths,
			reason: "secret_detected",
		};
	}

	const failures = [
		...foundationRelationFailures(source.records, files),
		...historyRelationFailures(source.history, source.records, files),
		...(await deliveryRelationFailures(
			source.delivery,
			source.records,
			source.history,
			files
		)),
	];
	if (failures.length > 0) {
		return { failures, ok: false, reason: "inconsistent_records" };
	}

	const contents = await Promise.all(
		sections.map(async (section) => ({
			digest: await sectionDigest(section.records as { id: string }[]),
			group: section.group,
			name: section.name,
			recordCount: section.records.length,
		}))
	);
	const manifest = projectArchiveManifestSchema.parse({
		contents,
		files,
		schemaVersion: projectArchiveSchemaVersion,
		source: { projectId: options.projectId },
	});
	const includedKeys = new Set(
		files
			.filter((file) => file.presence === "included")
			.map((file) => `${file.kind}:${file.sourceId}`)
	);
	return {
		archive: {
			fileLocations: source.files
				.filter((file) => includedKeys.has(`${file.kind}:${file.sourceId}`))
				.map((file) => ({
					kind: file.kind,
					objectKey: file.objectKey,
					sourceId: file.sourceId,
				})),
			manifest,
			manifestDigest: await recordContentDigest(manifest),
			sections,
		},
		ok: true,
	};
}

/** Failure texts when a re-read archive no longer matches its own manifest and record relations; empty when sound. */
export async function verifyProjectArchive(archive: {
	manifest: ProjectArchiveManifest;
	manifestDigest: string;
	sections: ProjectArchiveSection[];
}): Promise<string[]> {
	const failures: string[] = [];
	if (
		(await recordContentDigest(archive.manifest)) !== archive.manifestDigest
	) {
		failures.push("The manifest digest does not match the record.");
	}
	const manifestKeys = new Set(
		archive.manifest.contents.map((entry) => `${entry.group}/${entry.name}`)
	);
	const digests = await Promise.all(
		archive.sections.map((section) =>
			sectionDigest(section.records as { id: string }[])
		)
	);
	for (const [index, section] of archive.sections.entries()) {
		const key = `${section.group}/${section.name}`;
		const schema = projectArchiveSectionRegistry[section.group]?.[section.name];
		if (!schema) {
			failures.push(`Section ${key} belongs to an unknown record group.`);
			continue;
		}
		const entry = archive.manifest.contents.find(
			(candidate) =>
				candidate.group === section.group && candidate.name === section.name
		);
		if (!entry) {
			failures.push(`Section ${key} is not listed in the manifest.`);
			continue;
		}
		manifestKeys.delete(key);
		const parsed = z.array(schema).safeParse(section.records);
		if (!parsed.success) {
			failures.push(`Section ${key} holds a record that breaks its schema.`);
			continue;
		}
		if (entry.recordCount !== section.records.length) {
			failures.push(
				`Section ${key} holds a different record count than its manifest entry.`
			);
		}
		if (entry.digest !== digests[index]) {
			failures.push(`Section ${key} does not match its manifest digest.`);
		}
	}
	for (const missing of manifestKeys) {
		failures.push(`Section ${missing} is listed in the manifest but missing.`);
	}
	const foundation = Object.fromEntries(
		archive.sections
			.filter((section) => section.group === foundationGroup)
			.map((section) => [section.name, section.records])
	) as unknown as FoundationRecords;
	if (
		Object.keys(foundationSectionSchemas).every((name) => name in foundation)
	) {
		failures.push(
			...foundationRelationFailures(foundation, archive.manifest.files)
		);
	}
	const history = Object.fromEntries(
		archive.sections
			.filter((section) => section.group === historyGroup)
			.map((section) => [section.name, section.records])
	) as unknown as HistoryRecords;
	const historyComplete = Object.keys(historySectionSchemas).every(
		(name) => name in history
	);
	if (
		historyComplete &&
		Object.keys(foundationSectionSchemas).every((name) => name in foundation)
	) {
		failures.push(
			...historyRelationFailures(history, foundation, archive.manifest.files)
		);
	}
	const delivery = Object.fromEntries(
		archive.sections
			.filter((section) => section.group === deliveryGroup)
			.map((section) => [section.name, section.records])
	) as unknown as DeliveryRecords;
	if (
		historyComplete &&
		Object.keys(deliverySectionSchemas).every((name) => name in delivery) &&
		Object.keys(foundationSectionSchemas).every((name) => name in foundation)
	) {
		failures.push(
			...(await deliveryRelationFailures(
				delivery,
				foundation,
				history,
				archive.manifest.files
			))
		);
	}
	return failures;
}

/** Digest of the create request, so a repeated key with other content is a conflict. */
export function projectArchiveRequestDigest(input: {
	projectId: string;
	workingFileIds: readonly string[];
}) {
	return recordContentDigest({
		projectId: input.projectId,
		workingFileIds: [...input.workingFileIds].sort(),
	});
}
