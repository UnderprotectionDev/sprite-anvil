import type {
	SourceMetadataMappingFinalizeInput,
	SourceMetadataMappingProposal,
} from "@sprite-anvil/api/source-metadata-mapping";
import { sourceMetadataMappingContractVersion } from "@sprite-anvil/api/source-metadata-mapping";

const decisionKey = (field: string, key: string) => `${field}\u0000${key}`;

export function resolveSourceMetadataMappingDecisions(
	proposal: SourceMetadataMappingProposal,
	decisions: SourceMetadataMappingFinalizeInput["decisions"]
) {
	if (
		proposal.contractVersion !== sourceMetadataMappingContractVersion ||
		!proposal.fields.some((field) => field.field === "frame") ||
		proposal.diagnostics.some((diagnostic) => diagnostic.severity === "error")
	) {
		return null;
	}
	const conflicts = new Map(
		proposal.conflicts.map((conflict) => [
			decisionKey(conflict.field, conflict.key),
			conflict,
		])
	);
	const seen = new Set<string>();
	for (const decision of decisions) {
		const key = decisionKey(decision.field, decision.key);
		const conflict = conflicts.get(key);
		if (
			seen.has(key) ||
			!conflict ||
			(decision.sourceEntryId === null &&
				(decision.field === "frame" || decision.sourcePath !== null)) ||
			(decision.sourceEntryId !== null &&
				!conflict.candidates.some(
					(candidate) =>
						candidate.sourceEntryId === decision.sourceEntryId &&
						candidate.sourcePath === decision.sourcePath
				))
		) {
			return null;
		}
		seen.add(key);
	}
	if (
		proposal.conflicts.some(
			(conflict) =>
				conflict.field === "frame" &&
				!seen.has(decisionKey(conflict.field, conflict.key))
		)
	) {
		return null;
	}
	return proposal.conflicts.map(
		(conflict) =>
			decisions.find(
				(decision) =>
					decision.field === conflict.field && decision.key === conflict.key
			) ?? {
				field: conflict.field,
				key: conflict.key,
				sourceEntryId: null,
				sourcePath: null,
			}
	);
}
