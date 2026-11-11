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
					throw new ORPCError("NOT_FOUND", {
						message: "Export Bundle not found in this project.",
					});
				}
				return result;
			})
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
