import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import {
	historicalRiskNoticeListInputSchema,
	historicalRiskNoticeListSchema,
} from "../historical-risk-notices";
import { protectedProcedure } from "../index";

function getStore(context: Context) {
	const store = context.historicalRiskNoticeStore;
	if (!store) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Historical Risk Notice storage is unavailable.",
		});
	}
	return store;
}

export const historicalRiskNoticesRouter = {
	/** The immutable Historical Risk Notices of a target's Delivery Fulfilments, newest first. */
	list: protectedProcedure
		.input(historicalRiskNoticeListInputSchema)
		.output(historicalRiskNoticeListSchema)
		.handler(async ({ context, input }) => {
			const list = await getStore(context).list(context.session.user.id, input);
			if (!list) {
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery Target not found.",
				});
			}
			return list;
		}),
};
