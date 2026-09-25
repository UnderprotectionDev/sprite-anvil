import { ORPCError } from "@orpc/server";
import {
	assetDerivativeCreateInputSchema,
	assetFamilyCreateInputSchema,
	assetFamilySummarySchema,
	assetRecordTrackingDetailSchema,
	assetRecordTrackingInputSchema,
	assetReferenceCreateInputSchema,
	assetVersionCreateInputSchema,
	assetVersionReviewInputSchema,
	assetVersionSummarySchema,
	derivativeSummarySchema,
	referenceSummarySchema,
	reviewEventSummarySchema,
} from "../asset-record-tracking";
import { protectedProcedure } from "../index";

function unwrapTrackingResult<T>(
	result:
		| { ok: true; value: T }
		| {
				ok: false;
				reason:
					| "conflict"
					| "not_found"
					| "review_blocked"
					| "storage_unavailable";
		  },
	missingMessage: string,
	conflictMessage: string,
	blockedMessage: string
) {
	if (result.ok) {
		return result.value;
	}
	if (result.reason === "not_found") {
		throw new ORPCError("NOT_FOUND", { message: missingMessage });
	}
	if (result.reason === "conflict") {
		throw new ORPCError("CONFLICT", { message: conflictMessage });
	}
	if (result.reason === "storage_unavailable") {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "Varlık Sürümü saklama alanı yapılandırılmamış.",
		});
	}
	throw new ORPCError("PRECONDITION_FAILED", { message: blockedMessage });
}

export const assetRecordTrackingRouter = {
	tracking: protectedProcedure
		.input(assetRecordTrackingInputSchema)
		.output(assetRecordTrackingDetailSchema)
		.handler(async ({ context, input }) => {
			const detail = await context.assetRecordTrackingStore.getTracking(
				context.session.user.id,
				input.projectId,
				input.assetRecordId
			);
			if (!detail) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık kaydı bulunamadı.",
				});
			}
			return assetRecordTrackingDetailSchema.parse(detail);
		}),
	createVersion: protectedProcedure
		.input(assetVersionCreateInputSchema)
		.output(assetVersionSummarySchema)
		.handler(async ({ context, input }) =>
			unwrapTrackingResult(
				await context.assetRecordTrackingStore.createVersion(
					context.session.user.id,
					input
				),
				"Varlık kaydı bulunamadı.",
				"Bu kimlik farklı içerik için kullanılmış.",
				"Aday Sürüm oluşturulamadı."
			)
		),
	recordReview: protectedProcedure
		.input(assetVersionReviewInputSchema)
		.output(reviewEventSummarySchema)
		.handler(async ({ context, input }) =>
			unwrapTrackingResult(
				await context.assetRecordTrackingStore.recordReview(
					context.session.user.id,
					input
				),
				"Varlık Sürümü bulunamadı.",
				"Bu karar kimliği farklı bir inceleme için kullanılmış.",
				"Onay için bütünlük kanıtı gerekir."
			)
		),
	createFamily: protectedProcedure
		.input(assetFamilyCreateInputSchema)
		.output(assetFamilySummarySchema)
		.handler(async ({ context, input }) =>
			unwrapTrackingResult(
				await context.assetRecordTrackingStore.createFamily(
					context.session.user.id,
					input
				),
				"Kayıt, Görsel Dünya veya onaylı Varlık Sürümü bulunamadı.",
				"Varlık kaydı zaten başka bir aileye bağlı veya aile adı kullanımda.",
				"Ana Tasarım olarak yalnız Onaylı Sürüm seçilebilir."
			)
		),
	createDerivative: protectedProcedure
		.input(assetDerivativeCreateInputSchema)
		.output(derivativeSummarySchema)
		.handler(async ({ context, input }) =>
			unwrapTrackingResult(
				await context.assetRecordTrackingStore.createDerivative(
					context.session.user.id,
					input
				),
				"Varlık kaydı veya aile bulunamadı.",
				"Türetilmiş kayıt başka bir aileye bağlı veya ilişki kimliği kullanılmış.",
				"Türetilmiş Varlık onaylı Ana Tasarıma bağlanmalıdır."
			)
		),
	createReference: protectedProcedure
		.input(assetReferenceCreateInputSchema)
		.output(referenceSummarySchema)
		.handler(async ({ context, input }) =>
			unwrapTrackingResult(
				await context.assetRecordTrackingStore.createReference(
					context.session.user.id,
					input
				),
				"Varlık kaydı veya Referans Sürümü bulunamadı.",
				"Referans kimliği farklı içerik için kullanılmış.",
				"Referans kaydedilemedi."
			)
		),
};
