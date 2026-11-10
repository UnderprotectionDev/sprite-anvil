import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import type { ExportBundleRejection } from "../export-bundle-store";
import {
	exportBundleCatalogSchema,
	exportBundleCreateInputSchema,
	exportBundleGetInputSchema,
	exportBundleListInputSchema,
	exportBundleSchema,
} from "../export-bundles";
import { protectedProcedure } from "../index";
import { withPublicationErrors } from "../record-publication";

function getExportBundleStore(context: Context) {
	if (!context.exportBundleStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Export Bundle storage is unavailable.",
		});
	}
	return context.exportBundleStore;
}

const projectNotFound = "Project not found.";

/** Compile-time proof that every rejection reason has a message. */
function assertNever(rejection: never): never {
	throw new Error(`Unhandled Export Bundle rejection: ${String(rejection)}`);
}

function rejectionMessage(rejection: ExportBundleRejection): string {
	switch (rejection.reason) {
		case "profile_revision_unavailable":
			return "This Export Profile revision does not exist in the project.";
		case "unsupported_profile_contract_version":
			return "This Export Profile contract version is not supported; save a revision with the current major version.";
		case "family_unavailable":
			return "Some Asset Families were not found or have no active Required Set.";
		case "not_ready":
			return "Every selected Required Set item must be Context-Applicable and Export-Ready before a bundle can start.";
		case "asset_digest_missing":
			return "Some selected Asset Versions have no recorded SHA-256 digest and cannot be pinned.";
		case "selection_unavailable":
			return "Some selected Asset Versions are not part of the Required Set.";
		case "path_collision":
			return "The Export Profile naming template gives two files the same path.";
		case "unknown_naming_placeholder":
			return `The Export Profile naming template uses the unknown placeholder {${rejection.placeholder}}.`;
		default:
			return assertNever(rejection);
	}
}

export const exportBundlesRouter = {
	create: protectedProcedure
		.input(exportBundleCreateInputSchema)
		.output(
			z.object({
				bundle: exportBundleSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getExportBundleStore(context).create(
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
		.input(exportBundleGetInputSchema)
		.output(exportBundleSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const bundle = await getExportBundleStore(context).get(
					context.session.user.id,
					input.projectId,
					input.bundleId
				);
				if (!bundle) {
					throw new ORPCError("NOT_FOUND", {
						message: "Export Bundle not found.",
					});
				}
				return bundle;
			})
		),
	list: protectedProcedure
		.input(exportBundleListInputSchema)
		.output(exportBundleCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getExportBundleStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return catalog;
		}),
};
