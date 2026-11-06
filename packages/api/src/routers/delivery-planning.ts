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

const projectNotFound = "Proje bulunamadı.";

const rejectionMessages: Record<DeliveryTargetDraftSaveFailureReason, string> =
	{
		context_revision_not_found: "Seçilen Bağlam Sürümü bu projede bulunamadı.",
		policy_family_not_pinned:
			"Üretim Kanıtı Politikası yalnızca hedefte seçili Varlık Ailelerine gereksinim verebilir.",
		required_set_revision_not_found:
			"Seçilen Gerekli Öğeler Listesi sürümü, hedefteki Varlık Ailesine ait bir sürüm olmalıdır.",
	};

export const deliveryPlanningRouter = {
	activate: protectedProcedure
		.input(deliveryTargetActivateInputSchema)
		.output(deliveryTargetRevisionSchema)
		.handler(async ({ context, input }) => {
			const revision = await getDeliveryTargetStore(context).activate(
				context.session.user.id,
				input
			);
			if (!revision) {
				throw new ORPCError("NOT_FOUND", {
					message: "Etkinleştirilecek Teslimat Hedefi taslağı bulunamadı.",
				});
			}
			return revision;
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
				throw new ORPCError("BAD_REQUEST", {
					message: rejectionMessages[result.reason],
				});
			}
			return result.draft;
		}),
};
