import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	platformEquivalenceOverviewInputSchema,
	platformEquivalenceOverviewSchema,
	platformEquivalenceReportCreateInputSchema,
	platformEquivalenceReportGetInputSchema,
	platformEquivalenceReportSchema,
	platformEquivalenceRunRecordInputSchema,
	platformEquivalenceRunSchema,
} from "../platform-equivalence";
import { withPublicationErrors } from "../record-publication";

function getPlatformEquivalenceStore(context: Context) {
	if (!context.platformEquivalenceStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Platform Equivalence storage is unavailable.",
		});
	}
	return context.platformEquivalenceStore;
}

const projectNotFound = "Project not found.";

const reportRejections = {
	no_runs_chosen: "Choose at least one run to compare.",
	run_not_found: "A chosen run was not found in this project.",
	run_surface_mismatch:
		"A chosen run was recorded for the other surface than the one it was chosen for.",
} as const;

export const platformEquivalenceRouter = {
	createReport: protectedProcedure
		.input(platformEquivalenceReportCreateInputSchema)
		.output(
			z.object({
				report: platformEquivalenceReportSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getPlatformEquivalenceStore(context).createReport(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: projectNotFound });
				}
				if (result.status === "rejected") {
					throw new ORPCError("BAD_REQUEST", {
						data: result,
						message: reportRejections[result.reason],
					});
				}
				return result;
			})
		),
	getReport: protectedProcedure
		.input(platformEquivalenceReportGetInputSchema)
		.output(platformEquivalenceReportSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const report = await getPlatformEquivalenceStore(context).getReport(
					context.session.user.id,
					input.projectId,
					input.reportId
				);
				if (!report) {
					throw new ORPCError("NOT_FOUND", {
						message: "Platform Equivalence Report not found.",
					});
				}
				return report;
			})
		),
	overview: protectedProcedure
		.input(platformEquivalenceOverviewInputSchema)
		.output(platformEquivalenceOverviewSchema)
		.handler(async ({ context, input }) => {
			const overview = await getPlatformEquivalenceStore(context).overview(
				context.session.user.id,
				input.projectId
			);
			if (!overview) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return overview;
		}),
	recordRun: protectedProcedure
		.input(platformEquivalenceRunRecordInputSchema)
		.output(
			z.object({
				run: platformEquivalenceRunSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getPlatformEquivalenceStore(context).recordRun(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: projectNotFound });
				}
				if (result.status === "rejected") {
					throw new ORPCError("NOT_FOUND", {
						data: result,
						message: "Export Bundle not found.",
					});
				}
				return result;
			})
		),
};
