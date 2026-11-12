import { ORPCError } from "@orpc/server";
import { z } from "zod";
import type { Context } from "../context";
import { deliveryDiffInputSchema, deliveryDiffSchema } from "../delivery-diff";
import {
	fulfilmentMappingDraftListSchema,
	fulfilmentMappingDraftSchema,
	fulfilmentMappingGetInputSchema,
	fulfilmentMappingListInputSchema,
	fulfilmentMappingPrepareInputSchema,
} from "../delivery-fulfilment";
import {
	deliveryFulfilmentGetInputSchema,
	deliveryFulfilmentListInputSchema,
	deliveryFulfilmentListSchema,
	deliveryFulfilmentSchema,
	fulfilmentFinalizeInputSchema,
} from "../delivery-fulfilment-records";
import { protectedProcedure } from "../index";
import { withPublicationErrors } from "../record-publication";

function requireStore<Store>(store: Store | undefined): Store {
	if (!store) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Delivery Fulfilment storage is unavailable.",
		});
	}
	return store;
}

const getMappingStore = (context: Context) =>
	requireStore(context.fulfilmentMappingStore);

const getFulfilmentStore = (context: Context) =>
	requireStore(context.deliveryFulfilmentStore);

const fulfilmentNotFound = "Delivery Fulfilment not found.";
const finalizeRejections = {
	invalid_selection:
		"A selection must pick one of the candidate Export Bundles for a conflicting requirement, once per requirement.",
	missing_requirements:
		"The mapping has requirements that no Export Bundle meets yet; a Delivery Fulfilment must cover every requirement.",
	no_active_revision:
		"This Delivery Target has no activated revision, so nothing can be fulfilled.",
	no_requirements:
		"The mapping has no requirements, so a Delivery Fulfilment would cover nothing.",
	revision_changed:
		"The mapping draft belongs to a revision that is no longer the active revision. Prepare a new mapping.",
	target_not_ready:
		"Only a Ready Delivery Target can be fulfilled; resolve its Readiness Plan blockers first.",
	unresolved_conflicts:
		"The mapping still has conflicting requirements; pick an Export Bundle for each one.",
} as const;

const targetNotFound = "Delivery Target not found.";
const draftNotFound = "Fulfilment mapping draft not found.";

const rejections = {
	no_active_revision:
		"This Delivery Target has no activated revision, so there is nothing to map.",
	no_requirements:
		"The active revision has no required items, so there is nothing to map.",
	target_not_ready:
		"Only a Ready Delivery Target can have a mapping prepared; resolve its Readiness Plan blockers first.",
} as const;

export const deliveryFulfilmentRouter = {
	/**
	 * Read-only Delivery Diff of two Delivery Fulfilments: Asset Versions,
	 * context and bundle mappings, plus the sections the model does not record
	 * yet. It writes nothing and never changes a Delivered status.
	 */
	compareFulfilments: protectedProcedure
		.input(deliveryDiffInputSchema)
		.output(deliveryDiffSchema)
		.handler(async ({ context, input }) => {
			const result = await getFulfilmentStore(context).compare(
				context.session.user.id,
				input
			);
			if (!result) {
				throw new ORPCError("NOT_FOUND", { message: fulfilmentNotFound });
			}
			if (result.status === "same_fulfilment") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Pick two different Delivery Fulfilments to compare.",
				});
			}
			return result.diff;
		}),
	/**
	 * The user's act: turns a mapping draft, with a pick for every conflict, into
	 * an immutable Delivery Fulfilment of the active revision. Missing or
	 * conflicting requirements and a target that is no longer Ready block it.
	 */
	finalize: protectedProcedure
		.input(fulfilmentFinalizeInputSchema)
		.output(
			z.object({
				fulfilment: deliveryFulfilmentSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getFulfilmentStore(context).finalize(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", {
						message: "Delivery Target or mapping draft not found.",
					});
				}
				if (result.status === "rejected") {
					throw new ORPCError(
						result.reason === "invalid_selection" ? "BAD_REQUEST" : "CONFLICT",
						{ message: finalizeRejections[result.reason] }
					);
				}
				return result;
			})
		),
	/** Re-reads one persisted Delivery Fulfilment. */
	getFulfilment: protectedProcedure
		.input(deliveryFulfilmentGetInputSchema)
		.output(deliveryFulfilmentSchema)
		.handler(async ({ context, input }) => {
			const fulfilment = await getFulfilmentStore(context).get(
				context.session.user.id,
				input
			);
			if (!fulfilment) {
				throw new ORPCError("NOT_FOUND", { message: fulfilmentNotFound });
			}
			return fulfilment;
		}),
	/** Newest first; the first one of a revision is its current Fulfilment. */
	listFulfilments: protectedProcedure
		.input(deliveryFulfilmentListInputSchema)
		.output(deliveryFulfilmentListSchema)
		.handler(async ({ context, input }) => {
			const list = await getFulfilmentStore(context).list(
				context.session.user.id,
				input
			);
			if (!list) {
				throw new ORPCError("NOT_FOUND", { message: targetNotFound });
			}
			return list;
		}),
	/** Reads a persisted mapping draft back from storage. */
	getMapping: protectedProcedure
		.input(fulfilmentMappingGetInputSchema)
		.output(fulfilmentMappingDraftSchema)
		.handler(async ({ context, input }) => {
			const draft = await getMappingStore(context).get(
				context.session.user.id,
				input
			);
			if (!draft) {
				throw new ORPCError("NOT_FOUND", { message: draftNotFound });
			}
			return draft;
		}),
	listMappings: protectedProcedure
		.input(fulfilmentMappingListInputSchema)
		.output(fulfilmentMappingDraftListSchema)
		.handler(async ({ context, input }) => {
			const list = await getMappingStore(context).list(
				context.session.user.id,
				input
			);
			if (!list) {
				throw new ORPCError("NOT_FOUND", { message: targetNotFound });
			}
			return list;
		}),
	/**
	 * Proposes the mapping of the active revision's required items to the exact
	 * bundles and Asset Versions, with missing and conflicting items shown. It
	 * creates no Delivery Fulfilment and decides nothing for the user.
	 */
	prepareMapping: protectedProcedure
		.input(fulfilmentMappingPrepareInputSchema)
		.output(
			z.object({
				draft: fulfilmentMappingDraftSchema,
				status: z.enum(["created", "replayed"]),
			})
		)
		.handler(({ context, input }) =>
			withPublicationErrors(async () => {
				const result = await getMappingStore(context).prepare(
					context.session.user.id,
					input
				);
				if (!result) {
					throw new ORPCError("NOT_FOUND", { message: targetNotFound });
				}
				if (result.status === "rejected") {
					throw new ORPCError("CONFLICT", {
						message: rejections[result.reason],
					});
				}
				return result;
			})
		),
};
