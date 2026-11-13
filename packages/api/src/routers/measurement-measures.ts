import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import { measurementMeasureReportSchema } from "../measurement-measures";

function getMeasurementMeasureStore(context: Context) {
	if (!context.measurementMeasureStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Measurement Measure storage is unavailable.",
		});
	}
	return context.measurementMeasureStore;
}

export const measurementMeasuresRouter = {
	compute: protectedProcedure
		.output(measurementMeasureReportSchema)
		.handler(({ context }) =>
			getMeasurementMeasureStore(context).compute(context.session.user.id)
		),
};
