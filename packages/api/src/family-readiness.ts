import { z } from "zod";

const idSchema = z.string().trim().min(1).max(128);
const itemKeySchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(/^[a-z][a-z0-9._-]*$/);
const qualityRuleIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z][a-z0-9._-]*$/);
const evidenceResultSchema = z.enum([
	"passed",
	"failed",
	"inconclusive",
	"waived",
]);
const profileRuleClassSchema = z.enum([
	"integrity_gate",
	"waivable_requirement",
	"quality_advisory",
	"human_review",
]);
const qualityRequirementClassSchema = z.enum([
	"integrity_gate",
	"waivable_requirement",
	"quality_advisory",
	"general_asset_support",
]);

export const requiredSetItemKindSchema = z.enum([
	"direction",
	"animation",
	"state",
	"variant",
	"usage_test",
]);

export const requiredSetItemDispositionSchema = z.enum([
	"required",
	"optional",
	"inapplicable",
]);

export const requiredSetItemSchema = z
	.object({
		id: itemKeySchema,
		kind: requiredSetItemKindSchema,
		name: z.string().trim().min(1).max(120),
		disposition: requiredSetItemDispositionSchema,
		assetRecordIds: z.array(idSchema).max(20),
		testId: qualityRuleIdSchema.optional(),
	})
	.strict()
	.superRefine((item, context) => {
		if (new Set(item.assetRecordIds).size !== item.assetRecordIds.length) {
			context.addIssue({
				code: "custom",
				path: ["assetRecordIds"],
				message: "Aynı Varlık Kaydı bir öğede yalnızca bir kez seçilebilir.",
			});
		}
		if (
			item.disposition === "required" &&
			(item.kind === "usage_test"
				? item.assetRecordIds.length < 1
				: item.assetRecordIds.length !== 1)
		) {
			context.addIssue({
				code: "custom",
				path: ["assetRecordIds"],
				message:
					item.kind === "usage_test"
						? "Gerekli kullanım testi en az bir Varlık Kaydına bağlanmalıdır."
						: "Gerekli öğe tam olarak bir Varlık Kaydına bağlanmalıdır.",
			});
		}
		if (
			item.disposition === "required" &&
			item.kind === "usage_test" &&
			!item.testId
		) {
			context.addIssue({
				code: "custom",
				path: ["testId"],
				message:
					"Gerekli kullanım testi etkin sözleşmedeki bir test kimliğini belirtmelidir.",
			});
		}
		if (item.kind !== "usage_test" && item.testId) {
			context.addIssue({
				code: "custom",
				path: ["testId"],
				message: "Yalnız kullanım testi öğeleri test kimliği taşıyabilir.",
			});
		}
	});

export const requiredSetRevisionSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetFamilyId: idSchema,
		revisionNumber: z.number().int().positive(),
		items: z.array(requiredSetItemSchema).max(100),
		createdAt: z.string().datetime(),
		createdByUserId: idSchema,
		isActive: z.boolean(),
		wasActivated: z.boolean(),
	})
	.strict();

export const requiredSetListInputSchema = z
	.object({ projectId: idSchema, assetFamilyId: idSchema })
	.strict();

export const requiredSetSaveInputSchema = z
	.object({
		projectId: idSchema,
		assetFamilyId: idSchema,
		items: z.array(requiredSetItemSchema).max(100),
	})
	.strict()
	.superRefine((input, context) => {
		const itemIds = input.items.map((item) => item.id);
		if (new Set(itemIds).size !== itemIds.length) {
			context.addIssue({
				code: "custom",
				path: ["items"],
				message:
					"Gerekli Öğeler Listesi içinde öğe kimlikleri benzersiz olmalıdır.",
			});
		}
	});

export const requiredSetActivateInputSchema = z
	.object({
		projectId: idSchema,
		assetFamilyId: idSchema,
		revisionId: idSchema,
	})
	.strict();

export const readinessEvidenceInputSchema = z.discriminatedUnion("kind", [
	z
		.object({
			kind: z.literal("applicability"),
			projectId: idSchema,
			assetFamilyId: idSchema,
			revisionId: idSchema,
			itemId: itemKeySchema,
			result: z.enum(["applicable", "inapplicable"]),
			rationale: z.string().trim().min(1).max(2000),
		})
		.strict(),
	z
		.object({
			kind: z.literal("quality"),
			projectId: idSchema,
			assetFamilyId: idSchema,
			revisionId: idSchema,
			itemId: itemKeySchema,
			result: evidenceResultSchema,
			ruleId: qualityRuleIdSchema,
			method: z.string().trim().min(1).max(1000),
			rationale: z.string().trim().min(1).max(2000),
			observedValue: z.string().trim().min(1).max(500).optional(),
		})
		.strict()
		.superRefine((input, context) => {
			if (input.result === "waived" && !input.observedValue) {
				context.addIssue({
					code: "custom",
					path: ["observedValue"],
					message: "Kalite İstisnası için gözlenen değer gereklidir.",
				});
			}
		}),
	z
		.object({
			kind: z.literal("usage_test"),
			projectId: idSchema,
			assetFamilyId: idSchema,
			revisionId: idSchema,
			itemId: itemKeySchema,
			result: z.enum(["passed", "failed", "inconclusive"]),
			testId: qualityRuleIdSchema,
			method: z.string().trim().min(1).max(1000),
			rationale: z.string().trim().min(1).max(2000),
		})
		.strict(),
]);

