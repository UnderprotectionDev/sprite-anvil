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

export const publishedValidationSchema = z.object({
	evidenceRef: z.string().trim().min(1),
	parameters: z
		.record(z.string().min(1), z.unknown())
		.refine((parameters) => Object.keys(parameters).length > 0),
	publishedAt: z.iso.datetime(),
});
export type PublishedValidation = z.infer<typeof publishedValidationSchema>;

export type DeliveryRefreshResult = "same" | "different" | "not_evaluated";

export interface PlatformSupportInput {
	accessibility?: Partial<Record<PlatformSurface, "passed" | "failed">>;
	combinationId: string;
	deliveryRefresh?: {
		divergence: DeliveryRefreshResult;
		lock: DeliveryRefreshResult;
	};
	openValidations?: Partial<
		Record<OpenValidationId, PublishedValidation | undefined>
	>;
	scenarioComparisons?: Partial<
		Record<AcceptanceScenarioId, PlatformEquivalenceComparison>
	>;
}

export type PlatformSupportBlocker =
	| {
			kind: "scenario";
			id: AcceptanceScenarioId;
			reason: "missing" | PlatformEquivalenceComparison["outcome"];
	  }
	| {
			kind: "delivery_refresh";
			part: "lock" | "divergence";
			reason: "not_evaluated" | "different";
	  }
	| {
			kind: "accessibility";
			surface: PlatformSurface;
			reason: "not_measured" | "failed";
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

function scenarioBlockers(
	input: PlatformSupportInput
): PlatformSupportBlocker[] {
	return acceptanceScenarioIds.flatMap((id): PlatformSupportBlocker[] => {
		const comparison = input.scenarioComparisons?.[id];
		if (!comparison) {
			return [{ id, kind: "scenario", reason: "missing" }];
		}
		return comparison.outcome === "equivalent"
			? []
			: [{ id, kind: "scenario", reason: comparison.outcome }];
	});
}

function deliveryRefreshBlockers(
	input: PlatformSupportInput
): PlatformSupportBlocker[] {
	return (["lock", "divergence"] as const).flatMap(
		(part): PlatformSupportBlocker[] => {
			const result = input.deliveryRefresh?.[part] ?? "not_evaluated";
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
		const result = input.accessibility?.[surface];
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
