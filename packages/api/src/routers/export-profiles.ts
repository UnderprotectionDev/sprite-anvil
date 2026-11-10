import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import type { ExportProfileRevisionRejectionReason } from "../export-profile-store";
import {
	exportProfileCatalogSchema,
	exportProfileListInputSchema,
	exportProfileRevisionCreateInputSchema,
	exportProfileRevisionSchema,
} from "../export-profiles";
import { protectedProcedure } from "../index";

function getExportProfileStore(context: Context) {
	if (!context.exportProfileStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Export Profile storage is unavailable.",
		});
	}
	return context.exportProfileStore;
}

const projectNotFound = "Project not found.";

const rejectionMessages: Record<ExportProfileRevisionRejectionReason, string> =
	{
		profile_unavailable:
			"This Export Profile id is already used by another project.",
		revision_id_conflict:
			"This Export Profile revision id is already used for different content.",
		revision_number_conflict:
			"The Export Profile revision number was taken repeatedly; try saving again.",
		unsupported_contract_version:
			"This Export Profile contract version is not supported; a new revision needs the current major version.",
	};

const rejectionCodes: Record<
	ExportProfileRevisionRejectionReason,
	"BAD_REQUEST" | "CONFLICT"
> = {
	profile_unavailable: "BAD_REQUEST",
	revision_id_conflict: "CONFLICT",
	revision_number_conflict: "CONFLICT",
	unsupported_contract_version: "BAD_REQUEST",
};

export const exportProfilesRouter = {
	createRevision: protectedProcedure
		.input(exportProfileRevisionCreateInputSchema)
		.output(exportProfileRevisionSchema)
		.handler(async ({ context, input }) => {
			const result = await getExportProfileStore(context).createRevision(
				context.session.user.id,
				input
			);
			if (!result) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			if (result.status === "rejected") {
				throw new ORPCError(rejectionCodes[result.reason], {
					message: rejectionMessages[result.reason],
				});
			}
			return result.revision;
		}),
	list: protectedProcedure
		.input(exportProfileListInputSchema)
		.output(exportProfileCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getExportProfileStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return catalog;
		}),
};
