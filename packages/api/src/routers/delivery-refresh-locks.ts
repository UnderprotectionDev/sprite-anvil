import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import type { DeliveryRefreshLockRejection } from "../delivery-refresh-lock-store";
import {
	deliveryRefreshLockApplyInputSchema,
	deliveryRefreshLockCatalogSchema,
	deliveryRefreshLockGetInputSchema,
	deliveryRefreshLockListInputSchema,
	deliveryRefreshLockRefreshInputSchema,
	deliveryRefreshLockRefreshResultSchema,
	deliveryRefreshLockSchema,
} from "../delivery-refresh-locks";
import { protectedProcedure } from "../index";
import { withPublicationErrors } from "../record-publication";

function getDeliveryRefreshLockStore(context: Context) {
	if (!context.deliveryRefreshLockStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Delivery Refresh Lock storage is unavailable.",
		});
	}
	return context.deliveryRefreshLockStore;
}

const projectNotFound = "Project not found.";

/** Compile-time proof that every rejection reason has a message. */
function assertNever(rejection: never): never {
	throw new Error(
		`Unhandled Delivery Refresh Lock rejection: ${String(rejection)}`
	);
}

function rejectionMessage(rejection: DeliveryRefreshLockRejection): string {
	switch (rejection.reason) {
		case "bundle_unavailable":
			return "This Export Bundle does not exist in the project.";
		case "written_files_incomplete":
			return "The application is partial: every file of the Export Bundle must be written before a lock is made.";
		case "written_path_not_in_bundle":
			return "Some written paths are not files of the Export Bundle; Sprite Anvil only owns what the bundle wrote.";
		case "written_digest_mismatch":
			return "Some written files do not match the Export Bundle digests.";
		case "observation_incomplete":
			return "The observed folder state omits paths the previous lock or the bundle names; every one of them must be read.";
		case "observation_not_expected":
			return "The observed folder state names paths that are not paths of the previous lock or the bundle, or names a path twice.";
		case "previous_lock_unavailable":
			return "The previous Delivery Refresh Lock does not exist in the project.";
		case "lock_version_unsupported":
			return `The previous lock uses contract version ${rejection.version}, which this build cannot refresh from.`;
		case "lock_malformed":
			return "The previous lock is missing a required field or carries no full contract version.";
		case "decision_not_applicable":
			return "Some decisions name paths that are not diverged paths of this refresh.";
		case "diverged_path_not_released":
			return "Some diverged paths were reported as written without a replace decision.";
		case "written_path_not_expected":
			return "Some written paths are not paths this refresh is allowed to write.";
		case "no_files_applied":
			return "Nothing of the bundle would be owned after this refresh; apply the bundle to another destination instead.";
		default:
			return assertNever(rejection);
	}
}

export const deliveryRefreshLocksRouter = {
	apply: protectedProcedure
		.input(deliveryRefreshLockApplyInputSchema)
		.output(
			z.object({
				lock: deliveryRefreshLockSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getDeliveryRefreshLockStore(context).apply(
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
		.input(deliveryRefreshLockGetInputSchema)
		.output(deliveryRefreshLockSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const lock = await getDeliveryRefreshLockStore(context).get(
					context.session.user.id,
					input.projectId,
					input.lockId
				);
				if (!lock) {
					throw new ORPCError("NOT_FOUND", {
						message: "Delivery Refresh Lock not found.",
					});
				}
				return lock;
			})
		),
	refresh: protectedProcedure
		.input(deliveryRefreshLockRefreshInputSchema)
		.output(deliveryRefreshLockRefreshResultSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getDeliveryRefreshLockStore(context).refresh(
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
	list: protectedProcedure
		.input(deliveryRefreshLockListInputSchema)
		.output(deliveryRefreshLockCatalogSchema)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const catalog = await getDeliveryRefreshLockStore(context).list(
					context.session.user.id,
					input.projectId
				);
				if (!catalog) {
					throw new ORPCError("NOT_FOUND", { message: projectNotFound });
				}
				return catalog;
			})
		),
};
