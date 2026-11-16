import { ORPCError } from "@orpc/server";
import {
	assetDerivativeCreateInputSchema,
	assetFamilyCreateInputSchema,
	assetFamilySummarySchema,
	assetRecordTrackingDetailSchema,
	assetRecordTrackingInputSchema,
	assetReferenceCreateInputSchema,
	assetReferenceUpdateInputSchema,
	assetVersionCreateInputSchema,
	assetVersionReviewInputSchema,
	assetVersionSummarySchema,
	derivativeSummarySchema,
	manualImportVersionCreateInputSchema,
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
					| "context_override_required"
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
	if (result.reason === "context_override_required") {
		throw new ORPCError("PRECONDITION_FAILED", {
			message:
				"Record a Context Rule Exception rationale to depart from the Canonical Design identity.",
		});
	}
	if (result.reason === "storage_unavailable") {
		throw new ORPCError("PRECONDITION_FAILED", {
			message: "Asset Version storage is not configured.",
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
					message: "Asset Record not found.",
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
				"Asset Record not found.",
				"This ID has already been used for different content.",
				"Candidate Version could not be created."
			)
		),
	createManualImportVersion: protectedProcedure
		.input(manualImportVersionCreateInputSchema)
		.output(assetVersionSummarySchema)
		.handler(async ({ context, input }) =>
			unwrapTrackingResult(
				await context.assetRecordTrackingStore.createManualImportVersion(
					context.session.user.id,
					input
				),
				"Asset Record or Generation Package not found.",
				"This ID has already been used for different content.",
				"Candidate Version could not be created."
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
				"Asset Version not found.",
				"This decision ID has already been used for a different review.",
				"Approval requires verified file integrity and the required production evidence."
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
				"Asset Record, Visual World, or approved Asset Version not found.",
				"The Asset Record belongs to another family or the family name is already in use.",
				"Only an Approved Version can be selected as the Canonical Design."
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
				"Asset Record or Asset Family not found.",
				"The derived record belongs to another family or the relationship ID is already in use.",
				"The Derived Asset must be linked to an approved Canonical Design."
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
				"Asset Record or Reference Version not found.",
				"This reference ID has already been used for different content.",
				"Referans kaydedilemedi."
			)
		),
	updateReference: protectedProcedure
		.input(assetReferenceUpdateInputSchema)
		.output(referenceSummarySchema)
		.handler(async ({ context, input }) =>
			unwrapTrackingResult(
				await context.assetRecordTrackingStore.updateReference(
					context.session.user.id,
					input
				),
				"Asset Record or Reference Version not found.",
				"The reference changed. Reload the current state and try again.",
				"Reference rules could not be saved."
			)
		),
};
