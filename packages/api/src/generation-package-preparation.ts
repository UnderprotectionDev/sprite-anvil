import { ORPCError } from "@orpc/server";
import type { Context } from "./context";
import {
	correctionErrors,
	createGenerationPackageSnapshot,
	type GenerationPackageCreateInput,
	type GenerationPackageSnapshot,
	generationPackageSchema,
	resolveCorrectionCoordinateSpace,
} from "./generation-packages";
import {
	checkProductionRecipeRoles,
	type ProductionRecipeContent,
} from "./production-recipes";
import { analyzeReferenceTransferConstraints } from "./reference-production";

function throwIfInvalidCorrection(error: Error) {
	if (error.message === correctionErrors.draftUnavailable) {
		throw new ORPCError("NOT_FOUND", {
			message: "Düzeltmenin Çalışma Taslağı bulunamadı.",
			cause: error,
		});
	}
	if (error.message === correctionErrors.draftStale) {
		throw new ORPCError("CONFLICT", {
			message:
				"Çalışma Taslağı işaretlemeden sonra değişti; düzeltmeyi yeniden hazırlayın.",
			cause: error,
		});
	}
	if (Object.values<string>(correctionErrors).includes(error.message)) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Düzeltme işaretleri veya hedef birim geçersiz.",
			cause: error,
		});
	}
}

/** The Working Draft space a correction refers to, read from the server; undefined without a correction. */
async function readCorrectionSpace(
	context: Context,
	userId: string,
	input: GenerationPackageCreateInput
) {
	const { correction } = input;
	if (!correction) {
		return;
	}
	return resolveCorrectionCoordinateSpace(
		correction,
		(await context.readPixelDraftCoordinateSpace?.(
			userId,
			input.projectId,
			correction.draft.id
		)) ?? null,
		input.assetRecordId
	);
}

function throwSnapshotError(error: unknown): never {
	if (error instanceof Error) {
		if (
			error.message === "A locked Unit Version does not belong to this record."
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Seçilen Birim Sürümleri bu Varlık Kaydına ait değil.",
				cause: error,
			});
		}
		throwIfInvalidCorrection(error);
		if (
			error.message === "The current Canonical Design is missing its version."
		) {
			throw new ORPCError("PRECONDITION_FAILED", {
				message:
					"Güncel Ana Tasarım sürümü bulunamadı. Ana Tasarımı düzeltip tekrar deneyin.",
				cause: error,
			});
		}
		if (
			error.message === "The Asset Record context scope could not be resolved."
		) {
			throw new ORPCError("PRECONDITION_FAILED", {
				message: "Varlık Kaydının Görsel Dünya veya Tema kapsamı bulunamadı.",
				cause: error,
			});
		}
	}
	throw error;
}

function assertRecipeRolesUsable(
	recipeRoles: ProductionRecipeContent["referenceRoles"],
	selected: Parameters<typeof checkProductionRecipeRoles>[1]
) {
	const check = checkProductionRecipeRoles(recipeRoles, selected);
	if (check.missingRoles.length > 0) {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: `Select a reference for these recipe roles before using the recipe: ${check.missingRoles.join(", ")}.`,
		});
	}
	if (check.conflictFeatures.length > 0) {
		throw new ORPCError("CONFLICT", {
			message: `The recipe's reference rules conflict with the selected references on: ${check.conflictFeatures.join(", ")}. Resolve the conflict before a Generation Package can be prepared.`,
		});
	}
}

export interface GenerationPackagePreparationOptions {
	/** Reference roles a Production Recipe expects; each needs a selected reference. */
	recipeRoles?: ProductionRecipeContent["referenceRoles"];
}

/**
 * Pins the current Project Context and selected references into a new,
 * immutable Generation Package. Shared by the direct request and by the use of
 * a Production Recipe so both consume the current context and block on the same
 * rule conflicts.
 */
export async function prepareGenerationPackage(
	context: Context,
	userId: string,
	input: GenerationPackageCreateInput,
	options: GenerationPackagePreparationOptions = {}
) {
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
		context.assetRecordStore.get(userId, input.projectId, input.assetRecordId),
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
			message: "Üretim Paketi yalnız etkin Varlık Kaydı için oluşturulabilir.",
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
	if (options.recipeRoles) {
		assertRecipeRolesUsable(options.recipeRoles, referenceConstraints);
	}
	const referenceAnalysis =
		analyzeReferenceTransferConstraints(referenceConstraints);
	if (referenceAnalysis.conflicts.length > 0) {
		throw new ORPCError("CONFLICT", {
			message:
				"Referans aktarım kurallarındaki izin-yasak çelişkileri çözülmeden Üretim Paketi oluşturulamaz.",
		});
	}

	let snapshot: GenerationPackageSnapshot;
	try {
		const correctionSpace = await readCorrectionSpace(context, userId, input);
		snapshot = createGenerationPackageSnapshot({
			assetRecord,
			assetVersionCatalog,
			correctionSpace,
			input,
			projectContext,
			projectContextScopeCatalog: scopeCatalog,
			referenceBoardImages,
			tracking: trackingDetail.tracking,
		});
	} catch (error) {
		return throwSnapshotError(error);
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
}
