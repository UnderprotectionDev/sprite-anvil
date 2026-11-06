import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import {
	type DeliveryTargetDraftSaveFailureReason,
	deliveryTargetActivateInputSchema,
	deliveryTargetCatalogSchema,
	deliveryTargetDraftSaveInputSchema,
	deliveryTargetDraftSchema,
	deliveryTargetListInputSchema,
	deliveryTargetRevisionSchema,
} from "../delivery-planning";
import { protectedProcedure } from "../index";

function getDeliveryTargetStore(context: Context) {
	if (!context.deliveryTargetStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Delivery Target storage is unavailable.",
		});
	}
	return context.deliveryTargetStore;
}

const projectNotFound = "Project not found.";

const rejectionMessages: Record<DeliveryTargetDraftSaveFailureReason, string> =
	{
		context_revision_not_found:
			"The selected Context Revision was not found in this project.",
		delivery_target_unavailable:
			"This Delivery Target id is already used by another project.",
		draft_id_conflict:
			"This Delivery Target draft id is already used for different content.",
		policy_family_not_pinned:
			"A Production Evidence Policy can only set requirements for Asset Families the target pins.",
		required_set_revision_not_found:
			"The selected Required Items List revision must belong to the target's Asset Family.",
	};

export const deliveryPlanningRouter = {
	activate: protectedProcedure
		.input(deliveryTargetActivateInputSchema)
		.output(deliveryTargetRevisionSchema)
		.handler(async ({ context, input }) => {
			const result = await getDeliveryTargetStore(context).activate(
				context.session.user.id,
				input
			);
			if (!result) {
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery Target draft to activate was not found.",
				});
			}
			if (result.status === "revision_number_conflict") {
				throw new ORPCError("CONFLICT", {
					message:
						"The Delivery Target revision number was taken repeatedly; try activating again.",
				});
			}
			return result.revision;
		}),
	list: protectedProcedure
		.input(deliveryTargetListInputSchema)
		.output(deliveryTargetCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getDeliveryTargetStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return catalog;
		}),
	saveDraft: protectedProcedure
		.input(deliveryTargetDraftSaveInputSchema)
		.output(deliveryTargetDraftSchema)
		.handler(async ({ context, input }) => {
			const result = await getDeliveryTargetStore(context).saveDraft(
				context.session.user.id,
				input
			);
			if (!result) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			if (result.status === "rejected") {
				throw new ORPCError(
					result.reason === "draft_id_conflict" ? "CONFLICT" : "BAD_REQUEST",
					{ message: rejectionMessages[result.reason] }
				);
			}
			return result.draft;
		}),
};
