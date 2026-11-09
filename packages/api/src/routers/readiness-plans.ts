import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	type ReadinessPlanReorderFailureReason,
	readinessPlanGetInputSchema,
	readinessPlanReorderInputSchema,
	readinessPlanSchema,
} from "../readiness-plans";

function getReadinessPlanStore(context: Context) {
	if (!context.readinessPlanStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Readiness Plan storage is unavailable.",
		});
	}
	return context.readinessPlanStore;
}

const notFound = "Delivery Target not found.";
const noActiveRevision =
	"This Delivery Target has no activated revision, so it has no Readiness Plan yet.";

const rejectionMessages: Record<ReadinessPlanReorderFailureReason, string> = {
	revision_not_active:
		"The Readiness Plan belongs to a Delivery Target revision that is no longer active.",
	work_missing_from_order:
		"The order must include every dependent work item of the current plan.",
	work_not_in_plan:
		"The order names work that is not part of the current plan.",
};

/** Maps the store's shared non-success outcomes of both procedures to API errors. */
function orThrow<Result extends { status: string }>(result: Result | null) {
	if (!result) {
		throw new ORPCError("NOT_FOUND", { message: notFound });
	}
	if (result.status === "no_active_revision") {
		throw new ORPCError("CONFLICT", { message: noActiveRevision });
	}
	return result as Exclude<Result, { status: "no_active_revision" }>;
}

export const readinessPlansRouter = {
	get: protectedProcedure
		.input(readinessPlanGetInputSchema)
		.output(readinessPlanSchema)
		.handler(async ({ context, input }) => {
			const result = orThrow(
				await getReadinessPlanStore(context).get(context.session.user.id, input)
			);
			return result.plan;
		}),
	reorder: protectedProcedure
		.input(readinessPlanReorderInputSchema)
		.output(readinessPlanSchema)
		.handler(async ({ context, input }) => {
			const result = orThrow(
				await getReadinessPlanStore(context).reorder(
					context.session.user.id,
					input
				)
			);
			if (result.status === "rejected") {
				// Every rejection means the plan changed after the user read it: the input
				// schema already refuses malformed orders (duplicates, bad ids) as
				// BAD_REQUEST, so a work-set mismatch here is a stale order.
				throw new ORPCError("CONFLICT", {
					message: rejectionMessages[result.reason],
				});
			}
			return result.plan;
		}),
};
