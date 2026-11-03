import { z } from "zod";
import {
	referenceFeatureSchema,
	referenceRoleSchema,
} from "./asset-record-tracking";
import type {
	GenerationPackage,
	GenerationPackageCreateInput,
} from "./generation-packages";
import { generationPackageCreateInputSchema } from "./generation-packages";
import type { ReferenceTransferConstraintSet } from "./reference-production";
import { analyzeReferenceTransferConstraints } from "./reference-production";

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

const fillInValuesSchema = z.record(
	z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
	z.string().max(2000)
);

/** Prepares a new Generation Package from a recipe version in the same project. */
export const productionRecipeUseInputSchema = z
	.object({
		assetRecordId: idSchema,
		// Omitted: the latest version at the time of use.
		versionNumber: z.number().int().positive().optional(),
		fillIns: fillInValuesSchema,
		lockedUnitVersionIds: z.array(idSchema).max(100).default([]),
		projectId: idSchema,
		recipeId: idSchema,
		targetDimensions: generationPackageCreateInputSchema.shape.targetDimensions,
	})
	.strict();

/** Copies the latest version of a recipe into another project as version 1. */
export const productionRecipeCopyInputSchema = z
	.object({
		recipeId: idSchema,
		sourceProjectId: idSchema,
		targetProjectId: idSchema,
		title: titleSchema.optional(),
	})
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

const constraintFieldKeys = {
	avoid: "avoid_constraints",
	change: "change_constraints",
	preserve: "preserve_constraints",
} as const;

function splitConstraints(value: string | undefined) {
	const lines = (value ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	return [...new Set(lines)];
}

export type ProductionRecipeUseResult =
	| { kind: "ready"; input: GenerationPackageCreateInput }
	| { kind: "invalid"; message: string };

/**
 * Resolves the fields of a recipe version against the values supplied at use
 * time and builds the Generation Package request. Fixed fields keep their
 * recipe value, every fill-in field must be supplied now, and nothing from the
 * experiment the recipe came from is read.
 */
export function buildProductionRecipeUse(
	content: ProductionRecipeContent,
	use: {
		assetRecordId: string;
		fillIns: Record<string, string>;
		lockedUnitVersionIds: string[];
		projectId: string;
		targetDimensions: GenerationPackageCreateInput["targetDimensions"];
	}
): ProductionRecipeUseResult {
	const known = new Set(content.fields.map((field) => field.key));
	for (const key of Object.keys(use.fillIns)) {
		if (!known.has(key)) {
			return { kind: "invalid", message: `Unknown field "${key}".` };
		}
	}
	const values: Record<string, string> = {};
	const missing: string[] = [];
	for (const field of content.fields) {
		if (field.mode === "fixed") {
			if (field.key in use.fillIns) {
				return {
					kind: "invalid",
					message: `Field "${field.key}" is fixed in this recipe and cannot be replaced at use time.`,
				};
			}
			values[field.key] = field.value ?? "";
			continue;
		}
		const supplied = use.fillIns[field.key]?.trim();
		if (supplied) {
			values[field.key] = supplied;
		} else {
			missing.push(field.key);
		}
	}
	if (missing.length > 0) {
		return {
			kind: "invalid",
			message: `Fill in these fields to use the recipe: ${missing.join(", ")}.`,
		};
	}
	// One pass, so a supplied value containing {{...}} is never expanded again.
	const targetTask = content.instructionSkeleton.replace(
		placeholderPattern,
		(_match, key: string) => values[key] ?? ""
	);
	const parsed = generationPackageCreateInputSchema.safeParse({
		assetRecordId: use.assetRecordId,
		avoidConstraints: splitConstraints(values[constraintFieldKeys.avoid]),
		changeConstraints: splitConstraints(values[constraintFieldKeys.change]),
		expectedOutputStructure: content.expectedOutputStructure,
		lockedUnitVersionIds: use.lockedUnitVersionIds,
		preserveConstraints: splitConstraints(values[constraintFieldKeys.preserve]),
		projectId: use.projectId,
		targetDimensions: use.targetDimensions,
		targetTask,
	});
	if (!parsed.success) {
		return {
			kind: "invalid",
			message: `The filled-in recipe does not make a valid Generation Package: ${parsed.error.issues
				.map((issue) => issue.message)
				.join("; ")}`,
		};
	}
	return { kind: "ready", input: parsed.data };
}

export interface ProductionRecipeRoleCheck {
	conflictFeatures: string[];
	missingRoles: string[];
}

/**
 * Compares the roles a recipe expects with the references selected on the
 * target Asset Record. A role without a selected reference is missing (the
 * user selects it separately); a recipe role that allows what a selected
 * reference forbids, or the reverse, is a rule conflict.
 */
export function checkProductionRecipeRoles(
	recipeRoles: ProductionRecipeContent["referenceRoles"],
	selected: (ReferenceTransferConstraintSet & { role: string })[]
): ProductionRecipeRoleCheck {
	const missingRoles = [
		...new Set(
			recipeRoles
				.filter(
					(expected) => !selected.some((entry) => entry.role === expected.role)
				)
				.map((expected) => expected.role)
		),
	];
	const analysis = analyzeReferenceTransferConstraints([
		...selected,
		...recipeRoles.map((expected, index) => ({
			forbiddenFeatures: expected.forbiddenFeatures,
			id: `recipe-role-${index}`,
			transferredFeatures: expected.transferredFeatures,
		})),
	]);
	return {
		conflictFeatures: analysis.conflicts.map((conflict) => conflict.feature),
		missingRoles,
	};
}

/** Builds the independent copy: only the skeleton, roles, output structure and fields travel. */
export function copyProductionRecipeContent(
	content: ProductionRecipeContent
): ProductionRecipeContent {
	return productionRecipeContentSchema.parse(content);
}
