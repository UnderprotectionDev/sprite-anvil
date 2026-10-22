import { contextScopeSchema } from "@sprite-anvil/api/project-context";
import z from "zod";

export const projectSetupFormSchema = z.object({
	name: z.string().min(1),
	generalArtDirection: z.string().min(1),
});

export const proposalChangeDraftSchema = z
	.object({
		evidence: z.string().min(1),
		evidenceKind: z.enum(["user_decision", "observed_change"]),
		id: z.string(),
		isOverride: z.boolean(),
		operation: z.enum(["add", "replace", "remove"]),
		precedenceChain: z.array(contextScopeSchema),
		rationale: z.string().min(1),
		ruleId: z.string().min(1),
		scope: contextScopeSchema,
		value: z.string(),
	})
	.refine(
		(change) => change.operation === "remove" || change.value.length > 0,
		{
			path: ["value"],
		}
	);

export const proposalFormSchema = z.object({
	summary: z.string().min(1),
	changes: z.array(proposalChangeDraftSchema).min(1),
});

export type ProjectSetupFormValues = z.input<typeof projectSetupFormSchema>;
export type ProposalChangeDraft = z.input<typeof proposalChangeDraftSchema>;
export type ProposalFormValues = z.input<typeof proposalFormSchema>;
