import { z } from "zod";
import { sha256Schema } from "./export-bundle-manifest";

const idSchema = z.uuid();

/** The Export Profile contract version this build writes; its major gates new bundles. */
export const exportProfileContractVersion = "1.0.0";
export const supportedExportProfileContractMajor = 1;

const contractVersionPattern = /^\d+\.\d+\.\d+$/;
const contractVersionSchema = z.string().regex(contractVersionPattern);

/** The major number of a `major.minor.patch` contract version. */
export function contractMajorOf(version: string): number {
	return Number(version.split(".")[0]);
}

export const exportLayoutSchema = z.enum(["grid", "packed"]);
export const exportTrimSchema = z.enum(["none", "transparent"]);
export const exportFileFormatSchema = z.enum(["png"]);

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
	z.union([
		z.string().max(512),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(jsonValueSchema).max(50),
		z.record(z.string().max(64), jsonValueSchema),
	])
);

/** Maps one source metadata field to the key it is written under in the bundle. */
export const exportMetadataMappingSchema = z
	.object({
		sourceField: z.string().trim().min(1).max(64),
		targetKey: z.string().trim().min(1).max(64),
	})
	.strict();

/**
 * What a profile fixes: layout, padding, trim, scale, file format, naming and
 * metadata mapping. Fields are strict, so an unknown required field stops a
 * new revision; `extensions` is the optional part, kept as written.
 */
export const exportProfileDefinitionSchema = z
	.object({
		extensions: z.record(z.string().max(64), jsonValueSchema).optional(),
		fileFormat: exportFileFormatSchema,
		layout: exportLayoutSchema,
		metadataMapping: z
			.array(exportMetadataMappingSchema)
			.max(50)
			.refine(
				(mappings) =>
					new Set(mappings.map((mapping) => mapping.targetKey)).size ===
					mappings.length,
				"A metadata key can be mapped only once."
			),
		namingTemplate: z.string().trim().min(1).max(128),
		/** Transparent pixels added around each frame, in source pixels. */
		padding: z.number().int().min(0).max(64),
		/** Whole-number upscale of every frame. */
		scale: z.number().int().min(1).max(16),
		trim: exportTrimSchema,
	})
	.strict();
export type ExportProfileDefinition = z.infer<
	typeof exportProfileDefinitionSchema
>;

export const exportProfileListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

/**
 * Saves the next immutable revision of a profile; a new `profileId` starts the
 * profile. `revisionId` is the idempotency key, so a repeat replays the revision.
 */
export const exportProfileRevisionCreateInputSchema = z
	.object({
		contractVersion: contractVersionSchema,
		definition: exportProfileDefinitionSchema,
		/** Names a new profile; an existing profile keeps its name. */
		name: z.string().trim().min(1).max(120),
		profileId: idSchema,
		projectId: idSchema,
		revisionId: idSchema,
	})
	.strict();
export type ExportProfileRevisionCreateInput = z.infer<
	typeof exportProfileRevisionCreateInputSchema
>;

export const exportProfileRevisionSchema = z.object({
	contentDigest: sha256Schema,
	contractVersion: contractVersionSchema,
	createdAt: z.iso.datetime(),
	definition: exportProfileDefinitionSchema,
	id: idSchema,
	revisionNumber: z.number().int().positive(),
});
export type ExportProfileRevision = z.infer<typeof exportProfileRevisionSchema>;

export const exportProfileSchema = z.object({
	id: idSchema,
	name: z.string(),
	/** Oldest first; earlier revisions are never rewritten. */
	revisions: z.array(exportProfileRevisionSchema),
});
export type ExportProfile = z.infer<typeof exportProfileSchema>;

export const exportProfileCatalogSchema = z.object({
	profiles: z.array(exportProfileSchema),
});
export type ExportProfileCatalog = z.infer<typeof exportProfileCatalogSchema>;
