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
			result: z.enum(["passed", "failed", "inconclusive"]),
			ruleId: qualityRuleIdSchema,
			method: z.string().trim().min(1).max(1000),
			rationale: z.string().trim().min(1).max(2000),
		})
		.strict(),
	z
		.object({
			kind: z.literal("usage_test"),
			projectId: idSchema,
			assetFamilyId: idSchema,
			revisionId: idSchema,
			itemId: itemKeySchema,
			result: z.enum(["passed", "failed", "inconclusive"]),
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
		]),
		assetVersionIds: z.array(idSchema),
		contextRevisionId: idSchema.nullable(),
		visualWorldId: idSchema,
		useContext: z.string(),
		canonicalDesignVersionId: idSchema.nullable(),
		ruleId: qualityRuleIdSchema.nullable(),
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
			])
		),
		currentAssetVersionIds: z.array(idSchema),
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
	| "usage_test";

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
	>,
	current: CurrentReadinessScope
) {
	return (
		current.contextRevisionId !== null &&
		evidence.assetVersionIds.length === current.assetVersionIds.length &&
		evidence.assetVersionIds.every(
			(versionId, index) => versionId === current.assetVersionIds[index]
		) &&
		evidence.contextRevisionId === current.contextRevisionId &&
		evidence.visualWorldId === current.visualWorldId &&
		evidence.useContext === current.useContext &&
		evidence.canonicalDesignVersionId === current.canonicalDesignVersionId
	);
}

export interface ReadinessAssetStatus {
	applicability: "applicable" | "not_assessed" | "revalidation_required";
	integrityVerified: boolean;
	qualityReadiness: "export_ready" | "not_assessed" | "blocked";
	reviewDisposition: "approved" | "candidate" | "rejected";
}

export interface ReadinessEvaluationItem {
	asset?: ReadinessAssetStatus | null;
	disposition: z.infer<typeof requiredSetItemDispositionSchema>;
	id: string;
	kind: z.infer<typeof requiredSetItemKindSchema>;
	profileContractActive?: boolean;
	usageTestStatus?: "passed" | "failed" | "inconclusive" | "not_assessed";
}

function readinessItemBlockers(
	item: ReadinessEvaluationItem
): ReadinessBlocker[] {
	if (item.disposition !== "required") {
		return [];
	}
	if (item.kind === "usage_test") {
		const blockers: ReadinessBlocker[] = [];
		if (item.usageTestStatus !== "passed") {
			blockers.push("usage_test");
		}
		if (!item.profileContractActive) {
			blockers.push("quality_contract");
		}
		return blockers;
	}
	if (!item.asset) {
		return ["asset_version", "applicability", "quality"];
	}
	const blockers: ReadinessBlocker[] = [];
	if (item.asset.reviewDisposition !== "approved") {
		blockers.push("approval");
	}
	if (!item.asset.integrityVerified) {
		blockers.push("integrity");
	}
	if (item.asset.applicability !== "applicable") {
		blockers.push("applicability");
	}
	if (item.asset.qualityReadiness !== "export_ready") {
		blockers.push("quality");
		if (item.asset.qualityReadiness === "not_assessed") {
			blockers.push("quality_contract");
		}
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
