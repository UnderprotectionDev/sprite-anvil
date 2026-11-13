import { ORPCError } from "@orpc/server";
import { backgroundOperationSchema } from "../background-operations";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	erasureImpactGetInputSchema,
	erasureImpactPrepareInputSchema,
	erasureImpactPrepareOutputSchema,
	erasureImpactReportSchema,
} from "../permanent-erasure";
import {
	deletionReceiptGetInputSchema,
	deletionReceiptRecordSchema,
	type ErasureApprovalRejection,
	erasureApprovalInputSchema,
} from "../permanent-erasure-deletion";
import type { ErasureImpactRejection } from "../permanent-erasure-scope";
import { withPublicationErrors } from "../record-publication";

function getErasureImpactStore(context: Context) {
	if (!context.erasureImpactStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Erasure Impact Report storage is unavailable.",
		});
	}
	return context.erasureImpactStore;
}

function getDeletionReceiptStore(context: Context) {
	if (!context.deletionReceiptStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Deletion Receipt storage is unavailable.",
		});
	}
	return context.deletionReceiptStore;
}

function getErasureApprovalOperations(context: Context) {
	if (!context.erasureApprovalOperations) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Erasure approval is unavailable.",
		});
	}
	return context.erasureApprovalOperations;
}

function rejectionMessage(rejection: ErasureImpactRejection): string {
	switch (rejection.reason) {
		case "already_erased":
			return "The asset is already erased, so no Erasure Impact Report was prepared.";
		case "no_managed_copies":
			return "The asset has no managed copies, so no Erasure Impact Report was prepared.";
		case "copy_digest_missing":
			return "Some managed copies have no recorded SHA-256 digest, so the exact scope cannot be pinned.";
		default:
			throw new Error(
				`Unhandled Erasure Impact rejection: ${String(rejection satisfies never)}`
			);
	}
}

function approvalRejectionMessage(rejection: ErasureApprovalRejection): string {
	switch (rejection.reason) {
		case "report_changed":
			return "The scope changed after the report was prepared, so the approval does not apply. Prepare a new Erasure Impact Report.";
		case "report_not_found":
			return "The Erasure Impact Report was not found.";
		case "report_unreadable":
			return "The Erasure Impact Report cannot be read or verified by this build.";
		case "counts_mismatch":
			return "The confirmed counts do not match the selection under this Erasure Impact Report.";
		case "unknown_container":
			return "Some selected containers are not part of the Erasure Impact Report.";
		default:
			throw new Error(
				`Unhandled erasure approval rejection: ${String(rejection satisfies never)}`
			);
	}
}

export const permanentErasureRouter = {
	/**
	 * The user's explicit approval of one exact Erasure Impact Report. It records
	 * the approval and its Deletion Job as an authoritative Background
	 * Operation; the same key and content returns the first operation.
	 */
	approveErasure: protectedProcedure
		.input(erasureApprovalInputSchema)
		.output(backgroundOperationSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getErasureApprovalOperations(context).approve(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: "Project not found." });
				}
				if (result.status === "rejected") {
					throw new ORPCError("BAD_REQUEST", {
						data: result,
						message: approvalRejectionMessage(result),
					});
				}
				return result.operation;
			})
		),
	getDeletionReceipt: protectedProcedure
		.input(deletionReceiptGetInputSchema)
		.output(deletionReceiptRecordSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const receipt = await getDeletionReceiptStore(context).get(
					context.session.user.id,
					input.projectId,
					input.receiptId
				);
				if (!receipt) {
					throw new ORPCError("NOT_FOUND", {
						message: "Deletion Receipt not found.",
					});
				}
				return receipt;
			})
		),
	getImpactReport: protectedProcedure
		.input(erasureImpactGetInputSchema)
		.output(erasureImpactReportSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const report = await getErasureImpactStore(context).get(
					context.session.user.id,
					input.projectId,
					input.reportId
				);
				if (!report) {
					throw new ORPCError("NOT_FOUND", {
						message: "Erasure Impact Report not found.",
					});
				}
				return report;
			})
		),
	prepareImpactReport: protectedProcedure
		.input(erasureImpactPrepareInputSchema)
		.output(erasureImpactPrepareOutputSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getErasureImpactStore(context).prepare(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project or asset not found.",
					});
				}
				if (result.status === "rejected") {
					throw new ORPCError("BAD_REQUEST", {
						data: result,
						message: rejectionMessage(result),
					});
				}
				return result;
			})
		),
};
