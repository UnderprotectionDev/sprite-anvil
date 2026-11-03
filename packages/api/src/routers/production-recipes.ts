import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { prepareGenerationPackage } from "../generation-package-preparation";
import { generationPackageSchema } from "../generation-packages";
import { protectedProcedure } from "../index";
import {
	buildProductionRecipeUse,
	copyProductionRecipeContent,
	deriveProductionRecipeContent,
	type ProductionRecipeContent,
	productionRecipeCopyInputSchema,
	productionRecipeCreateInputSchema,
	productionRecipeCreateVersionInputSchema,
	productionRecipeGetInputSchema,
	productionRecipeListInputSchema,
	productionRecipeSchema,
	productionRecipeUseInputSchema,
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

function requireRecipeStore(context: Context) {
	if (!context.productionRecipeStore) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Production Recipe storage is not configured.",
		});
	}
	return context.productionRecipeStore;
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
	copy: protectedProcedure
		.input(productionRecipeCopyInputSchema)
		.output(productionRecipeSchema)
		.handler(async ({ context, input }) => {
			if (input.sourceProjectId === input.targetProjectId) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Copy a Production Recipe into a different project; use it directly in its own project.",
				});
			}
			const userId = context.session.user.id;
			const productionRecipeStore = requireRecipeStore(context);
			// Reading the source requires access to its project; creating in the
			// target requires access to that one. Either miss is "not found".
			const source = await productionRecipeStore.get(
				userId,
				input.sourceProjectId,
				input.recipeId
			);
			const latest = source?.versions.at(-1);
			if (!(source && latest)) {
				throw notFound();
			}
			// A new record at version 1: only the skeleton, roles, output structure
			// and fields travel. Nothing links the copy back, so later source
			// versions never reach it.
			const copy = await productionRecipeStore.create(userId, {
				content: copyProductionRecipeContent(latest.content),
				projectId: input.targetProjectId,
				source: null,
				title: input.title ?? source.title,
			});
			if (!copy) {
				throw notFound();
			}
			return copy;
		}),
	createVersion: protectedProcedure
		.input(productionRecipeCreateVersionInputSchema)
		.output(productionRecipeSchema)
		.handler(async ({ context, input }) => {
			const productionRecipeStore = requireRecipeStore(context);
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
			const productionRecipeStore = requireRecipeStore(context);
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
			const productionRecipeStore = requireRecipeStore(context);
			const recipes = await productionRecipeStore.list(
				context.session.user.id,
				input.projectId
			);
			if (!recipes) {
				throw notFound();
			}
			return recipes;
		}),
	use: protectedProcedure
		.input(productionRecipeUseInputSchema)
		.output(generationPackageSchema)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const productionRecipeStore = requireRecipeStore(context);
			const recipe = await productionRecipeStore.get(
				userId,
				input.projectId,
				input.recipeId
			);
			if (!recipe) {
				throw notFound();
			}
			const version = input.versionNumber
				? recipe.versions.find(
						(entry) => entry.versionNumber === input.versionNumber
					)
				: recipe.versions.at(-1);
			if (!version) {
				throw notFound();
			}
			const prepared = buildProductionRecipeUse(version.content, input);
			if (prepared.kind === "invalid") {
				throw new ORPCError("BAD_REQUEST", { message: prepared.message });
			}
			// Always a new package built from the current Project Context; the
			// recipe's source trial, review decision and rights evidence are not read.
			return await prepareGenerationPackage(context, userId, prepared.input, {
				recipeRoles: version.content.referenceRoles,
			});
		}),
};
