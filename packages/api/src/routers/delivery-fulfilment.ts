import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import {
	fulfilmentMappingDraftListSchema,
	fulfilmentMappingDraftSchema,
	fulfilmentMappingGetInputSchema,
	fulfilmentMappingListInputSchema,
	fulfilmentMappingPrepareInputSchema,
} from "../delivery-fulfilment";
import { protectedProcedure } from "../index";
import { withPublicationErrors } from "../record-publication";

function getStore(context: Context) {
	if (!context.fulfilmentMappingStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Delivery Fulfilment storage is unavailable.",
		});
	}
	return context.fulfilmentMappingStore;
}

const targetNotFound = "Delivery Target not found.";
const draftNotFound = "Fulfilment mapping draft not found.";

const rejections = {
	no_active_revision:
		"This Delivery Target has no activated revision, so there is nothing to map.",
	target_not_ready:
		"Only a Ready Delivery Target can have a mapping prepared; resolve its Readiness Plan blockers first.",
} as const;

export const deliveryFulfilmentRouter = {
	/** Reads a persisted mapping draft back from storage. */
	getMapping: protectedProcedure
		.input(fulfilmentMappingGetInputSchema)
		.output(fulfilmentMappingDraftSchema)
		.handler(async ({ context, input }) => {
			const draft = await getStore(context).get(context.session.user.id, input);
			if (!draft) {
				throw new ORPCError("NOT_FOUND", { message: draftNotFound });
			}
			return draft;
		}),
	listMappings: protectedProcedure
		.input(fulfilmentMappingListInputSchema)
		.output(fulfilmentMappingDraftListSchema)
		.handler(async ({ context, input }) => {
			const list = await getStore(context).list(context.session.user.id, input);
			if (!list) {
				throw new ORPCError("NOT_FOUND", { message: targetNotFound });
			}
			return list;
		}),
	/**
	 * Proposes the mapping of the active revision's required items to the exact
	 * bundles and Asset Versions, with missing and conflicting items shown. It
	 * creates no Delivery Fulfilment and decides nothing for the user.
	 */
	prepareMapping: protectedProcedure
		.input(fulfilmentMappingPrepareInputSchema)
		.output(
			z.object({
				draft: fulfilmentMappingDraftSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getStore(context).prepare(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: targetNotFound });
				}
				if (result.status === "rejected") {
					throw new ORPCError("CONFLICT", {
						message: rejections[result.reason],
					});
				}
				return result;
			})
		),
};
