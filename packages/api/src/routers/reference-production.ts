import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../index";
import type { ReferenceBoardWriteResult } from "../reference-production";
import {
	analyzeReferenceTransferConstraints,
	referenceBoardListInputSchema,
	referenceBoardSchema,
	referenceBoardUpdateInputSchema,
} from "../reference-production";

function unwrapImageWriteResult(result: ReferenceBoardWriteResult) {
	if (result.ok) {
		return result.value;
	}
	if (result.reason === "not_found") {
		throw new ORPCError("NOT_FOUND", {
			message: "Referans görseli veya Varlık Kaydı bulunamadı.",
		});
	}
	if (result.reason === "context_override_required") {
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"Ana Tasarım kimliğini aşmak için Bağlam Kuralı İstisnası gerekçesi kaydedin.",
		});
	}
	throw new ORPCError("CONFLICT", {
		message: "Referans değişti. Güncel durumu yeniden yükleyip tekrar deneyin.",
	});
}

export const referenceProductionRouter = {
	list: protectedProcedure
		.input(referenceBoardListInputSchema)
		.output(referenceBoardSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			if (!context.referenceProductionStore) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Reference Production store is not configured.",
				});
			}
			const [tracking, imageReferences] = await Promise.all([
				context.assetRecordTrackingStore.getTracking(
					userId,
					input.projectId,
					input.assetRecordId
				),
				context.referenceProductionStore.listImages(
					userId,
					input.projectId,
					input.assetRecordId
				),
			]);
			if (!(tracking && imageReferences)) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık kaydı bulunamadı.",
				});
			}

			const assetVersionReferences = tracking.tracking.references;
			const analysis = analyzeReferenceTransferConstraints([
				...assetVersionReferences.map((reference) => ({
					id: reference.id,
					transferredFeatures: reference.transferredFeatures,
					forbiddenFeatures: reference.forbiddenFeatures,
				})),
				...imageReferences.map((reference) => ({
					id: reference.id,
					transferredFeatures: reference.transferredFeatures,
					forbiddenFeatures: reference.forbiddenFeatures,
				})),
			]);
			const conflictFeatures = new Map<string, Set<string>>();
			for (const conflict of analysis.conflicts) {
				for (const id of [
					...conflict.allowingReferenceIds,
					...conflict.forbiddingReferenceIds,
				]) {
					const features = conflictFeatures.get(id) ?? new Set<string>();
					features.add(conflict.feature);
					conflictFeatures.set(id, features);
				}
			}

			return referenceBoardSchema.parse({
				assetVersionReferences: assetVersionReferences.map((reference) => ({
					...reference,
					conflictFeatures: [...(conflictFeatures.get(reference.id) ?? [])],
				})),
				conflicts: analysis.conflicts,
				effectiveForbiddenFeatures: analysis.effectiveForbiddenFeatures,
				effectiveTransferredFeatures: analysis.effectiveTransferredFeatures,
				imageReferences: imageReferences.map((reference) => ({
					...reference,
					conflictFeatures: [...(conflictFeatures.get(reference.id) ?? [])],
				})),
			});
		}),
	updateImage: protectedProcedure
		.input(referenceBoardUpdateInputSchema)
		.handler(async ({ context, input }) => {
			if (!context.referenceProductionStore) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Reference Production store is not configured.",
				});
			}
			return unwrapImageWriteResult(
				await context.referenceProductionStore.updateImage(
					context.session.user.id,
					input
				)
			);
		}),
};
