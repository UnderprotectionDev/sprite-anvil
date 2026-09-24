import { z } from "zod";
import type { ProjectContextScopeCatalog } from "./context-scopes";

const identifierSchema = z
	.string()
	.trim()
	.min(1)
	.max(128)
	.regex(
		/^[a-z][a-z0-9._-]*$/,
		"Küçük harf, sayı, nokta, alt çizgi veya tire kullanın."
	);

const projectIdSchema = z.string().trim().min(1).max(128);

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

export const contextScopeSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("project"), id: projectIdSchema }).strict(),
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

export type ContextScope = z.infer<typeof contextScopeSchema>;

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
		projectId: projectIdSchema,
		revisionNumber: z.number().int().nonnegative(),
		sourceProposalId: z.string().uuid().nullable(),
		ruleContractVersion: z.literal("context-rule/1.0.0"),
		isActive: z.boolean(),
		rules: z.array(contextRuleSchema),
		createdAt: z.string().datetime(),
	})
	.strict();

export const projectContextSchema = z
	.object({
		id: projectIdSchema,
		name: z.string().trim().min(1).max(120),
		generalArtDirection: z.string().trim().max(1000),
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
	supersedesRuleId: identifierSchema.nullable().optional(),
	precedenceChain: z.array(contextScopeSchema).min(1).max(6).optional(),
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
		projectId: projectIdSchema,
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
						"Yapılandırılmış kontroller yalnızca yaygın Proje Bağlamı kurallarını önerebilir.",
				});
				return;
			}

			if (
				change.scope.kind === "project" &&
				change.scope.id !== input.projectId
			) {
				context.addIssue({
					code: "custom",
					path: ["changes", index, "scope"],
					message:
						"Proje kapsamındaki kurallar önerinin projesini kullanmalıdır.",
				});
			}

			if (change.scope.kind !== "project" && !change.precedenceChain) {
				context.addIssue({
					code: "custom",
					path: ["changes", index, "precedenceChain"],
					message:
						"Daha dar kapsamlı kurallar gerçek üst kayıtlarını içeren bir öncelik zinciri taşımalıdır.",
				});
			}

			if (
				change.operation !== "remove" &&
				change.value.type !== rule.valueType
			) {
				context.addIssue({
					code: "custom",
					path: ["changes", index, "value", "type"],
					message: `${change.ruleId} kuralı ${rule.valueType} türünde bir değer gerektirir.`,
				});
			}
		});
	});

export const contextProposalConflictSchema = z
	.object({
		code: z.enum([
			"duplicate_change",
			"same_scope_contradiction",
			"existing_rule",
			"missing_base_rule",
			"scope_mismatch",
			"project_scope_mismatch",
			"invalid_context_rule",
			"invalid_precedence_chain",
			"missing_context_override",
			"invalid_context_override",
			"unresolved_reference",
			"stale_rule_conflict",
			"invalid_base_revision",
		]),
		ruleId: identifierSchema,
		message: z.string().min(1),
	})
	.strict();

