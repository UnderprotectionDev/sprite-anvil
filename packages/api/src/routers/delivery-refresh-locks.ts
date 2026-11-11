import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import type { DeliveryRefreshLockRejection } from "../delivery-refresh-lock-store";
import {
	deliveryRefreshLockApplyInputSchema,
	deliveryRefreshLockCatalogSchema,
	deliveryRefreshLockGetInputSchema,
	deliveryRefreshLockListInputSchema,
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
	list: protectedProcedure
		.input(deliveryRefreshLockListInputSchema)
		.output(deliveryRefreshLockCatalogSchema)
		.handler(async ({ context, input }) => {
			const catalog = await getDeliveryRefreshLockStore(context).list(
				context.session.user.id,
				input.projectId
			);
			if (!catalog) {
				throw new ORPCError("NOT_FOUND", { message: projectNotFound });
			}
			return catalog;
		}),
};