export const readinessEvidenceSchema = z
	.object({
		id: idSchema,
		projectId: idSchema,
		assetFamilyId: idSchema,
		revisionId: idSchema,
		itemId: itemKeySchema,
		kind: z.enum(["applicability", "quality", "usage_test"]),
		result: z.enum([
			"applicable",
			"inapplicable",
			"passed",
			"failed",
			"inconclusive",
			"waived",
		]),
		assetVersionIds: z.array(idSchema),
		profileContractRevisionIds: z.array(idSchema.nullable()),
		contextRevisionId: idSchema.nullable(),
		visualWorldId: idSchema,
		useContext: z.string(),
		canonicalDesignVersionId: idSchema.nullable(),
		ruleId: qualityRuleIdSchema.nullable(),
		ruleClass: profileRuleClassSchema.nullable(),
		testId: qualityRuleIdSchema.nullable(),
		observedValue: z.string().nullable(),
		method: z.string().nullable(),
		rationale: z.string(),
		createdAt: z.string().datetime(),
		createdByUserId: idSchema,
		isCurrent: z.boolean(),
	})
	.strict();

export const familyReadinessItemSchema = z
	.object({
		item: requiredSetItemSchema,
		status: z.enum(["complete", "incomplete"]),
		blockers: z.array(
			z.enum([
				"asset_version",
				"approval",
				"integrity",
				"applicability",
				"quality",
				"quality_contract",
				"usage_test",
				"profile_contract_usage_test",
			])
		),
		currentAssetVersionIds: z.array(idSchema),
		qualityReadiness: z.enum([
			"export_ready",
			"exceptions_ready",
			"not_assessed",
			"blocked",
		]),
		qualityRequirements: z.array(
			z
				.object({
					id: qualityRuleIdSchema,
					name: z.string(),
					class: qualityRequirementClassSchema,
					required: z.boolean(),
					waiverEligible: z.boolean(),
					result: z.enum([
						"passed",
						"failed",
						"inconclusive",
						"waived",
						"not_assessed",
					]),
					isCurrent: z.boolean(),
				})
				.strict()
		),
		humanReviewRequirements: z.array(
			z
				.object({
					id: qualityRuleIdSchema,
					name: z.string(),
					required: z.boolean(),
					result: z.enum(["passed", "failed", "inconclusive", "not_assessed"]),
					isCurrent: z.boolean(),
				})
				.strict()
		),
		usageRequirements: z.array(
			z
				.object({
					id: qualityRuleIdSchema,
					name: z.string(),
					required: z.boolean(),
					result: z.enum(["passed", "failed", "inconclusive", "not_assessed"]),
					isCurrent: z.boolean(),
				})
				.strict()
		),
		latestEvidence: z.array(readinessEvidenceSchema),
	})
	.strict();

export const familyReadinessSchema = z
	.object({
		projectId: idSchema,
		assetFamilyId: idSchema,
		status: z.enum(["not_configured", "incomplete", "complete"]),
		activeRevision: requiredSetRevisionSchema.nullable(),
		revisions: z.array(requiredSetRevisionSchema),
		items: z.array(familyReadinessItemSchema),
	})
	.strict();

export type RequiredSetItem = z.infer<typeof requiredSetItemSchema>;
export type RequiredSetRevision = z.infer<typeof requiredSetRevisionSchema>;
export type ReadinessEvidenceInput = z.infer<
	typeof readinessEvidenceInputSchema
>;
export type ReadinessEvidence = z.infer<typeof readinessEvidenceSchema>;
export type FamilyReadiness = z.infer<typeof familyReadinessSchema>;

export type ReadinessBlocker =
	| "asset_version"
	| "approval"
	| "integrity"
	| "applicability"
	| "quality"
	| "quality_contract"
	| "usage_test"
	| "profile_contract_usage_test";

export interface FamilyReadinessStore {
	activate: (
		userId: string,
		input: z.infer<typeof requiredSetActivateInputSchema>
	) => Promise<FamilyReadiness | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<FamilyReadiness | null>;
	recordEvidence: (
		userId: string,
		input: ReadinessEvidenceInput
	) => Promise<FamilyReadiness | null>;
	saveDraft: (
		userId: string,
		input: z.infer<typeof requiredSetSaveInputSchema>
	) => Promise<RequiredSetRevision | null>;
}

export interface CurrentReadinessScope {
	assetVersionIds: string[];
	canonicalDesignVersionId: string | null;
	contextRevisionId: string | null;
	profileContractRevisionIds?: (string | null)[];
	useContext: string;
	visualWorldId: string;
}

