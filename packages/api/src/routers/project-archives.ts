import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import type { ProjectArchiveRejection } from "../project-archives";
import {
	projectArchiveCatalogSchema,
	projectArchiveCreateInputSchema,
	projectArchiveGetInputSchema,
	projectArchiveListInputSchema,
	projectArchiveSchema,
} from "../project-archives";
import { withPublicationErrors } from "../record-publication";

function getProjectArchiveStore(context: Context) {
	if (!context.projectArchiveStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Project Archive storage is unavailable.",
		});
	}
	return context.projectArchiveStore;
}

const projectNotFound = "Project not found.";

function assertNever(rejection: never): never {
	throw new Error(`Unhandled Project Archive rejection: ${String(rejection)}`);
}

function rejectionMessage(rejection: ProjectArchiveRejection): string {
	switch (rejection.reason) {
		case "working_file_unavailable":
			return "Some selected working files were not found in the project.";
		case "asset_digest_missing":
			return "Some Asset Versions have no recorded SHA-256 digest and cannot be pinned.";
		case "secret_detected":
			return "The archive would carry credential-like fields and was not created.";
		case "inconsistent_records":
			return "The project records are inconsistent, so the archive was not created.";
		case "file_unverifiable":
			return "Some files could not be verified against their recorded digest, so the archive was not created.";
		default:
			return assertNever(rejection);
	}
}

export const projectArchivesRouter = {
	create: protectedProcedure
		.input(projectArchiveCreateInputSchema)
		.output(
			z.object({
				archive: projectArchiveSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getProjectArchiveStore(context).create(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: projectNotFound });
				}
				if (result.status === "rejected") {
					throw new ORPCError("BAD_REQUEST", {
						data: result,
						message: rejectionMessage(result),
					});
				}
				return result;
			})
		),
	get: protectedProcedure
		.input(projectArchiveGetInputSchema)
		.output(projectArchiveSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const archive = await getProjectArchiveStore(context).get(
					context.session.user.id,
					input.projectId,
					input.archiveId
				);
				if (!archive) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project Archive not found.",
					});
				}
				return archive;
			})
		),
	list: protectedProcedure
		.input(projectArchiveListInputSchema)
		.output(projectArchiveCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getProjectArchiveStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return catalog;
		}),
};
