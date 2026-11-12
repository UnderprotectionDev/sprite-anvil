import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { backgroundOperationSchema } from "../background-operations";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	type ProjectArchiveRestoreRejection,
	projectArchiveRestoreCatalogSchema,
	projectArchiveRestoreGetInputSchema,
	projectArchiveRestoreInputSchema,
	projectArchiveRestoreListInputSchema,
	projectArchiveRestoreSchema,
} from "../project-archive-restore";
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

function getProjectArchiveRestoreStore(context: Context) {
	if (!context.projectArchiveRestoreStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Project Archive restore is unavailable.",
		});
	}
	return context.projectArchiveRestoreStore;
}

const projectNotFound = "Project not found.";

function restoreRejectionMessage(
	rejection: ProjectArchiveRestoreRejection
): string {
	switch (rejection.reason) {
		case "archive_invalid":
			return "The Project Archive failed verification, so no project was restored.";
		case "restore_inconsistent":
			return "The restored records could not be kept consistent, so no project was restored.";
		case "duplicate_key":
			return "The Project Archive repeats a record key, so no project was restored.";
		case "secret_detected":
			return "The Project Archive carries credential-like fields, so no project was restored.";
		case "file_unverifiable":
			return "Some archived files no longer match their recorded digest, so no project was restored.";
		default:
			return assertNever(rejection);
	}
}

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
	getRestore: protectedProcedure
		.input(projectArchiveRestoreGetInputSchema)
		.output(projectArchiveRestoreSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const restore = await getProjectArchiveRestoreStore(context).get(
					context.session.user.id,
					input.projectId,
					input.restoreId
				);
				if (!restore) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project Archive restore not found.",
					});
				}
				return restore;
			})
		),
	listRestores: protectedProcedure
		.input(projectArchiveRestoreListInputSchema)
		.output(projectArchiveRestoreCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getProjectArchiveRestoreStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return catalog;
		}),
	/**
	 * Records a restore that cannot finish inside the request as an
	 * authoritative Background Operation. The restore itself is the same
	 * atomic, idempotent one `restore` runs, keyed the same way.
	 */
	requestRestore: protectedProcedure
		.input(projectArchiveRestoreInputSchema)
		.output(backgroundOperationSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				if (!context.projectArchiveRestoreOperations) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Project Archive restore operations are unavailable.",
					});
				}
				const operation = await context.projectArchiveRestoreOperations.request(
					context.session.user.id,
					input
				);
				if (!operation) {
					throw new ORPCError("NOT_FOUND", { message: projectNotFound });
				}
				return operation;
			})
		),
	restore: protectedProcedure
		.input(projectArchiveRestoreInputSchema)
		.output(
			z.object({
				restore: projectArchiveRestoreSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getProjectArchiveRestoreStore(context).restore(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", {
						message: "Project Archive not found.",
					});
				}
				if (result.status === "rejected") {
					throw new ORPCError("BAD_REQUEST", {
						data: result,
						message: restoreRejectionMessage(result),
					});
				}
				return result;
			})
		),
};
