import type {
	ContextRuleCheckResult,
	ContextRuleLimits,
} from "@sprite-anvil/api/context-rule-checks";
import { contextRuleCheckGroup } from "@sprite-anvil/api/context-rule-checks";
import { proposeColourMerge } from "./colour-merge";
import type { PixelMeasurement } from "./pixel-measurement";

export function evaluateContextRules(
	measurement: PixelMeasurement,
	{ limits, qaBlocked }: { limits: ContextRuleLimits; qaBlocked: boolean }
) {
	const results: ContextRuleCheckResult[] = [];
	if (limits.maxColours !== undefined) {
		const observed = measurement.colours.length;
		results.push({
			ruleId: "palette.max_colors",
			limit: limits.maxColours,
			observed,
			passes: observed <= limits.maxColours,
		});
	}
	if (limits.outlineWidth !== undefined) {
		const observed = measurement.outlineWidth;
		results.push({
			ruleId: "outline.width",
			limit: limits.outlineWidth,
			observed,
			// An image without a measurable outline cannot differ from the rule.
			passes: observed === null || observed === limits.outlineWidth,
		});
	}
	const coloursFail = results.some(
		(result) => result.ruleId === "palette.max_colors" && !result.passes
	);
	const proposal =
		coloursFail && limits.maxColours !== undefined
			? proposeColourMerge(measurement.colours, limits.maxColours)
			: null;
	const merge = proposal?.ok ? proposal : null;
	const group = contextRuleCheckGroup({
		results,
		// A colour failure without a usable proposal cannot be called safe.
		mergeChangesBoundary: coloursFail && merge?.changesBoundary !== false,
		qaBlocked,
	});
	return { group, results, merge };
}
