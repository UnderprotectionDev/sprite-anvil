import { ORPCError } from "@orpc/server";
import {
	backgroundOperationCancelInputSchema,
	backgroundOperationGetInputSchema,
	backgroundOperationListInputSchema,
	backgroundOperationListSchema,
	backgroundOperationSchema,
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
	get: protectedProcedure
		.input(backgroundOperationGetInputSchema)
		.output(backgroundOperationSchema)
		.handler(async ({ context, input }) => {
			const operation = await requireStore(context).get(
				context.session.user.id,
				input.projectId,
				input.operationId
			);
			if (!operation) {
				throw new ORPCError("NOT_FOUND", {
					message: "Background Operation not found",
				});
			}
			return backgroundOperationSchema.parse(operation);
		}),
	cancel: protectedProcedure
		.input(backgroundOperationCancelInputSchema)
		.output(backgroundOperationSchema)
		.handler(async ({ context, input }) => {
			const result = await requireStore(context).requestCancel(
				context.session.user.id,
				input.projectId,
				input.operationId
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
