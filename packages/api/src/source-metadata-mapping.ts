import { z } from "zod";
import { assetSourceFileNameSchema } from "./asset-record-tracking";

export const sourceMetadataMappingContractVersion =
	"source-metadata-mapping/1.0.0" as const;

export const sourceMetadataFormatSchema = z.enum([
	"aseprite",
	"texture-packer",
]);
export const sourceMetadataJsonLayoutSchema = z.enum(["array", "hash"]);
export const sourceMetadataFieldNameSchema = z.enum([
	"frame",
	"tag",
	"slice",
	"pivot",
	"nine-slice",
	"palette",
]);

export const sourceMetadataMappingSidecarSchema = z
	.object({
		entryId: z.uuid(),
		fileName: assetSourceFileNameSchema,
		format: sourceMetadataFormatSchema,
		jsonLayout: sourceMetadataJsonLayoutSchema,
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		version: z.string().min(1).max(128),
	})
	.strict();
export type SourceMetadataMappingSidecar = z.infer<
	typeof sourceMetadataMappingSidecarSchema
>;

export const sourceMetadataMappingSourceSchema = z
	.object({
		entryId: z.uuid(),
		fileName: assetSourceFileNameSchema,
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
	})
	.strict();

export const sourceMetadataFieldProposalSchema = z
	.object({
		field: sourceMetadataFieldNameSchema,
		key: z.string().min(1).max(512),
		sourceEntryId: z.uuid(),
		sourceFileName: assetSourceFileNameSchema,
		sourceFormat: sourceMetadataFormatSchema,
		sourcePath: z.string().min(1).max(2048),
		value: z.unknown(),
	})
	.strict();
export type SourceMetadataFieldProposal = z.infer<
	typeof sourceMetadataFieldProposalSchema
>;

export const sourceMetadataUnknownSuggestionSchema = z
	.object({
		reason: z.literal("no-source-evidence"),
		status: z.literal("unknown"),
	})
	.strict();

export const sourceMetadataGameplayMetadataSuggestionSchema = z
	.object({
		reason: z.literal("project-context-required"),
		status: z.literal("unknown"),
	})
	.strict();

export const sourceMetadataMappingSuggestionsSchema = z
	.object({
		assetFamilyLinks: sourceMetadataUnknownSuggestionSchema,
		gameplayMetadata: sourceMetadataGameplayMetadataSuggestionSchema,
		requiredSetLinks: sourceMetadataUnknownSuggestionSchema,
	})
	.strict();
export type SourceMetadataMappingSuggestions = z.infer<
	typeof sourceMetadataMappingSuggestionsSchema
>;

export const sourceMetadataMappingConflictSchema = z
	.object({
		candidates: z.array(sourceMetadataFieldProposalSchema).min(2),
		field: sourceMetadataFieldNameSchema,
		key: z.string().min(1).max(512),
	})
	.strict();

export const sourceMetadataMappingDiagnosticSchema = z
	.object({
		message: z.string().min(1).max(512),
		severity: z.enum(["warning", "error"]),
		sourceEntryId: z.uuid(),
		sourcePath: z.string().min(1).max(2048),
	})
	.strict();
export type SourceMetadataMappingDiagnostic = z.infer<
	typeof sourceMetadataMappingDiagnosticSchema
>;

export const sourceMetadataMappingProposalSchema = z
	.object({
		contractVersion: z.literal(sourceMetadataMappingContractVersion),
		conflicts: z.array(sourceMetadataMappingConflictSchema),
		createdAt: z.iso.datetime(),
		diagnostics: z.array(sourceMetadataMappingDiagnosticSchema),
		fields: z.array(sourceMetadataFieldProposalSchema),
		id: z.uuid(),
		projectId: z.uuid(),
		sidecars: z.array(sourceMetadataMappingSidecarSchema).min(1),
		source: sourceMetadataMappingSourceSchema,
		suggestions: sourceMetadataMappingSuggestionsSchema,
	})
	.strict();
export type SourceMetadataMappingProposal = z.infer<
	typeof sourceMetadataMappingProposalSchema
>;

export const sourceMetadataMappingProposalCreateInputSchema = z
	.object({
		sidecarEntryIds: z.array(z.uuid()).min(1),
	})
	.strict()
	.superRefine((input, context) => {
		if (new Set(input.sidecarEntryIds).size !== input.sidecarEntryIds.length) {
			context.addIssue({
				code: "custom",
				message: "Sidecar entries must be unique",
				path: ["sidecarEntryIds"],
			});
		}
	});
export type SourceMetadataMappingProposalCreateInput = z.infer<
	typeof sourceMetadataMappingProposalCreateInputSchema
>;

export const sourceMetadataMappingProposalsSchema = z.array(
	sourceMetadataMappingProposalSchema
);

export interface SourceMetadataMappingProposalStore {
	createProposal: (
		userId: string,
		projectId: string,
		sourceEntryId: string,
		proposal: SourceMetadataMappingProposal
	) => Promise<SourceMetadataMappingProposal | null>;
	listProposals: (
		userId: string,
		projectId: string,
		sourceEntryId: string
	) => Promise<SourceMetadataMappingProposal[] | null>;
}
