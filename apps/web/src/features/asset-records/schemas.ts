import { dependencyFacetSchema } from "@sprite-anvil/api/asset-record-tracking";
import {
	type AssetRecordMeasurements,
	assetRecordCategoryValues,
	assetRecordMeasurementsSchema,
} from "@sprite-anvil/api/asset-records";
import z from "zod";

export const measurementsSaveFailureMessage =
	"Could not save dimensions. Check the values and try again.";

export type MeasurementKey =
	| "sourceImageDimensions"
	| "logicalResolution"
	| "cellDimensions"
	| "visibleContentBounds"
	| "displayScale"
	| "atlasDimensions";
export type MeasurementState = "proposal" | "confirmed";
export type MeasurementDraft = Record<string, string>;

export function draftKey(
	measurement: MeasurementKey,
	state: MeasurementState,
	field: string
) {
	return `${measurement}.${state}.${field}`;
}

function readNumber(
	draft: MeasurementDraft,
	measurement: MeasurementKey,
	state: MeasurementState,
	field: string,
	minimum: number,
	integer: boolean,
	label: string
) {
	const value = draft[draftKey(measurement, state, field)] ?? "";
	if (value.trim() === "") {
		return null;
	}
	const number = Number(value);
	if (
		!Number.isFinite(number) ||
		number < minimum ||
		(integer && !Number.isInteger(number))
	) {
		throw new Error(
			`${label} must be a valid ${integer ? "integer" : "number"}.`
		);
	}
	return number;
}

function readPixelDimensions(
	draft: MeasurementDraft,
	measurement: MeasurementKey,
	state: MeasurementState,
	label: string
) {
	const width = readNumber(draft, measurement, state, "width", 1, true, label);
	const height = readNumber(
		draft,
		measurement,
		state,
		"height",
		1,
		true,
		label
	);
	if (width === null && height === null) {
		return null;
	}
	if (width === null || height === null) {
		throw new Error(`Enter both width and height for ${label}.`);
	}
	return { height, width };
}

function readVisibleContentBounds(
	draft: MeasurementDraft,
	state: MeasurementState
) {
	const measurement = "visibleContentBounds";
	const x = readNumber(
		draft,
		measurement,
		state,
		"x",
		0,
		true,
		"Visible Content Bounds"
	);
	const y = readNumber(
		draft,
		measurement,
		state,
		"y",
		0,
		true,
		"Visible Content Bounds"
	);
	const width = readNumber(
		draft,
		measurement,
		state,
		"width",
		1,
		true,
		"Visible Content Bounds"
	);
	const height = readNumber(
		draft,
		measurement,
		state,
		"height",
		1,
		true,
		"Visible Content Bounds"
	);
	if (x === null && y === null && width === null && height === null) {
		return null;
	}
	if (x === null || y === null || width === null || height === null) {
		throw new Error(
			"Enter X, Y, width, and height together for Visible Content Bounds."
		);
	}
	const coordinateSpace =
		draft[draftKey(measurement, state, "coordinateSpace")];
	if (
		coordinateSpace !== "logicalResolution" &&
		coordinateSpace !== "cellDimensions"
	) {
		throw new Error("Select a coordinate space for Visible Content Bounds.");
	}
	return {
		coordinateSpace: coordinateSpace as "logicalResolution" | "cellDimensions",
		height,
		width,
		x,
		y,
	};
}

function readDisplayScale(draft: MeasurementDraft, state: MeasurementState) {
	return readNumber(
		draft,
		"displayScale",
		state,
		"value",
		Number.MIN_VALUE,
		false,
		"Display Scale"
	);
}

function readMeasurements(draft: MeasurementDraft): AssetRecordMeasurements {
	return {
		atlasDimensions: {
			confirmed: readPixelDimensions(
				draft,
				"atlasDimensions",
				"confirmed",
				"Atlas Dimensions"
			),
			proposal: readPixelDimensions(
				draft,
				"atlasDimensions",
				"proposal",
				"Atlas Dimensions"
			),
		},
		cellDimensions: {
			confirmed: readPixelDimensions(
				draft,
				"cellDimensions",
				"confirmed",
				"Cell Dimensions"
			),
			proposal: readPixelDimensions(
				draft,
				"cellDimensions",
				"proposal",
				"Cell Dimensions"
			),
		},
		displayScale: {
			confirmed: readDisplayScale(draft, "confirmed"),
			proposal: readDisplayScale(draft, "proposal"),
		},
		logicalResolution: {
			confirmed: readPixelDimensions(
				draft,
				"logicalResolution",
				"confirmed",
				"Logical Resolution"
			),
			proposal: readPixelDimensions(
				draft,
				"logicalResolution",
				"proposal",
				"Logical Resolution"
			),
		},
		sourceImageDimensions: {
			confirmed: readPixelDimensions(
				draft,
				"sourceImageDimensions",
				"confirmed",
				"Source Image Dimensions"
			),
			proposal: readPixelDimensions(
				draft,
				"sourceImageDimensions",
				"proposal",
				"Source Image Dimensions"
			),
		},
		visibleContentBounds: {
			confirmed: readVisibleContentBounds(draft, "confirmed"),
			proposal: readVisibleContentBounds(draft, "proposal"),
		},
	};
}

