import { ORPCError } from "@orpc/server";
import {
	type AssetRecordStore,
	assetRecordCreateInputSchema,
	assetRecordGetInputSchema,
	assetRecordListInputSchema,
	assetRecordMeasurementsUpdateInputSchema,
	assetRecordSchema,
	type MutableAssetRecordAvailability,
} from "../asset-records";
import { protectedProcedure } from "../index";
import { assetRecordTrackingRouter } from "./asset-record-tracking";

async function setRecordAvailability(
	store: AssetRecordStore,
	userId: string,
	input: { assetRecordId: string; projectId: string },
	availability: MutableAssetRecordAvailability
) {
	const record = await store.setAvailability(
		userId,
		input.projectId,
		input.assetRecordId,
		availability
	);
	if (!record) {
		throw new ORPCError("NOT_FOUND", {
			message: "Asset Record not found",
		});
	}
	return assetRecordSchema.parse(record);
}

export const assetRecordsRouter = {
	...assetRecordTrackingRouter,
	archive: protectedProcedure
		.input(assetRecordGetInputSchema)
		.output(assetRecordSchema)
		.handler(({ context, input }) =>
			setRecordAvailability(
				context.assetRecordStore,
				context.session.user.id,
				input,
				"archived"
			)
		),
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
	updateMeasurements: protectedProcedure
		.input(assetRecordMeasurementsUpdateInputSchema)
		.output(assetRecordSchema)
		.handler(async ({ context, input }) => {
			const record = await context.assetRecordStore.updateMeasurements(
				context.session.user.id,
				input
			);
			if (!record) {
				throw new ORPCError("NOT_FOUND", {
					message: "Varlık kaydı bulunamadı.",
				});
			}
			return assetRecordSchema.parse(record);
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
	restore: protectedProcedure
		.input(assetRecordGetInputSchema)
		.output(assetRecordSchema)
		.handler(({ context, input }) =>
			setRecordAvailability(
				context.assetRecordStore,
				context.session.user.id,
				input,
				"active"
			)
		),
};
