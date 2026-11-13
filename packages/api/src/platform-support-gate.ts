/**
 * Pure gate for the Supported Platform Matrix. A combination is `supported` only
 * when every acceptance scenario is equivalent on both surfaces, the Delivery
 * Refresh Lock and divergence results are equivalent, the OPS-04 accessible
 * core flow passed on both surfaces, and OV-08 to OV-11 each have published
 * parameters and evidence. Anything else is `unmeasured`.
 *
 * The gate holds no thresholds and no default parameters: the OV-08 to OV-11
 * values and the Supported Platform Matrix rows are data the repository does
 * not own yet, so the caller supplies them or the gate stays closed.
 */
import { z } from "zod";
import {
	type PlatformEquivalenceComparison,
	type PlatformSurface,
	platformEquivalenceComparisonSchema,
	platformSurfaces,
} from "./platform-equivalence-comparison";

/** The 8.1 shared flow, the Reference Acceptance Scenarios and the Extended Acceptance Scenarios. */
export const acceptanceScenarioIds = [
	"8.1",
	"RAS-01",
	"RAS-02",
	"RAS-03",
	"RAS-04",
	"RAS-05",
	"RAS-06",
	"RAS-07",
	"RAS-08",
	"YAS-01",
	"YAS-02",
	"YAS-03",
	"YAS-04",
] as const;
export type AcceptanceScenarioId = (typeof acceptanceScenarioIds)[number];

export const openValidationIds = ["OV-08", "OV-09", "OV-10", "OV-11"] as const;
export type OpenValidationId = (typeof openValidationIds)[number];

/**
 * Existing end-to-end specs that measure part of OPS-04: keyboard reach, visible
 * focus and accessible names. They do not cover screen reader status
 * announcements or a WCAG 2.2 AA audit, so a `passed` result is the caller's
 * claim about those specs, not proof of the whole requirement.
 */
export const ops04EvidenceSources: Record<PlatformSurface, string> = {
	desktop: "apps/web/desktop-e2e/keyboard-accessibility.spec.ts",
	web: "apps/web/e2e/accessible-focus.spec.ts",
};

/** Where a claimed result can be checked; a result without one is not evidence. */
export const evidenceRefSchema = z.string().trim().min(1);

export const publishedValidationSchema = z.object({
	evidenceRef: evidenceRefSchema,
	parameters: z
		.record(z.string().min(1), z.unknown())
		.refine((parameters) => Object.keys(parameters).length > 0),
	publishedAt: z.iso.datetime(),
});
export type PublishedValidation = z.infer<typeof publishedValidationSchema>;

export type DeliveryRefreshResult = "same" | "different" | "not_evaluated";

/** A claimed result and the reference to the evidence behind it. */
export interface EvidencedResult<Result> {
	evidenceRef: string;
	result: Result;
}

/**
 * The web/desktop comparison of one acceptance scenario. It is bound to its
 * scenario by id, so a Phase 3 interim report (three evidence sections, no
 * scenario) or another scenario's comparison is never a scenario result.
 */
export const scenarioEvidenceSchema = z.object({
	comparison: platformEquivalenceComparisonSchema,
	evidenceRef: z.string(),
	scenarioId: z.enum(acceptanceScenarioIds),
});
export interface ScenarioEvidence {
	comparison: PlatformEquivalenceComparison;
	evidenceRef: string;
	scenarioId: AcceptanceScenarioId;
}

export interface PlatformSupportInput {
	accessibility?: Partial<
		Record<PlatformSurface, EvidencedResult<"passed" | "failed">>
	>;
	combinationId: string;
	deliveryRefresh?: {
		divergence: EvidencedResult<DeliveryRefreshResult>;
		lock: EvidencedResult<DeliveryRefreshResult>;
	};
	openValidations?: Partial<
		Record<OpenValidationId, PublishedValidation | undefined>
	>;
	scenarioComparisons?: Partial<Record<AcceptanceScenarioId, ScenarioEvidence>>;
}

export type PlatformSupportBlocker =
	| {
			kind: "scenario";
			id: AcceptanceScenarioId;
			reason:
				| "missing"
				| "not_bound_to_scenario"
				| "no_evidence_ref"
				| Exclude<PlatformEquivalenceComparison["outcome"], "equivalent">;
	  }
	| {
			kind: "delivery_refresh";
			part: "lock" | "divergence";
			reason: "not_evaluated" | "different" | "no_evidence_ref";
	  }
	| {
			kind: "accessibility";
			surface: PlatformSurface;
			reason: "not_measured" | "failed" | "no_evidence_ref";
	  }
	| { kind: "open_validation"; id: OpenValidationId; reason: "not_published" };

