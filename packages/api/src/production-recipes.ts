import { z } from "zod";
import {
	referenceFeatureSchema,
	referenceRoleSchema,
} from "./asset-record-tracking";
import type { GenerationPackage } from "./generation-packages";

const idSchema = z.uuid();
const titleSchema = z.string().trim().min(1).max(120);
const noteSchema = z.string().trim().min(1).max(2000);

export const productionRecipeFieldModes = ["fixed", "fill_in"] as const;

/**
 * A field of the instruction skeleton. A fixed field carries its value in every
 * use; a fill-in field is left empty in the recipe and supplied at each use.
 */
export const productionRecipeFieldSchema = z
	.object({
		key: z
			.string()
			.regex(/^[a-z][a-z0-9_]{0,39}$/, "Use lowercase letters, digits and _."),
		label: z.string().trim().min(1).max(60),
		mode: z.enum(productionRecipeFieldModes),
		value: z.string().trim().min(1).max(2000).nullable(),
	})
	.strict();

/** A role the recipe expects; it names no asset version, file or rights record. */
export const productionRecipeReferenceRoleSchema = z
	.object({
		customPurpose: z.string().trim().min(1).max(500).nullable(),
		forbiddenFeatures: z.array(referenceFeatureSchema).max(7),
		notes: z.string().trim().min(1).max(2000).nullable(),
		role: referenceRoleSchema,
		transferredFeatures: z.array(referenceFeatureSchema).max(7),
	})
	.strict();

export const productionRecipeContentSchema = z
	.object({
		expectedOutputStructure: z.string().trim().min(1).max(2000),
		fields: z.array(productionRecipeFieldSchema).max(50),
		instructionSkeleton: z.string().trim().min(1).max(4000),
		referenceRoles: z.array(productionRecipeReferenceRoleSchema).max(50),
	})
	.strict();

export const productionRecipeVersionSchema = z
	.object({
		content: productionRecipeContentSchema,
		createdAt: z.iso.datetime(),
		id: idSchema,
		note: noteSchema.nullable(),
		versionNumber: z.number().int().positive(),
	})
	.strict();

export const productionRecipeSourceSchema = z
	.object({
		assetRecordId: idSchema,
		experimentId: idSchema,
		generationPackageId: idSchema,
		trialId: idSchema,
	})
	.strict();

export const productionRecipeSchema = z
	.object({
		createdAt: z.iso.datetime(),
		id: idSchema,
		projectId: idSchema,
		source: productionRecipeSourceSchema,
		title: titleSchema,
		versions: z.array(productionRecipeVersionSchema).min(1),
	})
	.strict();

export const productionRecipeCreateInputSchema = z
	.object({
		// Omitted: the skeleton is derived from the selected trial's package.
		content: productionRecipeContentSchema.optional(),
		experimentId: idSchema,
		projectId: idSchema,
		title: titleSchema,
		trialId: idSchema,
	})
	.strict();

export const productionRecipeCreateVersionInputSchema = z
	.object({
		baseVersionNumber: z.number().int().positive(),
		content: productionRecipeContentSchema,
		note: noteSchema.optional(),
		projectId: idSchema,
		recipeId: idSchema,
	})
	.strict();

export const productionRecipeGetInputSchema = z
	.object({ projectId: idSchema, recipeId: idSchema })
	.strict();

export const productionRecipeListInputSchema = z
	.object({ projectId: idSchema })
	.strict();

export type ProductionRecipe = z.infer<typeof productionRecipeSchema>;
export type ProductionRecipeContent = z.infer<
	typeof productionRecipeContentSchema
>;
export type ProductionRecipeSource = z.infer<
	typeof productionRecipeSourceSchema
>;

export type ProductionRecipeAddVersionResult =
	| { kind: "created"; recipe: ProductionRecipe }
	// Another version was added after the one the edit started from.
	| { kind: "stale" };

export interface ProductionRecipeStore {
	addVersion: (
		userId: string,
		input: {
			baseVersionNumber: number;
			content: ProductionRecipeContent;
			note: string | null;
			projectId: string;
			recipeId: string;
		}
	) => Promise<ProductionRecipeAddVersionResult | null>;
	create: (
		userId: string,
		input: {
			content: ProductionRecipeContent;
			projectId: string;
			source: ProductionRecipeSource;
			title: string;
		}
	) => Promise<ProductionRecipe | null>;
	get: (
		userId: string,
		projectId: string,
		recipeId: string
	) => Promise<ProductionRecipe | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<ProductionRecipe[] | null>;
}

const placeholderPattern = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

/**
 * Checks the relations between the skeleton and its fields. Returns the first
 * problem as a user-facing message, or null when the content is consistent.
 */
export function validateProductionRecipeContent(
	content: ProductionRecipeContent
): string | null {
	const keys = new Set<string>();
	for (const field of content.fields) {
		if (keys.has(field.key)) {
			return `Field "${field.key}" is listed more than once.`;
		}
		keys.add(field.key);
		if (field.mode === "fixed" && field.value === null) {
			return `Fixed field "${field.key}" needs a value.`;
		}
		if (field.mode === "fill_in" && field.value !== null) {
			return `Fill-in field "${field.key}" is filled in at each use, so it carries no value.`;
		}
	}
	for (const match of content.instructionSkeleton.matchAll(
		placeholderPattern
	)) {
		const [, key] = match;
		if (key && !keys.has(key)) {
			return `The instruction skeleton uses the placeholder {{${key}}}, which is not a defined field.`;
		}
	}
	return null;
}

function joinConstraints(values: string[]) {
	return values.length > 0 ? values.join("\n") : null;
}

/**
 * Turns the Generation Package of a selected trial into an editable recipe
 * draft. Preserve and avoid constraints become fixed fields; the task and the
 * change constraints stay fill-in so a new use supplies its own. Reference
 * roles keep their role and intent but drop the asset version or file, and the
 * trial's old task text is never copied into a fill-in field.
 */
export function deriveProductionRecipeContent(
	generationPackage: GenerationPackage
): ProductionRecipeContent {
	const fields: ProductionRecipeContent["fields"] = [
		{ key: "target_task", label: "Target task", mode: "fill_in", value: null },
		{
			key: "change_constraints",
			label: "Change",
			mode: "fill_in",
			value: null,
		},
	];
	const preserve = joinConstraints(generationPackage.preserveConstraints);
	if (preserve) {
		fields.push({
			key: "preserve_constraints",
			label: "Preserve",
			mode: "fixed",
			value: preserve,
		});
	}
	const avoid = joinConstraints(generationPackage.avoidConstraints);
	if (avoid) {
		fields.push({
			key: "avoid_constraints",
			label: "Avoid",
			mode: "fixed",
			value: avoid,
		});
	}
	return {
		expectedOutputStructure: generationPackage.expectedOutputStructure,
		fields,
		instructionSkeleton: fields
			.map((field) => `${field.label}: {{${field.key}}}`)
			.join("\n"),
		referenceRoles: generationPackage.referenceRoles.map((reference) => ({
			customPurpose: reference.customPurpose?.trim() || null,
			forbiddenFeatures: reference.forbiddenFeatures,
			notes: reference.notes?.trim() || null,
			role: reference.role,
			transferredFeatures: reference.transferredFeatures,
		})),
	};
}
