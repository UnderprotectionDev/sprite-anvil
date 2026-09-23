import { z } from "zod";

const identifierSchema = z
	.string()
	.trim()
	.min(1)
	.max(128)
	.regex(
		/^[a-z][a-z0-9._-]*$/,
		"Use lowercase letters, numbers, dots, underscores, or hyphens."
	);

export const STRUCTURED_CONTEXT_RULE_IDS = [
	"perspective",
	"camera.approach",
	"palette",
	"outline",
	"outline.width",
	"shading",
	"light.direction",
	"detail.density",
	"material.language",
	"motif.allowed",
	"motif.avoided",
] as const;

export const STRUCTURED_CONTEXT_RULES = {
	perspective: { valueType: "text" },
	"camera.approach": { valueType: "text" },
	palette: { valueType: "text_list" },
	outline: { valueType: "text" },
	"outline.width": { valueType: "number" },
	shading: { valueType: "text" },
	"light.direction": { valueType: "text" },
	"detail.density": { valueType: "text" },
	"material.language": { valueType: "text" },
	"motif.allowed": { valueType: "text_list" },
	"motif.avoided": { valueType: "text_list" },
} as const satisfies Record<
	(typeof STRUCTURED_CONTEXT_RULE_IDS)[number],
	{ valueType: "text" | "number" | "boolean" | "text_list" }
>;

export type StructuredContextRuleId =
	(typeof STRUCTURED_CONTEXT_RULE_IDS)[number];

const contextScopeSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("project"), id: z.string().uuid() }).strict(),
	z
		.object({ kind: z.literal("visual_world"), id: z.string().min(1).max(128) })
		.strict(),
	z
		.object({ kind: z.literal("theme"), id: z.string().min(1).max(128) })
		.strict(),
	z
		.object({ kind: z.literal("asset_family"), id: z.string().min(1).max(128) })
		.strict(),
	z
		.object({ kind: z.literal("asset"), id: z.string().min(1).max(128) })
		.strict(),
	z
		.object({ kind: z.literal("operation"), id: z.string().min(1).max(128) })
		.strict(),
]);

const contextRuleValueSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("text"),
			value: z.string().trim().min(1).max(2000),
		})
		.strict(),
	z.object({ type: z.literal("number"), value: z.number().finite() }).strict(),
	z.object({ type: z.literal("boolean"), value: z.boolean() }).strict(),
	z
		.object({
			type: z.literal("text_list"),
			value: z.array(z.string().trim().min(1).max(300)).min(1).max(100),
		})
		.strict(),
]);

const contextRuleSourceSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("project_setup") }).strict(),
	z
		.object({
			kind: z.literal("context_proposal"),
			proposalId: z.string().uuid(),
		})
		.strict(),
]);

export const contextRuleSchema = z
	.object({
		contractVersion: z.literal("context-rule/1.0.0"),
		id: identifierSchema,
		scope: contextScopeSchema,
		value: contextRuleValueSchema,
		source: contextRuleSourceSchema,
		rationale: z.string().trim().min(1).max(2000),
		createdAt: z.string().datetime(),
		supersedesRuleId: identifierSchema.optional(),
		precedenceChain: z.array(contextScopeSchema).min(1).max(6),
	})
	.strict();

export const contextRevisionSchema = z
	.object({
		id: z.string().uuid(),
		projectId: z.string().uuid(),
		revisionNumber: z.number().int().nonnegative(),
		ruleContractVersion: z.literal("context-rule/1.0.0"),
		isActive: z.boolean(),
		rules: z.array(contextRuleSchema),
		createdAt: z.string().datetime(),
	})
	.strict();

export const projectContextSchema = z
	.object({
		id: z.string().uuid(),
		name: z.string().trim().min(1).max(120),
		generalArtDirection: z.string().trim().min(1).max(1000),
		currentContextRevision: contextRevisionSchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const projectContextCreateInputSchema = z
	.object({
		name: z.string().trim().min(1).max(120),
		generalArtDirection: z.string().trim().min(1).max(1000),
	})
	.strict();

const evidenceSchema = z
	.object({
		kind: z.enum(["user_decision", "observed_change"]),
		statement: z.string().trim().min(1).max(1000),
	})
	.strict();

const sharedChangeFields = {
	ruleId: identifierSchema,
	scope: contextScopeSchema,
	rationale: z.string().trim().min(1).max(2000),
	evidence: z.array(evidenceSchema).min(1).max(20),
};

export const contextRuleChangeSchema = z.discriminatedUnion("operation", [
	z
		.object({
			operation: z.literal("add"),
			...sharedChangeFields,
			value: contextRuleValueSchema,
		})
		.strict(),
	z
		.object({
			operation: z.literal("replace"),
			...sharedChangeFields,
			value: contextRuleValueSchema,
		})
		.strict(),
	z.object({ operation: z.literal("remove"), ...sharedChangeFields }).strict(),
]);

export const contextProposalInputSchema = z
	.object({
		projectId: z.string().uuid(),
		baseContextRevisionId: z.string().uuid(),
		summary: z.string().trim().min(1).max(240),
		changes: z.array(contextRuleChangeSchema).min(1).max(50),
	})
	.strict()
	.superRefine((input, context) => {
		input.changes.forEach((change, index) => {
			const rule =
				STRUCTURED_CONTEXT_RULES[change.ruleId as StructuredContextRuleId];
			if (!rule) {
				context.addIssue({
					code: "custom",
					path: ["changes", index, "ruleId"],
					message:
						"Structured controls can only propose common Project Context rules.",
				});
				return;
			}

			if (
				change.scope.kind !== "project" ||
				change.scope.id !== input.projectId
			) {
				context.addIssue({
					code: "custom",
					path: ["changes", index, "scope"],
					message:
						"Structured controls can only propose rules for this Project Context.",
				});
			}

			if (
				change.operation !== "remove" &&
				change.value.type !== rule.valueType
			) {
				context.addIssue({
					code: "custom",
					path: ["changes", index, "value", "type"],
					message: `The ${change.ruleId} rule requires a ${rule.valueType} value.`,
				});
			}
		});
	});

export const contextProposalConflictSchema = z
	.object({
		code: z.enum([
			"duplicate_change",
			"existing_rule",
			"missing_base_rule",
			"scope_mismatch",
			"project_scope_mismatch",
		]),
		ruleId: identifierSchema,
		message: z.string().min(1),
	})
	.strict();

export const contextProposalSourceSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("structured_control"),
			controlId: z.literal("context-proposal-form"),
			controlVersion: z.literal("1.0.0"),
		})
		.strict(),
	z
		.object({
			kind: z.literal("agent"),
			agentId: z.string().min(1).max(128),
			modelId: z.string().min(1).max(128),
		})
		.strict(),
]);