export function isReadinessEvidenceCurrent(
	evidence: Pick<
		ReadinessEvidence,
		| "assetVersionIds"
		| "contextRevisionId"
		| "visualWorldId"
		| "useContext"
		| "canonicalDesignVersionId"
	> & { profileContractRevisionIds?: (string | null)[] },
	current: CurrentReadinessScope,
	options: { profileContractsMatter?: boolean } = {
		profileContractsMatter: true,
	}
) {
	const evidenceProfileContractRevisionIds =
		evidence.profileContractRevisionIds ?? [];
	const profileContractsMatch =
		options.profileContractsMatter === false ||
		(evidenceProfileContractRevisionIds.length ===
			(current.profileContractRevisionIds?.length ?? 0) &&
			evidenceProfileContractRevisionIds.every(
				(revisionId, index) =>
					revisionId === current.profileContractRevisionIds?.[index]
			));
	return (
		current.contextRevisionId !== null &&
		evidence.assetVersionIds.length === current.assetVersionIds.length &&
		evidence.assetVersionIds.every(
			(versionId, index) => versionId === current.assetVersionIds[index]
		) &&
		evidence.contextRevisionId === current.contextRevisionId &&
		evidence.visualWorldId === current.visualWorldId &&
		evidence.useContext === current.useContext &&
		evidence.canonicalDesignVersionId === current.canonicalDesignVersionId &&
		profileContractsMatch
	);
}

export interface ReadinessAssetStatus {
	applicability: "applicable" | "not_assessed" | "revalidation_required";
	integrityVerified: boolean;
	qualityReadiness:
		| "export_ready"
		| "exceptions_ready"
		| "not_assessed"
		| "blocked";
	reviewDisposition: "approved" | "candidate" | "rejected";
}

export function assessGeneralAssetSupport(input: {
	isCurrent: boolean;
	result: z.infer<
		typeof familyReadinessItemSchema
	>["qualityRequirements"][number]["result"];
}) {
	return {
		qualityReadiness: "not_assessed" as const,
		qualityRequirements: [
			{
				id: "general.asset_support",
				name: "General Asset Support",
				class: "general_asset_support" as const,
				required: false,
				waiverEligible: false,
				result: input.result,
				isCurrent: input.isCurrent,
			},
		],
		humanReviewRequirements: [],
	};
}

export interface ReadinessEvaluationItem {
	asset?: ReadinessAssetStatus | null;
	disposition: z.infer<typeof requiredSetItemDispositionSchema>;
	id: string;
	kind: z.infer<typeof requiredSetItemKindSchema>;
	profileContractActive?: boolean;
	profileContractUsageTest?: boolean;
	profileUsageTestsComplete?: boolean;
	usageTestStatus?: "passed" | "failed" | "inconclusive" | "not_assessed";
}

function requiredAssetBlockers(
	asset: ReadinessAssetStatus | null | undefined
): ReadinessBlocker[] {
	if (!asset) {
		return ["asset_version", "applicability", "quality"];
	}
	const blockers: ReadinessBlocker[] = [];
	if (asset.reviewDisposition !== "approved") {
		blockers.push("approval");
	}
	if (!asset.integrityVerified) {
		blockers.push("integrity");
	}
	if (asset.applicability !== "applicable") {
		blockers.push("applicability");
	}
	if (asset.qualityReadiness !== "export_ready") {
		blockers.push("quality");
	}
	return blockers;
}

function readinessItemBlockers(
	item: ReadinessEvaluationItem
): ReadinessBlocker[] {
	if (item.disposition !== "required") {
		return [];
	}
	const blockers = requiredAssetBlockers(item.asset);
	if (item.kind === "usage_test") {
		if (item.usageTestStatus !== "passed") {
			blockers.push("usage_test");
		}
		if (!item.profileContractActive) {
			blockers.push("quality_contract");
		}
		if (item.profileContractUsageTest === false) {
			blockers.push("profile_contract_usage_test");
		}
		if (
			item.profileContractActive &&
			item.profileUsageTestsComplete === false &&
			!blockers.includes("profile_contract_usage_test")
		) {
			blockers.push("profile_contract_usage_test");
		}
		return blockers;
	}
	if (!item.asset) {
		return blockers;
	}
	if (!item.profileContractActive) {
		blockers.push("quality_contract");
	}
	if (item.profileContractActive && item.profileUsageTestsComplete === false) {
		blockers.push("profile_contract_usage_test");
	}
	return blockers;
}

export function evaluateFamilyReadiness(input: {
	activeRequiredSetRevisionId: string | null;
	items: ReadinessEvaluationItem[];
}) {
	if (!input.activeRequiredSetRevisionId) {
		return { status: "not_configured" as const, items: [] };
	}
	const items = input.items.map((item) => {
		const blockers = readinessItemBlockers(item);
		return {
			id: item.id,
			status:
				blockers.length === 0 ? ("complete" as const) : ("incomplete" as const),
			blockers,
		};
	});
	return {
		status: items.every((item) => item.status === "complete")
			? ("complete" as const)
			: ("incomplete" as const),
		items,
	};
}
