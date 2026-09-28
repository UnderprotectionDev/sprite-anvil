import { ORPCError } from "@orpc/server";
import {
	createGenerationPackageSnapshot,
	type GenerationPackageSnapshot,
	generationPackageCreateInputSchema,
	generationPackageListInputSchema,
	generationPackageSchema,
} from "../generation-packages";
import { protectedProcedure } from "../index";
import { analyzeReferenceTransferConstraints } from "../reference-production";

export const generationPackagesRouter = {
	create: protectedProcedure
		.input(generationPackageCreateInputSchema)
		.output(generationPackageSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const store = context.generationPackageStore;
			if (!(store && context.referenceProductionStore)) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Generation Package storage is not configured.",
				});
			}

			const [
				assetRecord,
				projectContext,
				trackingDetail,
				assetVersionCatalog,
				scopeCatalog,
				referenceBoardImages,
			] = await Promise.all([
				context.assetRecordStore.get(
					userId,
					input.projectId,
					input.assetRecordId
				),
				context.projectContextStore
					.listProjects(userId)
					.then(
						(projects) =>
							projects.find((project) => project.id === input.projectId) ?? null
					),
				context.assetRecordTrackingStore.getTracking(
					userId,
					input.projectId,
					input.assetRecordId
				),
				context.assetVersionStore.list(userId, input.projectId),
				context.projectContextScopeStore.list(userId, input.projectId),
				context.referenceProductionStore.listImages(
					userId,
					input.projectId,
					input.assetRecordId
				),
			]);

			if (
				!(
					assetRecord &&
					projectContext &&
					trackingDetail &&
					assetVersionCatalog &&
					scopeCatalog &&
					referenceBoardImages
				)
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık kaydı veya proje bulunamadı.",
				});
			}
			if (assetRecord.availability !== "active") {
				throw new ORPCError("PRECONDITION_FAILED", {
					message:
						"Üretim Paketi yalnız etkin Varlık Kaydı için oluşturulabilir.",
				});
			}

			const activeRevision = projectContext.currentContextRevision;
			if (!activeRevision.isActive) {
				throw new ORPCError("PRECONDITION_FAILED", {
					message: "Üretim Paketi için etkin Bağlam Sürümü gerekir.",
				});
			}

			const referenceConstraints = [
				...trackingDetail.tracking.references,
				...referenceBoardImages,
			];
			const referenceAnalysis =
				analyzeReferenceTransferConstraints(referenceConstraints);
			if (referenceAnalysis.conflicts.length > 0) {
				throw new ORPCError("CONFLICT", {
					message:
						"Eş kapsamlı referans aktarım çelişkileri çözülmeden Üretim Paketi oluşturulamaz.",
				});
			}

			let snapshot: GenerationPackageSnapshot;
			try {
				snapshot = createGenerationPackageSnapshot({
					assetRecord,
					assetVersionCatalog,
					input,
					projectContext,
					projectContextScopeCatalog: scopeCatalog,
					referenceBoardImages,
					tracking: trackingDetail.tracking,
				});
			} catch (error) {
				if (error instanceof Error) {
					if (
						error.message ===
						"A locked Unit Version does not belong to this record."
					) {
						throw new ORPCError("BAD_REQUEST", {
							message: "Seçilen Birim Sürümleri bu Varlık Kaydına ait değil.",
							cause: error,
						});
					}
					if (
						error.message ===
						"The current Canonical Design is missing its version."
					) {
						throw new ORPCError("PRECONDITION_FAILED", {
							message:
								"Güncel Ana Tasarım sürümü bulunamadı. Ana Tasarımı düzeltip tekrar deneyin.",
							cause: error,
						});
					}
					if (
						error.message ===
						"The Asset Record context scope could not be resolved."
					) {
						throw new ORPCError("PRECONDITION_FAILED", {
							message:
								"Varlık Kaydının Görsel Dünya veya Tema kapsamı bulunamadı.",
							cause: error,
						});
					}
				}
				throw error;
			}

			const generationPackage = await store.create(userId, {
				assetRecordId: input.assetRecordId,
				projectId: input.projectId,
				snapshot,
			});
			if (!generationPackage) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık kaydı veya proje bulunamadı.",
				});
			}
			return generationPackageSchema.parse(generationPackage);
		}),
	list: protectedProcedure
		.input(generationPackageListInputSchema)
		.output(generationPackageSchema.array())
		.handler(async ({ context, input }) => {
			if (!context.generationPackageStore) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Generation Package storage is not configured.",
				});
			}
			const packages = await context.generationPackageStore.list(
				context.session.user.id,
				input.projectId,
				input.assetRecordId
			);
			if (!packages) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık kaydı veya proje bulunamadı.",
				});
			}
			return packages.map((generationPackage) =>
				generationPackageSchema.parse(generationPackage)
			);
		}),
};
