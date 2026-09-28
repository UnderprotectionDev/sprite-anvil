import { z } from "zod";

const idSchema = z.uuid();

const dimensionsSchema = z
	.object({
		height: z.number().int().positive().max(100_000),
		width: z.number().int().positive().max(100_000),
	})
	.strict();

const nullableDimensionsSchema = dimensionsSchema.nullable();
const nullableTextSchema = z.string().trim().min(1).max(500).nullable();
const providerParametersSchema = z.record(z.string(), z.json());
const providerParametersInputSchema = providerParametersSchema.superRefine(
	(parameters, context) => {
		const serializedSize = new TextEncoder().encode(
			JSON.stringify(parameters)
		).byteLength;
		if (serializedSize > 50_000) {
			context.addIssue({
				code: "custom",
				message: "Provider parameters must not exceed 50000 UTF-8 bytes.",
			});
		}
	}
);

export const providerGenerationParameterSnapshotSchemaVersion =
	"provider-generation-parameters/1.0.0";

export const assetVersionProductionSourceHeader =
	"x-asset-version-production-source";

export const assetVersionProductionSourceSchema = z.enum([
	"unknown",
	"user_reported_provider",
	"connected_provider",
]);

export const providerGenerationParameterSnapshotSchema = z
	.object({
		parameters: providerParametersSchema,
		schemaVersion: z.literal(providerGenerationParameterSnapshotSchemaVersion),
	})
	.strict();

export const providerGenerationRecordSchema = z
	.object({
		actualDimensions: nullableDimensionsSchema,
		assetRecordId: idSchema,
		assetVersionId: idSchema,
		createdAt: z.iso.datetime(),
		id: idSchema,
		interface: nullableTextSchema,
		model: nullableTextSchema,
		modelVersion: nullableTextSchema,
		palette: z.array(z.string().trim().min(1).max(200)).max(256),
		parameterSnapshot: providerGenerationParameterSnapshotSchema,
		projectId: idSchema,
		provider: z.string().trim().min(1).max(200),
		referenceIds: z.array(z.string().trim().min(1).max(500)).max(200),
		requestedDimensions: nullableDimensionsSchema,
		seed: z.union([z.string().max(256), z.number().finite()]).nullable(),
	})
	.strict();

export const providerGenerationRecordCreateInputSchema = z
	.object({
		actualDimensions: nullableDimensionsSchema,
		assetVersionId: idSchema,
		interface: nullableTextSchema,
		model: nullableTextSchema,
		modelVersion: nullableTextSchema,
		palette: z.array(z.string().trim().min(1).max(200)).max(256),
		projectId: idSchema,
		provider: z.string().trim().min(1).max(200),
		providerParameters: providerParametersInputSchema,
		referenceIds: z.array(z.string().trim().min(1).max(500)).max(200),
		requestedDimensions: nullableDimensionsSchema,
		seed: z.union([z.string().max(256), z.number().finite()]).nullable(),
	})
	.strict();

export type AssetVersionProductionSource = z.infer<
	typeof assetVersionProductionSourceSchema
>;
export type ProviderGenerationParameterSnapshot = z.infer<
	typeof providerGenerationParameterSnapshotSchema
>;
export type ProviderGenerationRecord = z.infer<
	typeof providerGenerationRecordSchema
>;
export type ProviderGenerationRecordCreateInput = z.infer<
	typeof providerGenerationRecordCreateInputSchema
>;

export type ProviderGenerationRecordCreateResult =
	| { kind: "created" | "existing"; record: ProviderGenerationRecord }
	| { kind: "not-provider-result" }
	| { kind: "conflict" };

export interface ProviderGenerationRecordStore {
	create: (
		userId: string,
		input: ProviderGenerationRecordCreateInput
	) => Promise<ProviderGenerationRecordCreateResult | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<ProviderGenerationRecord[] | null>;
}
