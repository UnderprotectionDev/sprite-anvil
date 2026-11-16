import { ORPCError } from "@orpc/server";
import { protectedProcedure } from "../index";
import type { RightsRecordStore } from "../rights-records";
import {
	rightsRecordCreateInputSchema,
	rightsRecordListInputSchema,
	rightsRecordSchema,
} from "../rights-records";

function getRightsRecordStore(context: {
	rightsRecordStore?: RightsRecordStore;
}) {
	const store = context.rightsRecordStore;
	if (!store) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Rights Record storage is not configured.",
		});
	}
	return store;
}

export const rightsRecordsRouter = {
	create: protectedProcedure
		.input(rightsRecordCreateInputSchema)
		.output(rightsRecordSchema)
		.handler(async ({ context, input }) => {
			const result = await getRightsRecordStore(context).createRevision(
				context.session.user.id,
				input
			);
			if (!result.ok) {
				if (result.reason === "not_found") {
					throw new ORPCError("NOT_FOUND", {
						message: "Asset Record not found.",
					});
				}
				throw new ORPCError("CONFLICT", {
					message:
						"The new Rights Record version could not be created. Refresh the history and try again.",
				});
			}
			return rightsRecordSchema.parse(result.record);
		}),
	list: protectedProcedure
		.input(rightsRecordListInputSchema)
		.output(rightsRecordSchema.array())
		.handler(async ({ context, input }) => {
			const records = await getRightsRecordStore(context).list(
				context.session.user.id,
				input.projectId,
				input.assetRecordId,
				input.referenceId ?? null
			);
			if (!records) {
				throw new ORPCError("NOT_FOUND", {
					message: "Asset Record not found.",
				});
			}
			return records.map((record) => rightsRecordSchema.parse(record));
		}),
};