export const contextProposalReviewSchema = z
	.object({
		proposalId: z.string().uuid(),
		baseContextRevisionId: z.string().uuid(),
		baseRevisionNumber: z.number().int().nonnegative(),
		currentRevisionId: z.string().uuid(),
		currentRevisionNumber: z.number().int().nonnegative(),
		targetRevisionNumber: z.number().int().positive(),
		activatedRevisionNumber: z.number().int().positive().nullable(),
		isRebased: z.boolean(),
		activationAllowed: z.boolean(),
		checkedAt: z.string().datetime(),
		conflicts: z.array(contextProposalConflictSchema),
		candidateRules: z.array(contextRuleSchema),
		contextCopy: z.string(),
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
		projectId: projectIdSchema,
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
	.object({ projectId: projectIdSchema })
	.strict();

export const contextProposalReviewInputSchema = z
	.object({
		projectId: projectIdSchema,
		proposalId: z.string().uuid(),
	})
	.strict();

export const contextProposalActivationInputSchema = z
	.object({
		projectId: projectIdSchema,
		proposalId: z.string().uuid(),
		expectedCurrentRevisionId: z.string().uuid(),
	})
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
export type ContextProposalReview = z.infer<typeof contextProposalReviewSchema>;

export interface ProjectContextStore {
	activateProposal: (input: {
		userId: string;
		projectId: string;
		proposalId: string;
		expectedCurrentRevisionId: string;
		ruleContractVersion: ContextRevision["ruleContractVersion"];
		rules: ContextRule[];
	}) => Promise<ContextRevision | null>;
	createProject: (
		userId: string,
		input: ProjectContextCreateInput
	) => Promise<ProjectContext>;
	createProposal: (userId: string, proposal: ContextProposal) => Promise<void>;
	getProposal: (
		userId: string,
		projectId: string,
		proposalId: string
	) => Promise<ContextProposal | null>;
	getRevision: (
		userId: string,
		projectId: string,
		revisionId: string
	) => Promise<ContextRevision | null>;
	getRevisionByProposal: (
		userId: string,
		projectId: string,
		proposalId: string
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
	checkedAt: string,
	scopeCatalog: ProjectContextScopeCatalog = { visualWorlds: [], themes: [] }
) {
	const conflicts: ContextProposalConflict[] = [];
	const seenRuleKeys = new Set<string>();
	const baseRules = new Map(
		baseRevision.rules.map((rule) => [
			contextRuleKey(rule.id, rule.scope),
			rule,
		])
	);

	for (const change of changes) {
		const key = contextRuleKey(change.ruleId, change.scope);
		if (seenRuleKeys.has(key)) {
			conflicts.push({
				code: "duplicate_change",
				ruleId: change.ruleId,
				message:
					"Aynı kapsamda bir kural öneride yalnızca bir kez yer alabilir.",
			});
			continue;
		}
		seenRuleKeys.add(key);
		conflicts.push(
			...validateContextProposalChange(
				projectId,
				baseRevision,
				change,
				baseRules.get(key),
				scopeCatalog
			)
		);
	}
	const validationProposal: ContextProposal = {
		id: "00000000-0000-4000-8000-000000000000",
		projectId,
		baseContextRevisionId: baseRevision.id,
		contractVersion: "context-agent/1.0.0",
		ruleContractVersion: baseRevision.ruleContractVersion,
		summary: "Validation preview",
		source: {
			kind: "structured_control",
			controlId: "context-proposal-form",
			controlVersion: "1.0.0",
		},
		changes,
		validation: { isValid: false, checkedAt, conflicts: [] },
		activationAllowed: false,
		createdAt: checkedAt,
	};
	conflicts.push(
		...validateContextRules(
			projectId,
			applyContextProposal(projectId, baseRevision.rules, validationProposal),
			scopeCatalog
		)
	);
	const unique = uniqueConflicts(conflicts);
	return { isValid: unique.length === 0, checkedAt, conflicts: unique };
}

function validateContextProposalChange(
	projectId: string,
	baseRevision: ContextRevision,
	change: ContextRuleChange,
	baseRule: ContextRule | undefined,
	scopeCatalog: ProjectContextScopeCatalog
) {
	const conflicts: ContextProposalConflict[] = [];
	if (change.scope.kind === "project" && change.scope.id !== projectId) {
		conflicts.push({
			code: "project_scope_mismatch",
			ruleId: change.ruleId,
			message: "Proje kapsamındaki kurallar önerinin projesini kullanmalıdır.",
		});
	}
	const precedenceChain = resolvePrecedenceChain(
		projectId,
		change.scope,
		change.precedenceChain,
		baseRule
	);
	const scopeConflict = validateScopeReference(
		projectId,
		change.ruleId,
		change.scope,
		precedenceChain,
		scopeCatalog
	);
	if (scopeConflict) {
		conflicts.push(scopeConflict);
	}
	if (change.operation === "add") {
		if (baseRule) {
			conflicts.push({
				code: "existing_rule",
				ruleId: change.ruleId,
				message: "Bu kural dayanak Bağlam Sürümü'nde zaten bulunuyor.",
			});
		}
		return conflicts;
	}
	if (!baseRule) {
		const sameRuleAtAnotherScope = baseRevision.rules.some(
			(rule) => rule.id === change.ruleId
		);
		conflicts.push({
			code: sameRuleAtAnotherScope ? "scope_mismatch" : "missing_base_rule",
			ruleId: change.ruleId,
			message: sameRuleAtAnotherScope
				? "Değiştirilecek kural dayanak Bağlam Sürümü'nde yalnızca başka bir kapsamda bulunuyor."
				: "Değiştirilecek kural dayanak Bağlam Sürümü'nde bulunmuyor.",
		});
	}
	return conflicts;
}

const scopeSpecificity = {
	operation: 0,
	asset: 1,
	asset_family: 2,
	theme: 3,
	visual_world: 4,
	project: 5,
} as const;

function contextScopeKey(scope: ContextRule["scope"]) {
	return `${scope.kind}:${scope.id}`;
}

function contextRuleKey(ruleId: string, scope: ContextRule["scope"]) {
	return `${ruleId}\u0000${contextScopeKey(scope)}`;
}

function sameScope(left: ContextRule["scope"], right: ContextRule["scope"]) {
	return left.kind === right.kind && left.id === right.id;
}

function scopeIsInChain(
	chain: ContextRule["precedenceChain"],
	scope: ContextRule["scope"]
) {
	return chain.some((entry) => sameScope(entry, scope));
}

function scopeChainsOverlap(
	leftScope: ContextRule["scope"],
	leftChain: ContextRule["precedenceChain"],
	rightScope: ContextRule["scope"],
	rightChain: ContextRule["precedenceChain"]
) {
	return (
		scopeIsInChain(leftChain, rightScope) ||
		scopeIsInChain(rightChain, leftScope)
	);
}

function resolvePrecedenceChain(
	projectId: string,
	scope: ContextRule["scope"],
	providedChain?: ContextRule["precedenceChain"],
	baseRule?: ContextRule
) {
	if (providedChain) {
		return providedChain;
	}
	if (baseRule) {
		return baseRule.precedenceChain;
	}
	return scope.kind === "project"
		? [scope]
		: [scope, { kind: "project" as const, id: projectId }];
}

function sameRuleMeaning(
	left: ContextRule | undefined,
	right: ContextRule | undefined
) {
	if (!(left && right)) {
		return left === right;
	}
	return (
		left.id === right.id &&
		sameScope(left.scope, right.scope) &&
		JSON.stringify(left.value) === JSON.stringify(right.value) &&
		left.supersedesRuleId === right.supersedesRuleId &&
		JSON.stringify(left.precedenceChain) ===
			JSON.stringify(right.precedenceChain)
	);
}

function proposedRule(
	projectId: string,
	change: ContextRuleChange,
	proposal: ContextProposal,
	baseRule?: ContextRule
): ContextRule | undefined {
	if (change.operation === "remove") {
		return undefined;
	}
	const precedenceChain = resolvePrecedenceChain(
		projectId,
		change.scope,
		change.precedenceChain,
		baseRule
	);
	const supersedesRuleId =
		change.supersedesRuleId === undefined
			? baseRule?.supersedesRuleId
			: change.supersedesRuleId;
	return {
		contractVersion: proposal.ruleContractVersion,
		id: change.ruleId,
		scope: change.scope,
		value: change.value,
		source: { kind: "context_proposal", proposalId: proposal.id },
		rationale: change.rationale,
		createdAt: proposal.createdAt,
		...(supersedesRuleId ? { supersedesRuleId } : {}),
		precedenceChain,
	};
}

function applyContextProposal(
	projectId: string,
	currentRules: ContextRule[],
	proposal: ContextProposal
) {
	const nextRules = [...currentRules];
	for (const change of proposal.changes) {
		const index = nextRules.findIndex(
			(rule) =>
				contextRuleKey(rule.id, rule.scope) ===
				contextRuleKey(change.ruleId, change.scope)
		);
		if (change.operation === "remove") {
			if (index >= 0) {
				nextRules.splice(index, 1);
			}
			continue;
		}
		const replacement = proposedRule(
			projectId,
			change,
			proposal,
			index >= 0 ? nextRules[index] : undefined
		);
		if (!replacement) {
			continue;
		}
		if (index >= 0) {
			nextRules[index] = replacement;
		} else {
			nextRules.push(replacement);
		}
	}
	return nextRules;
}

function validateContextRule(
	projectId: string,
	rule: ContextRule,
	rulesByKey: Map<string, ContextRule>
) {
	const conflicts: ContextProposalConflict[] = [];
	if (!contextRuleSchema.safeParse(rule).success) {
		return [
			{
				code: "invalid_context_rule" as const,
				ruleId: rule.id,
				message: "Bağlam Kuralı context-rule/1.0.0 sözleşmesine uymuyor.",
			},
		];
	}
	if (rule.scope.kind === "project" && rule.scope.id !== projectId) {
		conflicts.push({
			code: "project_scope_mismatch",
			ruleId: rule.id,
			message: "Proje kapsamındaki kurallar bu Projeyi kullanmalıdır.",
		});
	}

	const key = contextRuleKey(rule.id, rule.scope);
	if (rulesByKey.has(key)) {
		conflicts.push({
			code: "same_scope_contradiction",
			ruleId: rule.id,
			message: "Aynı Bağlam Kuralı aynı kapsamda birden fazla tanımlanmış.",
		});
	} else {
		rulesByKey.set(key, rule);
	}

	if (!hasValidPrecedenceChain(projectId, rule)) {
		conflicts.push({
			code: "invalid_precedence_chain",
			ruleId: rule.id,
			message:
				"Bağlam Kuralı öncelik zinciri kendi kapsamından başlayıp dar kapsamdan geniş kapsama ilerleyerek bu Projede bitmelidir.",
		});
	}
	return conflicts;
}

function hasValidPrecedenceChain(projectId: string, rule: ContextRule) {
	const chain = rule.precedenceChain;
	const [firstScope] = chain;
	const lastScope = chain.at(-1);
	const endsAtProject =
		lastScope?.kind === "project" && lastScope.id === projectId;
	const chainKeys = chain.map(contextScopeKey);
	const ranks = chain.map((scope) => scopeSpecificity[scope.kind]);
	const isOrdered = ranks.every((rank, index) => {
		const previousRank = ranks[index - 1];
		return index === 0 || (previousRank !== undefined && rank > previousRank);
	});
	const isUnique = new Set(chainKeys).size === chainKeys.length;
	const usesProjectRoot = chain.every(
		(scope) => scope.kind !== "project" || scope.id === projectId
	);
	return (
		firstScope !== undefined &&
		sameScope(firstScope, rule.scope) &&
		endsAtProject &&
		isOrdered &&
		isUnique &&
		usesProjectRoot
	);
}

function validateContextRuleOverrides(rule: ContextRule, rules: ContextRule[]) {
	const inheritedRules = findInheritedContextRules(
		rule.id,
		rule.scope,
		rule.precedenceChain,
		rules
	);
	const [nearestInheritedRule] = inheritedRules;
	const conflicts: ContextProposalConflict[] = [];
	if (
		nearestInheritedRule &&
		rule.supersedesRuleId !== nearestInheritedRule.id
	) {
		conflicts.push({
			code: "missing_context_override",
			ruleId: rule.id,
			message:
				"Daha dar kapsamlı Bağlam Kuralı devraldığı kuralı açıkça geçersiz kılmalıdır.",
		});
	}

	if (
		rule.supersedesRuleId &&
		!inheritedRules.some((candidate) => candidate.id === rule.supersedesRuleId)
	) {
		conflicts.push({
			code: "invalid_context_override",
			ruleId: rule.id,
			message:
				"Bağlam Kuralı İstisnası öncelik zincirindeki devralınan bir kurala bağlanmalıdır.",
		});
	}
	return conflicts;
}

export function findNearestInheritedContextRule(
	ruleId: string,
	scope: ContextScope,
	precedenceChain: ContextScope[],
	rules: ContextRule[]
) {
	return findInheritedContextRules(ruleId, scope, precedenceChain, rules)[0];
}

function findInheritedContextRules(
	ruleId: string,
	scope: ContextScope,
	precedenceChain: ContextScope[],
	rules: ContextRule[]
) {
	return rules
		.filter(
			(candidate) =>
				candidate.id === ruleId &&
				isInheritedBy(scope, precedenceChain, candidate.scope)
		)
		.sort(
			(left, right) =>
				scopeSpecificity[left.scope.kind] - scopeSpecificity[right.scope.kind]
		);
}

function isInheritedBy(
	scope: ContextScope,
	precedenceChain: ContextScope[],
	candidateScope: ContextScope
) {
	return (
		scopeSpecificity[candidateScope.kind] > scopeSpecificity[scope.kind] &&
		scopeIsInChain(precedenceChain, candidateScope)
	);
}

function validateContextRules(
	projectId: string,
	rules: ContextRule[],
	scopeCatalog: ProjectContextScopeCatalog
) {
	const conflicts: ContextProposalConflict[] = [];
	const rulesByKey = new Map<string, ContextRule>();
	for (const rule of rules) {
		conflicts.push(...validateContextRule(projectId, rule, rulesByKey));
		const scopeConflict = validateScopeReference(
			projectId,
			rule.id,
			rule.scope,
			rule.precedenceChain,
			scopeCatalog
		);
		if (scopeConflict) {
			conflicts.push(scopeConflict);
		}
	}
	for (const rule of rules) {
		conflicts.push(...validateContextRuleOverrides(rule, rules));
	}

	return conflicts;
}

function expectedScopeChain(
	projectId: string,
	scope: ContextScope,
	scopeCatalog: ProjectContextScopeCatalog
): ContextScope[] | null {
	if (scope.kind === "project") {
		return scope.id === projectId ? [scope] : null;
	}
	if (scope.kind === "visual_world") {
		const visualWorld = scopeCatalog.visualWorlds.find(
			(entry) => entry.id === scope.id && entry.projectId === projectId
		);
		return visualWorld ? [scope, { kind: "project", id: projectId }] : null;
	}
	if (scope.kind === "theme") {
		const theme = scopeCatalog.themes.find(
			(entry) => entry.id === scope.id && entry.projectId === projectId
		);
		const visualWorld = theme
			? scopeCatalog.visualWorlds.find(
					(entry) =>
						entry.id === theme.visualWorldId && entry.projectId === projectId
				)
			: undefined;
		return theme && visualWorld
			? [
					scope,
					{ kind: "visual_world", id: visualWorld.id },
					{ kind: "project", id: projectId },
				]
			: null;
	}
	return null;
}

function validateScopeReference(
	projectId: string,
	ruleId: string,
	scope: ContextScope,
	precedenceChain: ContextScope[],
	scopeCatalog: ProjectContextScopeCatalog
): ContextProposalConflict | null {
	const expectedChain = expectedScopeChain(projectId, scope, scopeCatalog);
	if (!expectedChain) {
		return {
			code: "unresolved_reference",
			ruleId,
			message:
				"Bağlam Kuralı kapsamı bu Projede kayıtlı değil veya bilinen bir üst kayda bağlı değil.",
		};
	}
	if (JSON.stringify(expectedChain) !== JSON.stringify(precedenceChain)) {
		return {
			code: "invalid_precedence_chain",
			ruleId,
			message:
				"Öncelik zinciri kayıtlı kapsam ilişkileriyle aynı değil; gerçek Visual World ve Theme üst kayıtlarını kullanın.",
		};
	}
	return null;
}

function mapContextRules(rules: ContextRule[]) {
	return new Map(
		rules.map((rule) => [contextRuleKey(rule.id, rule.scope), rule])
	);
}

function changedRules(
	baseRulesByKey: Map<string, ContextRule>,
	currentRulesByKey: Map<string, ContextRule>
) {
	const changed: ContextRule[] = [];
	const keys = new Set([...baseRulesByKey.keys(), ...currentRulesByKey.keys()]);
	for (const key of keys) {
		const baseRule = baseRulesByKey.get(key);
		const currentRule = currentRulesByKey.get(key);
		if (!sameRuleMeaning(baseRule, currentRule)) {
			const changedRule = currentRule ?? baseRule;
			if (changedRule) {
				changed.push(changedRule);
			}
		}
	}
	return changed;
}

function validateStaleProposalChanges(
	proposal: ContextProposal,
	baseRulesByKey: Map<string, ContextRule>,
	currentRulesByKey: Map<string, ContextRule>,
	changedCurrentRules: ContextRule[]
) {
	const conflicts: ContextProposalConflict[] = [];
	for (const change of proposal.changes) {
		const key = contextRuleKey(change.ruleId, change.scope);
		const baseRule = baseRulesByKey.get(key);
		const changeChain = resolvePrecedenceChain(
			proposal.projectId,
			change.scope,
			change.precedenceChain,
			baseRule
		);
		const desiredRule = proposedRule(
			proposal.projectId,
			change,
			proposal,
			baseRule
		);
		const currentRule = currentRulesByKey.get(key);
		const hasChangedOverlap = changedCurrentRules.some(
			(changedRule) =>
				changedRule.id === change.ruleId &&
				scopeChainsOverlap(
					change.scope,
					changeChain,
					changedRule.scope,
					changedRule.precedenceChain
				)
		);
		if (hasChangedOverlap && !sameRuleMeaning(currentRule, desiredRule)) {
			conflicts.push({
				code: "stale_rule_conflict",
				ruleId: change.ruleId,
				message:
					"Bu kural veya kesişen kapsam, dayanak sürümden sonra değişmiş. Öneriyi güncel Bağlam Sürümü ile yeniden inceleyin.",
			});
		}
	}
	return conflicts;
}

function validateProposalReferences(
	rules: ContextRule[],
	knownProposalIds: Set<string>
) {
	return rules.flatMap((rule) => {
		if (
			rule.source.kind !== "context_proposal" ||
			knownProposalIds.has(rule.source.proposalId)
		) {
			return [];
		}
		return [
			{
				code: "unresolved_reference" as const,
				ruleId: rule.id,
				message:
					"Bir Bağlam Kuralı bulunmayan bir Bağlam Önerisi'ne referans veriyor.",
			},
		];
	});
}

function uniqueConflicts(conflicts: ContextProposalConflict[]) {
	return [
		...new Map(
			conflicts.map((conflict) => [
				`${conflict.code}\u0000${conflict.ruleId}\u0000${conflict.message}`,
				conflict,
			])
		).values(),
	];
}

function validateRevisionRelationship(
	proposal: ContextProposal,
	baseRevision: ContextRevision,
	currentRevision: ContextRevision
) {
	if (
		baseRevision.projectId === proposal.projectId &&
		currentRevision.projectId === proposal.projectId &&
		baseRevision.revisionNumber <= currentRevision.revisionNumber
	) {
		return [];
	}
	return [
		{
			code: "invalid_base_revision" as const,
			ruleId: "project.context",
			message: "Önerinin dayanağı bu Projenin önceki bir Bağlam Sürümü değil.",
		},
	];
}

export function previewContextProposalActivation(
	proposal: ContextProposal,
	baseRevision: ContextRevision,
	currentRevision: ContextRevision,
	knownProposalIds: Set<string>,
	checkedAt: string,
	activatedRevision: ContextRevision | null = null,
	scopeCatalog: ProjectContextScopeCatalog = { visualWorlds: [], themes: [] }
): ContextProposalReview {
	const proposalValidation = validateContextProposal(
		proposal.projectId,
		baseRevision,
		proposal.changes,
		checkedAt,
		scopeCatalog
	);
	const baseRulesByKey = mapContextRules(baseRevision.rules);
	const currentRulesByKey = mapContextRules(currentRevision.rules);
	const changedCurrentRules = changedRules(baseRulesByKey, currentRulesByKey);

	const candidateRules = applyContextProposal(
		proposal.projectId,
		currentRevision.rules,
		proposal
	);
	const conflicts = uniqueConflicts([
		...proposalValidation.conflicts,
		...validateRevisionRelationship(proposal, baseRevision, currentRevision),
		...validateStaleProposalChanges(
			proposal,
			baseRulesByKey,
			currentRulesByKey,
			changedCurrentRules
		),
		...validateContextRules(proposal.projectId, candidateRules, scopeCatalog),
		...validateProposalReferences(candidateRules, knownProposalIds),
	]);
	const isAlreadyActivated = activatedRevision !== null;
	return contextProposalReviewSchema.parse({
		proposalId: proposal.id,
		baseContextRevisionId: proposal.baseContextRevisionId,
		baseRevisionNumber: baseRevision.revisionNumber,
		currentRevisionId: currentRevision.id,
		currentRevisionNumber: currentRevision.revisionNumber,
		targetRevisionNumber:
			activatedRevision?.revisionNumber ?? currentRevision.revisionNumber + 1,
		activatedRevisionNumber: activatedRevision?.revisionNumber ?? null,
		isRebased: baseRevision.id !== currentRevision.id,
		activationAllowed:
			conflicts.length === 0 &&
			(!activatedRevision ||
				(activatedRevision.isActive &&
					activatedRevision.id === currentRevision.id)),
		checkedAt,
		conflicts: isAlreadyActivated ? [] : conflicts,
		candidateRules: activatedRevision?.rules ?? candidateRules,
		contextCopy: renderContextCopy(
			proposal.projectId,
			activatedRevision?.revisionNumber ?? currentRevision.revisionNumber + 1,
			activatedRevision?.rules ?? candidateRules
		),
	});
}

export function renderContextCopy(
	projectId: string,
	revisionNumber: number,
	rules: ContextRule[]
) {
	const orderedRules = [...rules].sort((left, right) => {
		const specificity =
			scopeSpecificity[right.scope.kind] - scopeSpecificity[left.scope.kind];
		return specificity || left.id.localeCompare(right.id);
	});
	const lines = [
		"# Project Context",
		"",
		`Revision: ${revisionNumber}`,
		`Project: ${JSON.stringify(projectId)}`,
		"Rule contract: context-rule/1.0.0",
		"",
		"This read-only context copy is derived from the validated Context Revision.",
		"Rules are resolved from their most specific matching scope toward the Project scope.",
		"",
	];
	if (orderedRules.length === 0) {
		lines.push("No Context Rules are active.");
	} else {
		for (const rule of orderedRules) {
			lines.push(
				`## ${rule.id}`,
				`- Scope: ${JSON.stringify(rule.scope)}`,
				`- Value: ${JSON.stringify(rule.value)}`,
				`- Precedence chain: ${JSON.stringify(rule.precedenceChain)}`,
				`- Supersedes rule: ${JSON.stringify(rule.supersedesRuleId ?? null)}`,
				`- Rationale: ${JSON.stringify(rule.rationale)}`,
				""
			);
		}
	}
	return lines.join("\n");
}
