import { ORPCError } from "@orpc/server";
import {
	backgroundOperationCancelInputSchema,
	backgroundOperationListInputSchema,
	backgroundOperationListSchema,
	backgroundOperationSchema,
	backgroundOperationSummarySchema,
} from "../background-operations";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

function requireStore(context: Context) {
	if (!context.backgroundOperationStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Background Operation storage is not configured.",
		});
	}
	return context.backgroundOperationStore;
}

export const backgroundOperationsRouter = {
	summary: protectedProcedure
		.input(backgroundOperationListInputSchema)
		.output(backgroundOperationSummarySchema)
		.handler(async ({ context, input }) => {
			const summary = await requireStore(context).summary(
				context.session.user.id,
				input.projectId
			);
			if (!summary) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			return summary;
		}),
	list: protectedProcedure
		.input(backgroundOperationListInputSchema)
		.output(backgroundOperationListSchema)
		.handler(async ({ context, input }) => {
			const operations = await requireStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!operations) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			return backgroundOperationListSchema.parse({ operations });
		}),
	cancel: protectedProcedure
		.input(backgroundOperationCancelInputSchema)
		.output(backgroundOperationSchema)
		.handler(async ({ context, input }) => {
			const result = await requireStore(context).requestCancel(
				context.session.user.id,
				input.projectId,
				input.id
			);
			if (result.outcome === "not_found") {
				throw new ORPCError("NOT_FOUND", {
					message: "Background Operation not found",
				});
			}
			if (result.outcome === "finished") {
				throw new ORPCError("CONFLICT", {
					message: `This operation already ${result.operation.status === "completed" ? "completed" : "failed"} and can no longer be cancelled.`,
				});
			}
			return backgroundOperationSchema.parse(result.operation);
		}),
};
