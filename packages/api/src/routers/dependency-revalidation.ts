import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import {
	changeFacetInputSchema,
	changeImpactSchema,
	dependencyCatalogInputSchema,
	dependencyCatalogSchema,
	dependencyLinkInputSchema,
	dependencyLinkSchema,
} from "../dependency-revalidation";
import { protectedProcedure } from "../index";

function getStore(context: Context) {
	if (!context.dependencyRevalidationStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Dependency revalidation storage is unavailable.",
		});
	}
	return context.dependencyRevalidationStore;
}
async function readCatalog(
	context: Context,
	userId: string,
	projectId: string
) {
	const catalog = await getStore(context).list(userId, projectId);
	if (!catalog) {
		throw new ORPCError("NOT_FOUND", { message: "Proje bulunamadı." });
	}
	return catalog;
}
export const dependencyRevalidationRouter = {
	list: protectedProcedure
		.input(dependencyCatalogInputSchema)
		.output(dependencyCatalogSchema)
		.handler(({ context, input }) =>
			readCatalog(context, context.session.user.id, input.projectId)
		),
	createLink: protectedProcedure
		.input(dependencyLinkInputSchema)
		.output(dependencyLinkSchema)
		.handler(async ({ context, input }) => {
			await readCatalog(context, context.session.user.id, input.projectId);
			const link = await getStore(context).createLink(
				context.session.user.id,
				input
			);
			if (!link) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Bağımlılık Bağlantısı aynı Projedeki farklı sürümleri bağlamalı, hedefi bir Türetilmiş Varlık Sürümü olmalı ve daha önce kaydedilmemiş olmalıdır.",
				});
			}
			return link;
		}),
	determine: protectedProcedure
		.input(changeFacetInputSchema)
		.output(changeImpactSchema)
		.handler(async ({ context, input }) => {
			await readCatalog(context, context.session.user.id, input.projectId);
			const impact = await getStore(context).determine(
				context.session.user.id,
				input
			);
			if (!impact) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Değişiklik Tanımı bu Projedeki bir Bağlam Sürümüne veya seçilmiş Ana Tasarıma ait olmalıdır.",
				});
			}
			return impact;
		}),
};
