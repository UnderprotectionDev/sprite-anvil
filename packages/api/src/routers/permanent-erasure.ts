import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	type ErasureImpactRejection,
	erasureImpactGetInputSchema,
	erasureImpactPrepareInputSchema,
	erasureImpactReportSchema,
} from "../permanent-erasure";
import {
	deletionReceiptGetInputSchema,
	deletionReceiptRecordSchema,
} from "../permanent-erasure-deletion";
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

export const permanentErasureRouter = {
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
		.output(
			z.object({
				report: erasureImpactReportSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
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