export interface PlatformSupportResult {
	blockers: PlatformSupportBlocker[];
	combinationId: string;
	status: "supported" | "unmeasured";
}

function isPublished(validation: unknown): boolean {
	return publishedValidationSchema.safeParse(validation).success;
}

function hasEvidenceRef(evidenceRef: unknown): boolean {
	return evidenceRefSchema.safeParse(evidenceRef).success;
}

function scenarioBlockers(
	input: PlatformSupportInput
): PlatformSupportBlocker[] {
	return acceptanceScenarioIds.flatMap((id): PlatformSupportBlocker[] => {
		const evidence: unknown = input.scenarioComparisons?.[id];
		if (!evidence) {
			return [{ id, kind: "scenario", reason: "missing" }];
		}
		const parsed = scenarioEvidenceSchema.safeParse(evidence);
		if (!parsed.success || parsed.data.scenarioId !== id) {
			return [{ id, kind: "scenario", reason: "not_bound_to_scenario" }];
		}
		if (!hasEvidenceRef(parsed.data.evidenceRef)) {
			return [{ id, kind: "scenario", reason: "no_evidence_ref" }];
		}
		const { outcome } = parsed.data.comparison;
		return outcome === "equivalent"
			? []
			: [{ id, kind: "scenario", reason: outcome }];
	});
}

function deliveryRefreshBlockers(
	input: PlatformSupportInput
): PlatformSupportBlocker[] {
	return (["lock", "divergence"] as const).flatMap(
		(part): PlatformSupportBlocker[] => {
			const claim = input.deliveryRefresh?.[part];
			const result = claim?.result ?? "not_evaluated";
			if (result === "same" && !hasEvidenceRef(claim?.evidenceRef)) {
				return [{ kind: "delivery_refresh", part, reason: "no_evidence_ref" }];
			}
			return result === "same"
				? []
				: [
						{
							kind: "delivery_refresh",
							part,
							reason: result === "different" ? "different" : "not_evaluated",
						},
					];
		}
	);
}

function accessibilityBlockers(
	input: PlatformSupportInput
): PlatformSupportBlocker[] {
	return platformSurfaces.flatMap((surface): PlatformSupportBlocker[] => {
		const claim = input.accessibility?.[surface];
		const result = claim?.result;
		if (result === "passed" && !hasEvidenceRef(claim?.evidenceRef)) {
			return [{ kind: "accessibility", reason: "no_evidence_ref", surface }];
		}
		return result === "passed"
			? []
			: [
					{
						kind: "accessibility",
						reason: result === "failed" ? "failed" : "not_measured",
						surface,
					},
				];
	});
}

function openValidationBlockers(
	input: PlatformSupportInput
): PlatformSupportBlocker[] {
	return openValidationIds
		.filter((id) => !isPublished(input.openValidations?.[id]))
		.map((id) => ({ id, kind: "open_validation", reason: "not_published" }));
}

export function evaluatePlatformSupport(
	input: PlatformSupportInput
): PlatformSupportResult {
	const blockers = [
		...scenarioBlockers(input),
		...deliveryRefreshBlockers(input),
		...accessibilityBlockers(input),
		...openValidationBlockers(input),
	];
	return {
		blockers,
		combinationId: input.combinationId,
		status: blockers.length === 0 ? "supported" : "unmeasured",
	};
}

export interface PublishedPlatformSupport {
	combinations?: PlatformSupportInput[];
	openValidations?: PlatformSupportInput["openValidations"];
}

export interface PlatformSupportSummary {
	combinations: PlatformSupportResult[];
	openValidations: { id: OpenValidationId; state: "open" | "published" }[];
	supportedCount: number;
}

/** The gate over everything the repository publishes; with nothing published, nothing is supported. */
export function summarizePlatformSupport(
	published: PublishedPlatformSupport
): PlatformSupportSummary {
	const combinations = (published.combinations ?? []).map((combination) =>
		evaluatePlatformSupport({
			...combination,
			openValidations: published.openValidations,
		})
	);
	return {
		combinations,
		openValidations: openValidationIds.map((id) => ({
			id,
			state: isPublished(published.openValidations?.[id])
				? "published"
				: "open",
		})),
		supportedCount: combinations.filter(
			(combination) => combination.status === "supported"
		).length,
	};
}