export const measurementsDraftFormSchema = z.object({
	draft: z.record(z.string(), z.string()).transform((draft, context) => {
		let measurements: AssetRecordMeasurements;
		try {
			measurements = readMeasurements(draft);
		} catch {
			context.addIssue({
				code: "custom",
				message: measurementsSaveFailureMessage,
			});
			return z.NEVER;
		}
		const parsed = assetRecordMeasurementsSchema.safeParse(measurements);
		if (!parsed.success) {
			context.addIssue({
				code: "custom",
				message:
					parsed.error.issues[0]?.message ??
					"Check the image dimensions and try again.",
			});
			return z.NEVER;
		}
		return parsed.data;
	}),
});

export const assetRecordMetadataFormSchema = z.object({
	assetCategory: z.union([z.literal(""), z.enum(assetRecordCategoryValues)]),
	tags: z.string().transform((tags) => [
		...new Map(
			tags
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean)
				.map((tag) => [tag.toLowerCase(), tag] as const)
		).values(),
	]),
	themeId: z.string(),
	visualWorldId: z.string(),
});

const maxManualImportFileBytes = 5 * 1024 * 1024;

export function isSupportedManualImportFile(file: File | null) {
	return Boolean(
		file &&
			file.size > 0 &&
			file.size <= maxManualImportFileBytes &&
			["image/png", "image/webp"].includes(file.type)
	);
}

export const manualImportEvidenceFormSchema = z.object({
	file: z
		.custom<File | null>((value) => value === null || value instanceof File)
		.refine(isSupportedManualImportFile),
	generationInstruction: z
		.string()
		.refine((instruction) => instruction.trim().length > 0),
	generationPackageId: z.string().min(1),
	isProviderResult: z.boolean(),
	sourceSurface: z.string().refine((surface) => surface.trim().length > 0),
});

export const manualImportEvidenceSubmitSchema =
	manualImportEvidenceFormSchema.extend({
		generationInstruction: z.string(),
		sourceSurface: z.string(),
	});

const candidateVersionFile = z.custom<File | null>(
	(value) => value === null || value instanceof File
);

export const candidateVersionFormSchema = z.object({
	file: candidateVersionFile.refine(
		(file) =>
			file !== null &&
			file.size <= 5 * 1024 * 1024 &&
			["image/png", "image/webp"].includes(file.type)
	),
	knownSource: z.string(),
	supportingEvidence: z.string(),
	unknownHistoryDetails: z
		.string()
		.refine((details) => details.trim().length > 0),
	userRelationship: z.enum([
		"created_by_user",
		"received_from_team",
		"licensed_third_party",
		"unknown",
	]),
});

export const candidateVersionSubmitSchema = candidateVersionFormSchema
	.omit({ file: true })
	.extend({ file: candidateVersionFile.refine((file) => file !== null) });

export const assetFamilyFormSchema = z.object({
	familyName: z.string().refine((name) => name.trim().length > 0),
	familyUseContext: z.string().refine((context) => context.trim().length > 0),
	visualWorldId: z.string().min(1),
});

export const assetFamilySubmitSchema = assetFamilyFormSchema.extend({
	familyName: z.string(),
	familyUseContext: z.string(),
});

export const derivativeLinkFormSchema = z.object({
	dependencyFacets: z.array(dependencyFacetSchema).min(1),
	derivativeAssetRecordId: z.string().min(1),
});

export const derivativeLinkSubmitSchema = derivativeLinkFormSchema.extend({
	derivativeAssetRecordId: z.string(),
});

export const assetRecordCreateFormSchema = z.object({
	identityCriteria: z
		.array(
			z.enum([
				"independent_product_meaning",
				"independent_lifecycle",
				"delivery_identity",
			])
		)
		.min(1),
	name: z.string().refine((name) => name.trim().length > 0),
});

/** Optional review rationale on the Asset Record tracking panel. */
export const trackingReviewRationaleFormSchema = z.object({
	rationale: z.string().max(1000),
});
