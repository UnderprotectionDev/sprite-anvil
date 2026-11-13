import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import type { MeasurementEventRejectionReason } from "../measurement-event-store";
import {
	measurementEventRecordInputSchema,
	measurementEventSchema,
} from "../measurement-events";

function getMeasurementEventStore(context: Context) {
	if (!context.measurementEventStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Measurement Event storage is unavailable.",
		});
	}
	return context.measurementEventStore;
}

const rejectionMessages: Record<MeasurementEventRejectionReason, string> = {
	definition_not_found:
		"No activated Measurement Definition with this id exists for you.",
	event_not_in_definition:
		"This event is neither the start nor the end event of the Measurement Definition.",
	id_conflict: "This event id is already used for a different event.",
	invalid_event: "The event does not match the privacy-preserving envelope.",
	surface_out_of_scope:
		"This surface is outside the Measurement Definition's scope.",
};

export const measurementEventsRouter = {
	record: protectedProcedure
		.input(measurementEventRecordInputSchema)
		.output(measurementEventSchema)
		.handler(async ({ context, input }) => {
			const result = await getMeasurementEventStore(context).record(
				context.session.user.id,
				input
			);
			if (result.status === "rejected") {
				throw new ORPCError(
					result.reason === "id_conflict" ? "CONFLICT" : "BAD_REQUEST",
					{ message: rejectionMessages[result.reason] }
				);
			}
			return result.event;
		}),
};
