import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import type { ColourMergeFailure } from "../context-rule-checks";
import {
	colourMergeApplyInputSchema,
	colourMergePreviewInputSchema,
	colourMergePreviewSchema,
	colourMergeResultSchema,
	contextRuleCheckOverviewInputSchema,
	contextRuleCheckOverviewSchema,
	contextRuleRecheckInputSchema,
} from "../context-rule-checks";
import { protectedProcedure } from "../index";

const failures = {
	not_found: ["NOT_FOUND", "Asset Version not found in this Project."],
	unreadable: [
		"UNPROCESSABLE_CONTENT",
		"The stored image could not be read and verified.",
	],
	stale_context_revision: [
		"CONFLICT",
		"The Active Context Revision changed. Preview the Colour Merge again.",
	],
	nothing_to_merge: [
		"CONFLICT",
		"This Asset Version has no colour limit to merge toward.",
	],
	invalid_target: [
		"BAD_REQUEST",
		"Each target must be a colour that remains after the merge step.",
	],
	family_required: [
		"CONFLICT",
		"Assign the Asset Record to an Asset Family before merging colours.",
	],
	idempotency_conflict: [
		"CONFLICT",
		"This request key already created a different Candidate Version.",
	],
	storage_unavailable: [
		"SERVICE_UNAVAILABLE",
		"The Candidate Version could not be stored. Try again.",
	],
} as const satisfies Record<ColourMergeFailure, readonly [string, string]>;

function failed(reason: ColourMergeFailure) {
	const [code, message] = failures[reason];
	return new ORPCError(code, { message });
}

function requireStore(context: Context) {
	if (!context.contextRuleCheckStore) {
		throw new ORPCError("SERVICE_UNAVAILABLE", {
			message: "Context Rule Checks are unavailable.",
		});
	}
	return context.contextRuleCheckStore;
}

function requireOverview<T>(overview: T | null) {
	if (!overview) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found" });
	}
	return overview;
}

export const contextRuleChecksRouter = {
	overview: protectedProcedure
		.input(contextRuleCheckOverviewInputSchema)
		.output(contextRuleCheckOverviewSchema)
		.handler(async ({ context, input }) =>
			requireOverview(
				await requireStore(context).overview(
					context.session.user.id,
					input.projectId
				)
			)
		),
	recheck: protectedProcedure
		.input(contextRuleRecheckInputSchema)
		.output(contextRuleCheckOverviewSchema)
		.handler(async ({ context, input }) =>
			requireOverview(
				await requireStore(context).recheck(
					context.session.user.id,
					input.projectId,
					input.assetRecordIds
				)
			)
		),
	previewMerge: protectedProcedure
		.input(colourMergePreviewInputSchema)
		.output(colourMergePreviewSchema)
		.handler(async ({ context, input }) => {
			const outcome = await requireStore(context).previewMerge(
				context.session.user.id,
				input
			);
			if (!outcome.ok) {
				throw failed(outcome.reason);
			}
			return outcome.value;
		}),
	applyMerge: protectedProcedure
		.input(colourMergeApplyInputSchema)
		.output(colourMergeResultSchema)
		.handler(async ({ context, input }) => {
			const outcome = await requireStore(context).applyMerge(
				context.session.user.id,
				input
			);
			if (!outcome.ok) {
				throw failed(outcome.reason);
			}
			return outcome.value;
		}),
};
