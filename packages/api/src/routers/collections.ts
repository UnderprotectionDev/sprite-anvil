import { ORPCError } from "@orpc/server";
import {
	collectionCatalogSchema,
	collectionCreateInputSchema,
	collectionListInputSchema,
	collectionMembershipInputSchema,
	collectionMembershipSchema,
	collectionRecordSchema,
} from "../collections";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

async function readCatalog(context: Context, projectId: string) {
	const catalog = await context.collectionStore.list(
		context.session?.user.id ?? "",
		projectId
	);
	if (!catalog) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found" });
	}
	return collectionCatalogSchema.parse(catalog);
}

export const collectionsRouter = {
	list: protectedProcedure
		.input(collectionListInputSchema)
		.output(collectionCatalogSchema)
		.handler(({ context, input }) => readCatalog(context, input.projectId)),
	create: protectedProcedure
		.input(collectionCreateInputSchema)
		.output(collectionRecordSchema)
		.handler(async ({ context, input }) => {
			await readCatalog(context, input.projectId);
			const collection = await context.collectionStore.create(
				context.session.user.id,
				input
			);
			if (!collection) {
				throw new ORPCError("CONFLICT", {
					message: "Koleksiyon oluşturulamadı. Projeyi yeniden yükleyin.",
				});
			}
			return collectionRecordSchema.parse(collection);
		}),
	addAssetRecord: protectedProcedure
		.input(collectionMembershipInputSchema)
		.output(collectionMembershipSchema)
		.handler(async ({ context, input }) => {
			const catalog = await readCatalog(context, input.projectId);
			if (!catalog.collections.some((item) => item.id === input.collectionId)) {
				throw new ORPCError("NOT_FOUND", {
					message: "Bu Projede Koleksiyon bulunamadı.",
				});
			}
			const assetRecord = catalog.assetRecords.find(
				(item) => item.id === input.assetRecordId
			);
			if (!assetRecord) {
				throw new ORPCError("NOT_FOUND", {
					message: "Bu Projede Varlık Kaydı bulunamadı.",
				});
			}
			if (assetRecord.availability === "erased") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Silinmiş Varlık Kaydı Koleksiyona eklenemez.",
				});
			}

			const membership = await context.collectionStore.addAssetRecord(
				context.session.user.id,
				input
			);
			if (!membership) {
				throw new ORPCError("CONFLICT", {
					message:
						"Varlık Kaydı Koleksiyona eklenemedi. Koleksiyonu yeniden yükleyin.",
				});
			}
			return collectionMembershipSchema.parse(membership);
		}),
	removeAssetRecord: protectedProcedure
		.input(collectionMembershipInputSchema)
		.output(collectionMembershipSchema)
		.handler(async ({ context, input }) => {
			const catalog = await readCatalog(context, input.projectId);
			if (
				!catalog.memberships.some(
					(item) =>
						item.collectionId === input.collectionId &&
						item.assetRecordId === input.assetRecordId
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Koleksiyon üyeliği bulunamadı.",
				});
			}
			const membership = await context.collectionStore.removeAssetRecord(
				context.session.user.id,
				input
			);
			if (!membership) {
				throw new ORPCError("CONFLICT", {
					message:
						"Koleksiyon üyeliği kaldırılamadı. Koleksiyonu yeniden yükleyin.",
				});
			}
			return collectionMembershipSchema.parse(membership);
		}),
};