export const contextProposalSchema = z
	.object({
		id: z.string().uuid(),
		projectId: z.string().uuid(),
		baseContextRevisionId: z.string().uuid(),
		contractVersion: z.literal("context-agent/1.0.0"),
		ruleContractVersion: z.literal("context-rule/1.0.0"),
		summary: z.string().min(1).max(240),
		source: contextProposalSourceSchema,
		changes: z.array(contextRuleChangeSchema).min(1).max(50),
		validation: z
			.object({
				isValid: z.boolean(),
				checkedAt: z.string().datetime(),
				conflicts: z.array(contextProposalConflictSchema),
			})
			.strict(),
		activationAllowed: z.literal(false),
		createdAt: z.string().datetime(),
	})
	.strict();

export const contextProposalListInputSchema = z
	.object({ projectId: z.string().uuid() })
	.strict();

export type ContextRule = z.infer<typeof contextRuleSchema>;
export type ContextRevision = z.infer<typeof contextRevisionSchema>;
export type ProjectContext = z.infer<typeof projectContextSchema>;
export type ProjectContextCreateInput = z.infer<
	typeof projectContextCreateInputSchema
>;
export type ContextRuleValue = z.infer<typeof contextRuleValueSchema>;
export type ContextRuleChange = z.infer<typeof contextRuleChangeSchema>;
export type ContextProposalInput = z.infer<typeof contextProposalInputSchema>;
export type ContextProposalConflict = z.infer<
	typeof contextProposalConflictSchema
>;
export type ContextProposal = z.infer<typeof contextProposalSchema>;

export interface ProjectContextStore {
	createProject: (
		userId: string,
		input: ProjectContextCreateInput
	) => Promise<ProjectContext>;
	createProposal: (userId: string, proposal: ContextProposal) => Promise<void>;
	getRevision: (
		userId: string,
		projectId: string,
		revisionId: string
	) => Promise<ContextRevision | null>;
	listProjects: (userId: string) => Promise<ProjectContext[]>;
	listProposals: (
		userId: string,
		projectId: string
	) => Promise<ContextProposal[]>;
}

export function validateContextProposal(
	projectId: string,
	baseRevision: ContextRevision,
	changes: ContextRuleChange[],
	checkedAt: string
) {
	const conflicts: ContextProposalConflict[] = [];
	const seenRuleIds = new Set<string>();
	const baseRules = new Map(baseRevision.rules.map((rule) => [rule.id, rule]));

	for (const change of changes) {
		if (seenRuleIds.has(change.ruleId)) {
			conflicts.push({
				code: "duplicate_change",
				ruleId: change.ruleId,
				message: "A rule can appear only once in a proposal.",
			});
			continue;
		}
		seenRuleIds.add(change.ruleId);

		if (change.scope.kind === "project" && change.scope.id !== projectId) {
			conflicts.push({
				code: "project_scope_mismatch",
				ruleId: change.ruleId,
				message: "Project-scoped rules must use the proposal's project.",
			});
		}

		const baseRule = baseRules.get(change.ruleId);
		if (change.operation === "add") {
			if (baseRule) {
				conflicts.push({
					code: "existing_rule",
					ruleId: change.ruleId,
					message: "This rule already exists in the base Context Revision.",
				});
			}
			continue;
		}

		if (!baseRule) {
			conflicts.push({
				code: "missing_base_rule",
				ruleId: change.ruleId,
				message:
					"The rule to change is not present in the base Context Revision.",
			});
			continue;
		}

		if (
			baseRule.scope.kind !== change.scope.kind ||
			baseRule.scope.id !== change.scope.id
		) {
			conflicts.push({
				code: "scope_mismatch",
				ruleId: change.ruleId,
				message:
					"The proposed scope does not match the rule in the base Context Revision.",
			});
		}
	}

	return { isValid: conflicts.length === 0, checkedAt, conflicts };
}
