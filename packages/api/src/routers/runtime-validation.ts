import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import { withPublicationErrors } from "../record-publication";
import {
	runtimeValidationEvidenceSchema,
	runtimeValidationRecordCreateInputSchema,
	runtimeValidationRecordGetInputSchema,
	runtimeValidationRecordListInputSchema,
	runtimeValidationRecordListSchema,
	runtimeValidationRecordSchema,
	runtimeValidationTextEvidenceInputSchema,
} from "../runtime-validation";
import {
	runtimeValidationConfirmFailureSourceInputSchema,
	runtimeValidationDecisionResultSchema,
	runtimeValidationFinalizeOutcomeInputSchema,
} from "../runtime-validation-decisions";
import {
	evaluateRuntimeValidationCriterion,
	runtimeValidationReadinessInputSchema,
	runtimeValidationReadinessSchema,
} from "../runtime-validation-readiness";
import type { RuntimeValidationDecisionResult } from "../runtime-validation-store";

function getRuntimeValidationStore(context: Context) {
	if (!context.runtimeValidationStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Runtime Validation storage is unavailable.",
		});
	}
	return context.runtimeValidationStore;
}

const projectNotFound = "Project not found.";
const recordNotFound = "Runtime Validation Record not found.";

const decisionRejections = {
	outcome_already_decided:
		"The outcome of this Runtime Validation Record is already final; a changed result needs a new record.",
	outcome_not_decided:
		"Finalize the outcome as Fail before confirming a failure source.",
	outcome_not_fail:
		"A failure source can only be confirmed on a Runtime Validation Record whose outcome is Fail.",
} as const;

function decisionOrThrow(result: RuntimeValidationDecisionResult | null) {
	if (!result) {
		throw new ORPCError("NOT_FOUND", { message: recordNotFound });
	}
	if (result.status === "rejected") {
		throw new ORPCError("CONFLICT", {
			message: decisionRejections[result.reason],
		});
	}
	return result;
}

export const runtimeValidationRouter = {
	addTextEvidence: protectedProcedure
		.input(runtimeValidationTextEvidenceInputSchema)
		.output(
			z.object({
				evidence: runtimeValidationEvidenceSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getRuntimeValidationStore(context).addTextEvidence(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: recordNotFound });
				}
				if (result.status === "rejected") {
					throw new ORPCError("CONFLICT", {
						message: decisionRejections[result.reason],
					});
				}
				return result;
			})
		),
	create: protectedProcedure
		.input(runtimeValidationRecordCreateInputSchema)
		.output(
			z.object({
				record: runtimeValidationRecordSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getRuntimeValidationStore(context).create(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: projectNotFound });
				}
				if (result.status === "rejected") {
					if (result.reason === "superseded_record_mismatch") {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"A retest can supersede only a record of the same Export Bundle, game build, engine version and adapter version.",
						});
					}
					throw new ORPCError("NOT_FOUND", {
						message:
							result.reason === "bundle_not_found"
								? "Export Bundle not found in this project."
								: "The Runtime Validation Record to supersede was not found in this project.",
					});
				}
				return result;
			})
		),
	confirmFailureSource: protectedProcedure
		.input(runtimeValidationConfirmFailureSourceInputSchema)
		.output(runtimeValidationDecisionResultSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () =>
				decisionOrThrow(
					await getRuntimeValidationStore(context).confirmFailureSource(
						context.session.user.id,
						input
					)
				)
			)
		),
	/** Whether the exact bundle meets a Delivery Target revision's runtime validation criterion, with each blocker. */
	deliveryTargetReadiness: protectedProcedure
		.input(runtimeValidationReadinessInputSchema)
		.output(runtimeValidationReadinessSchema)
		.handler(async ({ context, input }) => {
			if (!context.deliveryTargetStore) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Delivery Target storage is unavailable.",
				});
			}
			const userId = context.session.user.id;
			const catalog = await context.deliveryTargetStore.list(
				userId,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			const revision = catalog.deliveryTargets
				.flatMap((target) => target.revisions)
				.find((candidate) => candidate.id === input.revisionId);
			if (!revision) {
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery Target revision not found.",
				});
			}
			if (!context.exportBundleStore) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Export Bundle storage is unavailable.",
				});
			}
			if (
				!(await context.exportBundleStore.get(
					userId,
					input.projectId,
					input.bundleId
				))
			) {
				throw new ORPCError("NOT_FOUND", {
					message: "Export Bundle not found in this project.",
				});
			}
			// Retests supersede within one bundle, so this bundle's records are enough.
			const records = await getRuntimeValidationStore(context).list(
				userId,
				input.projectId,
				input.bundleId
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return evaluateRuntimeValidationCriterion(
				revision.runtimeValidationCriterion,
				input.bundleId,
				records.records
			);
		}),
	finalizeOutcome: protectedProcedure
		.input(runtimeValidationFinalizeOutcomeInputSchema)
		.output(runtimeValidationDecisionResultSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () =>
				decisionOrThrow(
					await getRuntimeValidationStore(context).finalizeOutcome(
						context.session.user.id,
						input
					)
				)
			)
		),
	get: protectedProcedure
		.input(runtimeValidationRecordGetInputSchema)
		.output(runtimeValidationRecordSchema)
		.handler(async ({ context, input }) => {
			const record = await getRuntimeValidationStore(context).get(
				context.session.user.id,
				input.projectId,
				input.recordId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND", { message: recordNotFound });
			}
			return record;
		}),
	list: protectedProcedure
		.input(runtimeValidationRecordListInputSchema)
		.output(runtimeValidationRecordListSchema)
		.handler(async ({ context, input }) => {
			const list = await getRuntimeValidationStore(context).list(
				context.session.user.id,
				input.projectId,
				input.bundleId
			);
			if (!list) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return list;
		}),
};
