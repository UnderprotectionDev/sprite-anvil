import { ORPCError } from "@orpc/server";
import { z } from "zod";
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

const rejections: Record<
	MeasurementEventRejectionReason,
	{ code: "BAD_REQUEST" | "CONFLICT"; message: string }
> = {
	definition_not_found: {
		code: "BAD_REQUEST",
		message: "No activated Measurement Definition with this id exists for you.",
	},
	event_not_in_definition: {
		code: "BAD_REQUEST",
		message:
			"This event is neither the start nor the end event of the Measurement Definition.",
	},
	id_conflict: {
		code: "CONFLICT",
		message: "This event id is already used for a different event.",
	},
	invalid_event: {
		code: "BAD_REQUEST",
		message: "The event does not match the privacy-preserving envelope.",
	},
	project_not_found: {
		code: "BAD_REQUEST",
		message: "No project with this id exists for you.",
	},
	project_out_of_scope: {
		code: "BAD_REQUEST",
		message: "This project is outside the Measurement Definition's scope.",
	},
	surface_out_of_scope: {
		code: "BAD_REQUEST",
		message: "This surface is outside the Measurement Definition's scope.",
	},
	user_out_of_scope: {
		code: "BAD_REQUEST",
		message: "This user is outside the Measurement Definition's scope.",
	},
};

const verificationBoundaryInputSchema = z.discriminatedUnion("phase", [
	z
		.object({
			projectId: z.uuid(),
			workflowId: z.uuid(),
			phase: z.literal("start"),
		})
		.strict(),
	z
		.object({
			projectId: z.uuid(),
			workflowId: z.uuid(),
			phase: z.literal("finish"),
			outcome: z.enum(["verified", "failed"]),
		})
		.strict(),
]);
export const measurementEventsRouter = {
	recordVerificationBoundary: protectedProcedure
		.input(verificationBoundaryInputSchema)
		.output(z.object({ accepted: z.literal(true) }).strict())
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			if (!(await context.projectAccess.getProject(userId, input.projectId))) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found." });
			}
			if (!(context.productMeasurementRecorder && context.surface)) {
				throw new ORPCError("SERVICE_UNAVAILABLE", {
					message: "Measurement unavailable.",
				});
			}
			await context.productMeasurementRecorder.record({
				userId,
				projectId: input.projectId,
				workflowId: input.workflowId,
				eventFamily: "offline_verification",
				eventName:
					input.phase === "start"
						? "bundle_verification_started"
						: "bundle_verification_finished",
				phase: input.phase,
				recordKind: "offline_verification",
				outcomeClass:
					input.phase === "start" ? "workflow_started" : input.outcome,
				surface: context.surface,
				counters: {},
			});
			return { accepted: true as const };
		}),
	record: protectedProcedure
		.input(measurementEventRecordInputSchema)
		.output(measurementEventSchema)
		.handler(async ({ context, input }) => {
			const result = await getMeasurementEventStore(context).record(
				context.session.user.id,
				input
			);
			if (result.status === "rejected") {
				const { code, message } = rejections[result.reason];
				throw new ORPCError(code, { message });
			}
			return result.event;
		}),
};
