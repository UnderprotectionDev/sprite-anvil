import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { protectedProcedure } from "../index";
import {
	deriveProductionRecipeContent,
	type ProductionRecipeContent,
	productionRecipeCreateInputSchema,
	productionRecipeCreateVersionInputSchema,
	productionRecipeGetInputSchema,
	productionRecipeListInputSchema,
	productionRecipeSchema,
	validateProductionRecipeContent,
} from "../production-recipes";

function requireStores(context: Context) {
	const { generationPackageStore, productionExperimentStore } = context;
	const { productionRecipeStore } = context;
	if (
		!(
			generationPackageStore &&
			productionExperimentStore &&
			productionRecipeStore
		)
	) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Production Recipe storage is not configured.",
		});
	}
	return {
		generationPackageStore,
		productionExperimentStore,
		productionRecipeStore,
	};
}

function notFound() {
	return new ORPCError("NOT_FOUND", {
		message: "Production Recipe, Production Experiment, or project not found.",
	});
}

function assertConsistent(content: ProductionRecipeContent) {
	const problem = validateProductionRecipeContent(content);
	if (problem) {
		throw new ORPCError("BAD_REQUEST", { message: problem });
	}
}

// A recipe is a reusable instruction shape only. Nothing here creates a
// Generation Package, changes a review decision, or reads rights evidence.
export const productionRecipesRouter = {
	create: protectedProcedure
		.input(productionRecipeCreateInputSchema)
		.output(productionRecipeSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const {
				generationPackageStore,
				productionExperimentStore,
				productionRecipeStore,
			} = requireStores(context);
			const experiment = await productionExperimentStore.get(
				userId,
				input.projectId,
				input.experimentId
			);
			if (!experiment) {
				throw notFound();
			}
			const trial = experiment.trials.find(
				(entry) => entry.id === input.trialId
			);
			if (!trial) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"The selected trial does not belong to this Production Experiment.",
				});
			}
			const packages = await generationPackageStore.list(
				userId,
				input.projectId,
				experiment.assetRecordId
			);
			const generationPackage = packages?.find(
				(entry) => entry.id === trial.generationPackageId
			);
			if (!generationPackage) {
				throw new ORPCError("CONFLICT", {
					message:
						"The selected trial lost its pinned Generation Package, so no recipe can be built from it.",
				});
			}
			const content =
				input.content ?? deriveProductionRecipeContent(generationPackage);
			assertConsistent(content);
			const recipe = await productionRecipeStore.create(userId, {
				content,
				projectId: input.projectId,
				source: {
					assetRecordId: experiment.assetRecordId,
					experimentId: experiment.id,
					generationPackageId: generationPackage.id,
					trialId: trial.id,
				},
				title: input.title,
			});
			if (!recipe) {
				throw notFound();
			}
			return recipe;
		}),
	createVersion: protectedProcedure
		.input(productionRecipeCreateVersionInputSchema)
		.output(productionRecipeSchema)
		.handler(async ({ context, input }) => {
			const { productionRecipeStore } = requireStores(context);
			assertConsistent(input.content);
			const result = await productionRecipeStore.addVersion(
				context.session.user.id,
				{
					baseVersionNumber: input.baseVersionNumber,
					content: input.content,
					note: input.note ?? null,
					projectId: input.projectId,
					recipeId: input.recipeId,
				}
			);
			if (!result) {
				throw notFound();
			}
			if (result.kind === "stale") {
				throw new ORPCError("CONFLICT", {
					message:
						"This Production Recipe has a newer version than the one you edited; reload and edit the latest version.",
				});
			}
			return result.recipe;
		}),
	get: protectedProcedure
		.input(productionRecipeGetInputSchema)
		.output(productionRecipeSchema)
		.handler(async ({ context, input }) => {
			const { productionRecipeStore } = requireStores(context);
			const recipe = await productionRecipeStore.get(
				context.session.user.id,
				input.projectId,
				input.recipeId
			);
			if (!recipe) {
				throw notFound();
			}
			return recipe;
		}),
	list: protectedProcedure
		.input(productionRecipeListInputSchema)
		.output(productionRecipeSchema.array())
		.handler(async ({ context, input }) => {
			const { productionRecipeStore } = requireStores(context);
			const recipes = await productionRecipeStore.list(
				context.session.user.id,
				input.projectId
			);
			if (!recipes) {
				throw notFound();
			}
			return recipes;
		}),
};
