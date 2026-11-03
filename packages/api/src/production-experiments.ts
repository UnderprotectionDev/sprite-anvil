import { z } from "zod";
import { assetVersionReviewDispositionSchema } from "./asset-versions";
import type { GenerationPackage } from "./generation-packages";
import { generationPackageSchema } from "./generation-packages";
import {
	productionExperimentComparedInputs,
	productionExperimentOutcomes,
	productionExperimentSeparabilities,
	productionExperimentTrialSchema,
} from "./production-experiment-trials";
import { contextRuleChangeSchema } from "./project-context";
import { providerGenerationRecordSchema } from "./provider-generation-records";

export type JsonValue = z.infer<ReturnType<typeof z.json>>;

const idSchema = z.uuid();
const labelSchema = z.string().trim().min(1).max(120);
const noteSchema = z.string().trim().min(1).max(2000);

export const productionExperimentOutcomeSchema = z.enum(
	productionExperimentOutcomes
);

export const productionExperimentComparedInputSchema = z.enum(
	productionExperimentComparedInputs
);

export const productionExperimentConclusionSchema = z
	.object({
		concludedAt: z.iso.datetime(),
		note: noteSchema.nullable(),
		outcome: productionExperimentOutcomeSchema,
		selectedTrialId: idSchema.nullable(),
	})
	.strict();

export const productionExperimentSchema = z
	.object({
		assetRecordId: idSchema,
		conclusion: productionExperimentConclusionSchema.nullable(),
		createdAt: z.iso.datetime(),
		id: idSchema,
		projectId: idSchema,
		title: labelSchema,
		trials: z.array(productionExperimentTrialSchema).min(2).max(20),
	})
	.strict();

export const productionExperimentCreateInputSchema = z
	.object({
		assetRecordId: idSchema,
		projectId: idSchema,
		title: labelSchema,
		trials: z
			.array(
				z
					.object({
						assetVersionId: idSchema,
						generationPackageId: idSchema,
						label: labelSchema,
					})
					.strict()
			)
			.min(2)
			.max(20),
	})
	.strict();

export const productionExperimentListInputSchema = z
	.object({ assetRecordId: idSchema, projectId: idSchema })
	.strict();

export const productionExperimentGetInputSchema = z
	.object({ experimentId: idSchema, projectId: idSchema })
	.strict();

export const productionExperimentConcludeInputSchema = z
	.object({
		experimentId: idSchema,
		note: noteSchema.optional(),
		outcome: productionExperimentOutcomeSchema,
		projectId: idSchema,
		selectedTrialId: idSchema.optional(),
	})
	.strict()
	.superRefine((input, context) => {
		if (input.outcome === "selection_made" && !input.selectedTrialId) {
			context.addIssue({
				code: "custom",
				message: "Selection Made needs the selected trial.",
				path: ["selectedTrialId"],
			});
		}
		if (input.outcome !== "selection_made" && input.selectedTrialId) {
			context.addIssue({
				code: "custom",
				message: "Only Selection Made names a selected trial.",
				path: ["selectedTrialId"],
			});
		}
	});

// The user authors the rule change (`changes`, `summary`, and the base
// revision it was written against): an experiment shows what differed, never
// which rule to adopt, so the Context Proposal needs a rule change the user
// wrote. The experiment only supplies the evidence in the proposal source.
export const productionExperimentLearningInputSchema = z
	.object({
		baseContextRevisionId: idSchema,
		changes: z.array(contextRuleChangeSchema).min(1).max(50),
		comment: noteSchema,
		experimentId: idSchema,
		projectId: idSchema,
		summary: z.string().trim().min(1).max(240),
		// Widening beyond the narrowest meaningful scope is the user's decision.
		widenScope: z.boolean().default(false),
	})
	.strict();

export const productionExperimentComparisonStatusSchema = z.enum([
	"same",
	"different",
	"not_provided",
]);

export const productionExperimentComparisonSchema = z
	.object({
		causeCanBeSeparated: z.boolean(),
		separability: z.enum(productionExperimentSeparabilities),
		changedInputs: z.array(productionExperimentComparedInputSchema),
		inputs: z.array(
			z
				.object({
					input: productionExperimentComparedInputSchema,
					status: productionExperimentComparisonStatusSchema,
					trials: z.array(
						z.object({ trialId: idSchema, value: z.json().nullable() }).strict()
					),
				})
				.strict()
		),
		statement: z.string(),
	})
	.strict();

export const productionExperimentDetailSchema = productionExperimentSchema
	.omit({ trials: true })
	.extend({
		comparison: productionExperimentComparisonSchema,
		trials: z.array(
			productionExperimentTrialSchema
				.extend({
					candidateVersion: z
						.object({
							id: idSchema,
							providerGenerationRecord:
								providerGenerationRecordSchema.nullable(),
							reviewDisposition: assetVersionReviewDispositionSchema,
							versionNumber: z.number().int().positive(),
						})
						.strict(),
					generationPackage: generationPackageSchema,
				})
				.strict()
		),
	})
	.strict();

