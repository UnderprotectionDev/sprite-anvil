import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	profileContractActivateInputSchema,
	profileContractsCatalogSchema,
} from "../specialized-profile-contracts";

function getStore(context: Context) {
	if (!context.specializedProfileContractStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Specialized profile contract storage is unavailable.",
		});
	}
	return context.specializedProfileContractStore;
}

export const specializedProfileContractsRouter = {
	list: protectedProcedure
		.input(profileContractsCatalogSchema.pick({ projectId: true }))
		.output(profileContractsCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found" });
			}
			return profileContractsCatalogSchema.parse(catalog);
		}),
	activate: protectedProcedure
		.input(profileContractActivateInputSchema)
		.output(profileContractsCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getStore(context).activate(
				context.session.user.id,
				input
			);
			if (!catalog) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Özel Profil Sözleşmesi şablonu bulunamadı veya proje erişimi doğrulanamadı.",
				});
			}
			return profileContractsCatalogSchema.parse(catalog);
		}),
};
