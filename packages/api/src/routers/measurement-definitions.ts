import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import type { MeasurementDefinitionRejectionReason } from "../measurement-definition-store";
import {
	measurementDefinitionActivateInputSchema,
	measurementDefinitionCatalogSchema,
	measurementDefinitionSchema,
} from "../measurement-definitions";

function getMeasurementDefinitionStore(context: Context) {
	if (!context.measurementDefinitionStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Measurement Definition storage is unavailable.",
		});
	}
	return context.measurementDefinitionStore;
}

const rejections: Record<
	MeasurementDefinitionRejectionReason,
	{ code: "BAD_REQUEST" | "CONFLICT"; message: string }
> = {
	id_conflict: {
		code: "CONFLICT",
		message:
			"This Measurement Definition id is already used for different content.",
	},
	unsupported_contract_version: {
		code: "BAD_REQUEST",
		message:
			"This Measurement Definition contract major version is not supported, so it cannot be activated.",
	},
};

export const measurementDefinitionsRouter = {
	activate: protectedProcedure
		.input(measurementDefinitionActivateInputSchema)
		.output(measurementDefinitionSchema)
		.handler(async ({ context, input }) => {
			const result = await getMeasurementDefinitionStore(context).activate(
				context.session.user.id,
				input
			);
			if (result.status === "rejected") {
				const { code, message } = rejections[result.reason];
				throw new ORPCError(code, { message });
			}
			if (result.status === "version_conflict") {
				throw new ORPCError("CONFLICT", {
					message:
						"The Measurement Definition version number was taken repeatedly; try activating again.",
				});
			}
			return result.definition;
		}),
	list: protectedProcedure
		.output(measurementDefinitionCatalogSchema)
		.handler(({ context }) =>
			getMeasurementDefinitionStore(context).list(context.session.user.id)
		),
};
