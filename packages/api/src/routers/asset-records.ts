import { ORPCError } from "@orpc/server";
import {
	assetRecordCreateInputSchema,
	assetRecordGetInputSchema,
	assetRecordListInputSchema,
	assetRecordMetadataUpdateInputSchema,
	assetRecordSchema,
	assetRecordSearchInputSchema,
	assetRecordSearchResponseSchema,
} from "../asset-records";
import { protectedProcedure } from "../index";
import { assetRecordTrackingRouter } from "./asset-record-tracking";

export const assetRecordsRouter = {
	...assetRecordTrackingRouter,
	create: protectedProcedure
		.input(assetRecordCreateInputSchema)
		.output(assetRecordSchema)
		.handler(async ({ context, input }) => {
			const record = await context.assetRecordStore.create(
				context.session.user.id,
				input
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND", {
					message: "Project not found",
				});
			}
			const parsedRecord = assetRecordSchema.parse(record);
			const requestedCriteria = new Set(input.identityCriteria);
			if (
				parsedRecord.projectId !== input.projectId ||
				parsedRecord.name !== input.name ||
				parsedRecord.identityCriteria.length !== requestedCriteria.size ||
				parsedRecord.identityCriteria.some(
					(criteria) => !requestedCriteria.has(criteria)
				)
			) {
				throw new ORPCError("CONFLICT", {
					message: "Asset Record id is already used for different content",
				});
			}
			return parsedRecord;
		}),
	get: protectedProcedure
		.input(assetRecordGetInputSchema)
		.output(assetRecordSchema)
		.handler(async ({ context, input }) => {
			const record = await context.assetRecordStore.get(
				context.session.user.id,
				input.projectId,
				input.assetRecordId
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Record not found",
				});
			}
			return assetRecordSchema.parse(record);
		}),
	list: protectedProcedure
		.input(assetRecordListInputSchema)
		.output(assetRecordSchema.array())
		.handler(async ({ context, input }) => {
			const records = await context.assetRecordStore.list(
				context.session.user.id,
				input.projectId
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND", {
					message: "Project not found",
				});
			}
			return records.map((record) => assetRecordSchema.parse(record));
		}),
	search: protectedProcedure
		.input(assetRecordSearchInputSchema)
		.output(assetRecordSearchResponseSchema)
		.handler(async ({ context, input }) => {
			const results = await context.assetRecordStore.search(
				context.session.user.id,
				input
			);
			if (!results) {
				throw new ORPCError("NOT_FOUND", {
					message: "Project not found",
				});
			}
			return assetRecordSearchResponseSchema.parse(results);
		}),
	updateMetadata: protectedProcedure
		.input(assetRecordMetadataUpdateInputSchema)
		.output(assetRecordSchema)
		.handler(async ({ context, input }) => {
			const result = await context.assetRecordStore.updateMetadata(
				context.session.user.id,
				input
			);
			if (result.ok) {
				return assetRecordSchema.parse(result.record);
			}
			if (result.reason === "not_found") {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Record not found",
				});
			}
			if (result.reason === "invalid_scope") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Tema veya Görsel Dünya seçilen proje kapsamında olmalıdır.",
				});
			}
			throw new ORPCError("CONFLICT", {
				message:
					"Varlık Ailesine bağlı Varlık Kaydının Görsel Dünyası değiştirilemez.",
			});
		}),
};
