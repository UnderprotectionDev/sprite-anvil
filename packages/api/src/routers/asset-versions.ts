import { ORPCError } from "@orpc/server";
import {
	assetFamilyCanonicalDesignInputSchema,
	assetFamilyCanonicalDesignSchema,
	assetVersionCatalogSchema,
	assetVersionListInputSchema,
	assetVersionReviewEventSchema,
	assetVersionReviewInputSchema,
} from "../asset-versions";
import type { Context } from "../context";
import { protectedProcedure } from "../index";

async function readVersionCatalog(context: Context, projectId: string) {
	const catalog = await context.assetVersionStore.list(
		context.session?.user.id ?? "",
		projectId
	);
	if (!catalog) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found" });
	}
	return assetVersionCatalogSchema.parse(catalog);
}

export const assetVersionsRouter = {
	list: protectedProcedure
		.input(assetVersionListInputSchema)
		.output(assetVersionCatalogSchema)
		.handler(async ({ context, input }) =>
			readVersionCatalog(context, input.projectId)
		),
	review: protectedProcedure
		.input(assetVersionReviewInputSchema)
		.output(assetVersionReviewEventSchema)
		.handler(async ({ context, input }) => {
			const catalog = await readVersionCatalog(context, input.projectId);
			const version = catalog.assetVersions.find(
				(item) => item.id === input.assetVersionId
			);
			if (!version) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık Sürümü bulunamadı.",
				});
			}
			if (version.reviewDisposition === input.decision) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Varlık Sürümünün güncel inceleme kararı zaten bu.",
				});
			}
			if (
				input.decision === "approved" &&
				!(version.integrityVerified && version.contentDigest)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Bütünlük doğrulaması tamamlanmamış bir Varlık Sürümü onaylanamaz.",
				});
			}
			if (
				input.decision === "approved" &&
				!(await context.verifyAssetVersionContent?.(
					context.session.user.id,
					input.projectId,
					input.assetVersionId
				))
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Saklanan Varlık Sürümü bütünlük doğrulamasından geçmediği için onaylanamaz.",
				});
			}
			const event = await context.assetVersionStore.recordReviewEvent(
				context.session.user.id,
				input
			);
			if (!event) {
				throw new ORPCError("CONFLICT", {
					message:
						"Varlık Sürümü bu sırada incelenmiş. Güncel durumu yeniden yükleyin.",
				});
			}
			return assetVersionReviewEventSchema.parse(event);
		}),
	selectCanonicalDesign: protectedProcedure
		.input(assetFamilyCanonicalDesignInputSchema)
		.output(assetFamilyCanonicalDesignSchema)
		.handler(async ({ context, input }) => {
			const [familyCatalog, versionCatalog] = await Promise.all([
				context.assetFamilyStore.list(context.session.user.id, input.projectId),
				readVersionCatalog(context, input.projectId),
			]);
			if (
				!familyCatalog?.assetFamilies.some(
					(item) => item.id === input.assetFamilyId
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Bu Projede Varlık Ailesi bulunamadı.",
				});
			}
			const version = versionCatalog.assetVersions.find(
				(item) => item.id === input.assetVersionId
			);
			if (!version || version.assetFamilyId !== input.assetFamilyId) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Ana Tasarım olarak yalnız aynı Varlık Ailesindeki bir Varlık Sürümü seçilebilir.",
				});
			}
			if (version.reviewDisposition !== "approved") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Ana Tasarım olarak yalnız onaylanmış bir Varlık Sürümü seçilebilir.",
				});
			}
			if (
				!(
					version.integrityVerified &&
					version.contentDigest &&
					(await context.verifyAssetVersionContent?.(
						context.session.user.id,
						input.projectId,
						input.assetVersionId
					))
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Bütünlüğü doğrulanmamış bir Varlık Sürümü Ana Tasarım olamaz.",
				});
			}
			const selection = await context.assetVersionStore.selectCanonicalDesign(
				context.session.user.id,
				input
			);
			if (!selection) {
				throw new ORPCError("CONFLICT", {
					message:
						"Ana Tasarım seçimi bu sırada değişti. Güncel durumu yeniden yükleyin.",
				});
			}
			return assetFamilyCanonicalDesignSchema.parse(selection);
		}),
};
