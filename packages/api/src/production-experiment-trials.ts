import { z } from "zod";

/**
 * Shared vocabulary of Production Experiments. It lives apart from
 * production-experiments.ts because project-context.ts (the Context Proposal
 * source) and production-experiments.ts import each other's schemas.
 */
export const productionExperimentComparedInputs = [
	"context",
	"master_design",
	"reference",
	"instruction",
	"target_measure",
	"output_structure",
	"provider_parameters",
] as const;

export const productionExperimentOutcomes = [
	"selection_made",
	"inconclusive",
	"abandoned",
] as const;

export const productionExperimentTrialSchema = z
	.object({
		assetVersionId: z.uuid(),
		createdAt: z.iso.datetime(),
		generationPackageId: z.uuid(),
		id: z.uuid(),
		label: z.string().trim().min(1).max(120),
		position: z.number().int().nonnegative(),
	})
	.strict();
