import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import {
	changeFacetInputSchema,
	changeImpactSchema,
	dependencyCatalogInputSchema,
	dependencyCatalogSchema,
	dependencyLinkInputSchema,
	dependencyLinkSchema,
	derivativeReReviewInputSchema,
	derivativeReReviewSchema,
} from "../dependency-revalidation";
import {
	historicalCompositionInputSchema,
	historicalCompositionListSchema,
	historicalCompositionOptionsSchema,
	historicalCompositionSchema,
} from "../historical-compositions";
import { protectedProcedure } from "../index";

function getStore(context: Context) {
	if (!context.dependencyRevalidationStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Dependency revalidation storage is unavailable.",
		});
	}
	return context.dependencyRevalidationStore;
}
async function readCatalog(
	context: Context,
	userId: string,
	projectId: string
) {
	const catalog = await getStore(context).list(userId, projectId);
	if (!catalog) {
		throw new ORPCError("NOT_FOUND", { message: "Project not found." });
	}
	return catalog;
}
export const dependencyRevalidationRouter = {
	historicalCompositionOptions: protectedProcedure
		.input(dependencyCatalogInputSchema)
		.output(historicalCompositionOptionsSchema)
		.handler(async ({ context, input }) => {
			const options = await getStore(context).historicalCompositionOptions(
				context.session.user.id,
				input.projectId
			);
			if (!options) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found." });
			}
			return options;
		}),
	listHistoricalCompositions: protectedProcedure
		.input(dependencyCatalogInputSchema)
		.output(historicalCompositionListSchema)
		.handler(async ({ context, input }) => {
			const pins = await getStore(context).listHistoricalCompositions(
				context.session.user.id,
				input.projectId
			);
			if (!pins) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found." });
			}
			return { pins };
		}),
	pinHistoricalComposition: protectedProcedure
		.input(historicalCompositionInputSchema)
		.output(historicalCompositionSchema)
		.handler(async ({ context, input }) => {
			const result = await getStore(context).pinHistoricalComposition(
				context.session.user.id,
				input,
				async (versionId) =>
					Boolean(
						await context.verifyAssetVersionContent?.(
							context.session.user.id,
							input.projectId,
							versionId
						)
					)
			);
			if (!result) {
				throw new ORPCError("NOT_FOUND", { message: "Project not found." });
			}
			if (result.kind === "idempotency-conflict") {
				throw new ORPCError("CONFLICT", {
					message:
						"This operation ID has already been used for a different historical selection.",
				});
			}
			if (result.kind === "invalid-selection") {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Historical selection records must belong to the exact composition in this Project.",
				});
			}
			return result.pin;
		}),
	reReview: protectedProcedure
		.input(derivativeReReviewInputSchema)
		.output(derivativeReReviewSchema)
		.handler(async ({ context, input }) => {
			await readCatalog(context, context.session.user.id, input.projectId);
			const review = await getStore(context).reReview(
				context.session.user.id,
				input
			);
			if (!review) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Revalidation requires the affected Derived Asset, active Context Revision, current family Canonical Design, and all change impacts to be current. A positive revalidation renews an existing approval; unapproved versions must pass normal approval checks.",
				});
			}
			return review;
		}),
	list: protectedProcedure
		.input(dependencyCatalogInputSchema)
		.output(dependencyCatalogSchema)
		.handler(({ context, input }) =>
			readCatalog(context, context.session.user.id, input.projectId)
		),
	createLink: protectedProcedure
		.input(dependencyLinkInputSchema)
		.output(dependencyLinkSchema)
		.handler(async ({ context, input }) => {
			await readCatalog(context, context.session.user.id, input.projectId);
			const link = await getStore(context).createLink(
				context.session.user.id,
				input
			);
			if (!link) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"A Dependency Link must connect different versions in the same Project, target a Derived Asset Version, and not already exist.",
				});
			}
			return link;
		}),
	determine: protectedProcedure
		.input(changeFacetInputSchema)
		.output(changeImpactSchema)
		.handler(async ({ context, input }) => {
			await readCatalog(context, context.session.user.id, input.projectId);
			const impact = await getStore(context).determine(
				context.session.user.id,
				input
			);
			if (!impact) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"The Change Description must belong to a Context Revision or selected Canonical Design in this Project.",
				});
			}
			return impact;
		}),
};