export type ProductionExperiment = z.infer<typeof productionExperimentSchema>;
export type ProductionExperimentComparison = z.infer<
	typeof productionExperimentComparisonSchema
>;
export type ProductionExperimentComparisonStatus = z.infer<
	typeof productionExperimentComparisonStatusSchema
>;
export type ProductionExperimentCreateInput = z.infer<
	typeof productionExperimentCreateInputSchema
>;
export type ProductionExperimentOutcome = z.infer<
	typeof productionExperimentOutcomeSchema
>;

export type ProductionExperimentConcludeResult =
	| { kind: "concluded"; experiment: ProductionExperiment }
	| { kind: "already-concluded" }
	| { kind: "trial-not-found" }
	// The selected trial vanished between the pre-check and the write.
	| { kind: "trial-changed" };

export interface ProductionExperimentStore {
	conclude: (
		userId: string,
		input: {
			experimentId: string;
			note: string | null;
			outcome: ProductionExperimentOutcome;
			projectId: string;
			selectedTrialId: string | null;
		}
	) => Promise<ProductionExperimentConcludeResult | null>;
	create: (
		userId: string,
		input: ProductionExperimentCreateInput
	) => Promise<ProductionExperiment | null>;
	get: (
		userId: string,
		projectId: string,
		experimentId: string
	) => Promise<ProductionExperiment | null>;
	list: (
		userId: string,
		projectId: string,
		assetRecordId: string
	) => Promise<ProductionExperiment[] | null>;
}

export interface ComparableTrial {
	generationPackage: GenerationPackage;
	providerParameters: JsonValue | null;
	trialId: string;
}

const inputLabels: Record<
	(typeof productionExperimentComparedInputs)[number],
	string
> = {
	context: "context",
	instruction: "instruction",
	master_design: "Master Design",
	output_structure: "output structure",
	provider_parameters: "provider parameters",
	reference: "reference",
	target_measure: "target measure",
};

function stableJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableJson).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

// A record keyed by every compared input keeps the picker exhaustive.
const inputPickers: Record<
	(typeof productionExperimentComparedInputs)[number],
	(trial: ComparableTrial) => JsonValue
> = {
	context: (trial) => trial.generationPackage.productionContextSnapshot,
	instruction: ({ generationPackage }) => ({
		avoidConstraints: generationPackage.avoidConstraints,
		changeConstraints: generationPackage.changeConstraints,
		lockedUnits: generationPackage.lockedUnits,
		preserveConstraints: generationPackage.preserveConstraints,
		targetTask: generationPackage.targetTask,
	}),
	master_design: (trial) => trial.generationPackage.canonicalDesign,
	output_structure: (trial) => trial.generationPackage.expectedOutputStructure,
	provider_parameters: (trial) => trial.providerParameters,
	reference: (trial) => trial.generationPackage.referenceRoles,
	target_measure: (trial) => trial.generationPackage.targetDimensions,
};

function describeComparison(
	changedInputs: (typeof productionExperimentComparedInputs)[number][]
) {
	const names = changedInputs.map((input) => inputLabels[input]);
	if (names.length === 0) {
		return "No recorded input differs between these trials.";
	}
	if (names.length === 1) {
		return `Only the ${names[0]} differs between these trials. This shows what changed, not proof that it explains any difference in the results.`;
	}
	return `More than one input differs (${names.join(", ")}). The cause of any difference in the results cannot be separated.`;
}

/**
 * Compares the pinned inputs of the trials. Provider parameters are compared
 * only when a trial has them; a trial without them is shown as unprovided and
 * counts as different from a trial that has them. The result never claims a
 * cause: it only reports which recorded inputs differ.
 */
export function compareProductionExperimentTrials(
	trials: ComparableTrial[]
): ProductionExperimentComparison {
	const inputs = productionExperimentComparedInputs.map((input) => {
		const values = trials.map((trial) => ({
			trialId: trial.trialId,
			value: inputPickers[input](trial),
		}));
		const distinct = new Set(values.map((entry) => stableJson(entry.value)));
		let status: ProductionExperimentComparisonStatus = "same";
		if (input === "provider_parameters" && distinct.size === 1) {
			status = values.every((entry) => entry.value === null)
				? "not_provided"
				: "same";
		} else if (distinct.size > 1) {
			status = "different";
		}
		return { input, status, trials: values };
	});
	const changedInputs = inputs
		.filter((entry) => entry.status === "different")
		.map((entry) => entry.input);
	let separability: ProductionExperimentComparison["separability"] =
		"several_changed";
	if (changedInputs.length === 0) {
		separability = "none_changed";
	} else if (changedInputs.length === 1) {
		separability = "single_changed";
	}
	return {
		causeCanBeSeparated: separability === "single_changed",
		separability,
		changedInputs,
		inputs,
		statement: describeComparison(changedInputs),
	};
}
