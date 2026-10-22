import {
	assetVersionReviewDispositionSchema,
	type UnitVersionType,
} from "@sprite-anvil/api/asset-versions";
import type { ProviderGenerationRecordCreateInput } from "@sprite-anvil/api/provider-generation-records";
import { providerGenerationRecordCreateInputSchema } from "@sprite-anvil/api/provider-generation-records";
import z from "zod";

export type ProviderGenerationRecordFields = Omit<
	ProviderGenerationRecordCreateInput,
	"assetVersionId" | "projectId"
>;

export const providerGenerationRecordFormDefaults = {
	actualHeight: "",
	actualWidth: "",
	interfaceName: "",
	model: "",
	modelVersion: "",
	palette: "",
	provider: "",
	providerParameters: "",
	referenceIds: "",
	requestedHeight: "",
	requestedWidth: "",
	seed: "",
};

type ProviderGenerationRecordFormValues =
	typeof providerGenerationRecordFormDefaults;

const maxDimension = 100_000;
const listSeparatorPattern = /[\r\n,]/;

function optionalText(value: string) {
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function splitList(value: string) {
	return value
		.split(listSeparatorPattern)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

type DimensionsResult =
	| { error: null; value: { height: number; width: number } | null }
	| { error: "pair" | "range"; value: null };

function readDimensions(width: string, height: string): DimensionsResult {
	const normalizedWidth = width.trim();
	const normalizedHeight = height.trim();
	if (!(normalizedWidth || normalizedHeight)) {
		return { value: null, error: null };
	}
	if (!(normalizedWidth && normalizedHeight)) {
		return { value: null, error: "pair" };
	}
	const parsedWidth = Number(normalizedWidth);
	const parsedHeight = Number(normalizedHeight);
	if (
		!(Number.isInteger(parsedWidth) && Number.isInteger(parsedHeight)) ||
		parsedWidth < 1 ||
		parsedHeight < 1 ||
		parsedWidth > maxDimension ||
		parsedHeight > maxDimension
	) {
		return { value: null, error: "range" };
	}
	return {
		value: { height: parsedHeight, width: parsedWidth },
		error: null,
	};
}

type ProviderParametersResult =
	| { ok: true; value: ProviderGenerationRecordFields["providerParameters"] }
	| { ok: false };

function readProviderParameters(value: string): ProviderParametersResult {
	try {
		const parsed: unknown = value.trim() ? JSON.parse(value) : {};
		return {
			ok: true,
			value:
				providerGenerationRecordCreateInputSchema.shape.providerParameters.parse(
					parsed
				) as ProviderGenerationRecordFields["providerParameters"],
		};
	} catch {
		return { ok: false };
	}
}

const dimensionMessages = {
	actual: {
		pair: "Gerçekleşen ölçünün genişlik ve yükseklik değerlerini birlikte girin.",
		range: "Gerçekleşen ölçü 1 ile 100000 arasında tam sayı olmalıdır.",
	},
	requested: {
		pair: "İstenen ölçünün genişlik ve yükseklik değerlerini birlikte girin.",
		range: "İstenen ölçü 1 ile 100000 arasında tam sayı olmalıdır.",
	},
} as const;

const providerParametersMessage =
	"Sağlayıcıya özgü parametreler geçerli bir JSON nesnesi olmalı ve 50.000 UTF-8 baytı aşmamalıdır.";

/**
 * Validates the provider generation record form and maps it to the record
 * fields. Only the first problem is reported, in the order requested size,
 * actual size, provider parameters.
 */
export const providerGenerationRecordFormSchema = z
	.object({
		actualHeight: z.string(),
		actualWidth: z.string(),
		interfaceName: z.string(),
		model: z.string(),
		modelVersion: z.string(),
		palette: z.string(),
		provider: z.string(),
		providerParameters: z.string(),
		referenceIds: z.string(),
		requestedHeight: z.string(),
		requestedWidth: z.string(),
		seed: z.string(),
	})
	.transform((values: ProviderGenerationRecordFormValues, context) => {
		const requested = readDimensions(
			values.requestedWidth,
			values.requestedHeight
		);
		if (requested.error) {
			context.addIssue({
				code: "custom",
				message: dimensionMessages.requested[requested.error],
			});
			return z.NEVER;
		}
		const actual = readDimensions(values.actualWidth, values.actualHeight);
		if (actual.error) {
			context.addIssue({
				code: "custom",
				message: dimensionMessages.actual[actual.error],
			});
			return z.NEVER;
		}
		const parameters = readProviderParameters(values.providerParameters);
		if (!parameters.ok) {
			context.addIssue({
				code: "custom",
				message: providerParametersMessage,
			});
			return z.NEVER;
		}
		return {
			actualDimensions: actual.value,
			interface: optionalText(values.interfaceName),
			model: optionalText(values.model),
			modelVersion: optionalText(values.modelVersion),
			palette: splitList(values.palette),
			provider: values.provider.trim(),
			providerParameters: parameters.value,
			referenceIds: splitList(values.referenceIds),
			requestedDimensions: requested.value,
			seed: optionalText(values.seed),
		} satisfies ProviderGenerationRecordFields;
	});

export const unitVersionTypes = [
	"frame",
	"direction",
	"tile",
	"state",
] as const satisfies readonly UnitVersionType[];

/**
 * Validates a unit version correction. `sourceAssetVersionIds` are the Asset
 * Versions that may be the source for the chosen unit.
 */
export function unitVersionCorrectionFormSchema(
	sourceAssetVersionIds: ReadonlySet<string>
) {
	return z.object({
		file: z.instanceof(File, { message: "Düzeltilmiş dosyayı seçin." }),
		sourceAssetVersionId: z
			.string()
			.refine((id) => sourceAssetVersionIds.has(id), {
				message: "Kaynak sürümü seçin.",
			}),
		unitKey: z.string().trim().min(1, "Birim adını girin."),
		unitType: z.enum(unitVersionTypes),
	});
}

/**
 * Validates a new Composite Version selection. `unitVersionIds` are the Unit
 * Versions that still belong to the Asset Record.
 */
export function compositeVersionFormSchema(
	unitVersionIds: ReadonlySet<string>
) {
	return z.object({
		selectedUnitVersionIds: z
			.record(z.string(), z.string())
			.refine(
				(selected) =>
					Object.values(selected).some((id) => unitVersionIds.has(id)),
				{ message: "En az bir Birim Sürümü seçin." }
			),
		sourceCompositeVersionId: z.string(),
	});
}

/**
 * Review rationale shared by the Asset Version and Composite Version review
 * controls: required, non-blank, and at most 2000 characters once trimmed.
 */
export const reviewRationaleFormSchema = z.object({
	rationale: z.string().trim().min(1).max(2000),
});

/**
 * Batch review form: one to 100 selected Asset Versions, one decision, and a
 * non-blank rationale of at most 2000 characters once trimmed.
 */
export const batchReviewFormSchema = z.object({
	decision: assetVersionReviewDispositionSchema,
	rationale: z.string().trim().min(1).max(2000),
	selected: z.array(z.string()).min(1).max(100),
});
