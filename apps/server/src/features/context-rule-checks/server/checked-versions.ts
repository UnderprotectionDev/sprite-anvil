import type { ContextRuleLimits } from "@sprite-anvil/api/context-rule-checks";
import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type { ContextRule } from "@sprite-anvil/api/project-context";
import {
	narrowestScopeChain,
	sameContextScope,
} from "@sprite-anvil/api/project-context";

export interface ReviewedVersion {
	id: string;
	versionNumber: number;
}

export interface VersionReview {
	createdAt: Date;
	decision: "candidate" | "approved" | "rejected";
	id: string;
	versionId: string;
}

/**
 * The version a Context Rule Check reads: the most recently approved one,
 * otherwise the newest Candidate Version. Rejected versions are never checked.
 */
export function selectCheckedVersion<T extends ReviewedVersion>(
	versions: T[],
	reviews: VersionReview[]
) {
	const latest = new Map<string, VersionReview>();
	for (const review of [...reviews].sort(
		(left, right) =>
			right.createdAt.valueOf() - left.createdAt.valueOf() ||
			right.id.localeCompare(left.id)
	)) {
		if (!latest.has(review.versionId)) {
			latest.set(review.versionId, review);
		}
	}
	const [approved] = versions
		.filter((version) => latest.get(version.id)?.decision === "approved")
		.sort(
			(left, right) =>
				(latest.get(right.id)?.createdAt.valueOf() ?? 0) -
					(latest.get(left.id)?.createdAt.valueOf() ?? 0) ||
				right.versionNumber - left.versionNumber
		);
	if (approved) {
		return { version: approved, reviewDisposition: "approved" as const };
	}
	const [candidate] = versions
		.filter(
			(version) =>
				(latest.get(version.id)?.decision ?? "candidate") === "candidate"
		)
		.sort((left, right) => right.versionNumber - left.versionNumber);
	return candidate
		? { version: candidate, reviewDisposition: "candidate" as const }
		: null;
}

/** The measurable limits that govern one Asset Record, narrowest scope first. */
export function resolveRuleLimits(
	projectId: string,
	assetRecord: {
		id: string;
		themeId: string | null;
		visualWorldId: string | null;
	},
	rules: ContextRule[],
	catalog: ProjectContextScopeCatalog
): ContextRuleLimits {
	const chain = [
		{ kind: "asset" as const, id: assetRecord.id },
		...narrowestScopeChain(projectId, assetRecord, catalog),
	];
	const resolve = (ruleId: string) => {
		for (const scope of chain) {
			const rule = rules.find(
				(item) => item.id === ruleId && sameContextScope(item.scope, scope)
			);
			if (rule) {
				return rule.value.type === "number" ? rule.value.value : undefined;
			}
		}
	};
	const maxColours = resolve("palette.max_colors");
	const outlineWidth = resolve("outline.width");
	return {
		...(maxColours === undefined ? {} : { maxColours }),
		...(outlineWidth === undefined ? {} : { outlineWidth }),
	};
}
