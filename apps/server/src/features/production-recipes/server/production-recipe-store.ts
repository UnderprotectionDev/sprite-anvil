import type {
	ProductionRecipe,
	ProductionRecipeStore,
} from "@sprite-anvil/api/production-recipes";
import { productionRecipeSchema } from "@sprite-anvil/api/production-recipes";
import type { Database } from "@sprite-anvil/db";
import {
	productionRecipes,
	productionRecipeVersions,
} from "@sprite-anvil/db/schema/production-recipes";
import { project } from "@sprite-anvil/db/schema/project";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function mapRecipe(
	row: typeof productionRecipes.$inferSelect,
	versions: (typeof productionRecipeVersions.$inferSelect)[]
): ProductionRecipe {
	return productionRecipeSchema.parse({
		createdAt: toISOString(row.createdAt),
		id: row.id,
		projectId: row.projectId,
		source: {
			assetRecordId: row.sourceAssetRecordId,
			experimentId: row.sourceExperimentId,
			generationPackageId: row.sourceGenerationPackageId,
			trialId: row.sourceTrialId,
		},
		title: row.title,
		versions: versions
			.filter((version) => version.recipeId === row.id)
			.sort((left, right) => left.versionNumber - right.versionNumber)
			.map((version) => ({
				content: version.content,
				createdAt: toISOString(version.createdAt),
				id: version.id,
				note: version.note,
				versionNumber: version.versionNumber,
			})),
	});
}

async function isOwnedProject(db: Database, userId: string, projectId: string) {
	const [owned] = await db
		.select({ id: project.id })
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.ownerUserId, userId)))
		.limit(1);
	return Boolean(owned);
}

async function readOwnedRecipes(
	db: Database,
	userId: string,
	projectId: string,
	recipeId?: string
) {
	const conditions = [
		eq(productionRecipes.projectId, projectId),
		eq(project.ownerUserId, userId),
	];
	if (recipeId) {
		conditions.push(eq(productionRecipes.id, recipeId));
	}
	const rows = await db
		.select({ recipe: productionRecipes })
		.from(productionRecipes)
		.innerJoin(project, eq(project.id, productionRecipes.projectId))
		.where(and(...conditions))
		.orderBy(desc(productionRecipes.createdAt), desc(productionRecipes.id));
	if (rows.length === 0) {
		return [];
	}
	const versions = await db
		.select()
		.from(productionRecipeVersions)
		.where(
			inArray(
				productionRecipeVersions.recipeId,
				rows.map((row) => row.recipe.id)
			)
		)
		.orderBy(asc(productionRecipeVersions.versionNumber));
	return rows.map((row) => mapRecipe(row.recipe, versions));
}

export function createProductionRecipeStore(
	db: Database
): ProductionRecipeStore {
	return {
		async addVersion(userId, input) {
			const [recipe] = await readOwnedRecipes(
				db,
				userId,
				input.projectId,
				input.recipeId
			);
			if (!recipe) {
				return null;
			}
			if (recipe.versions.length !== input.baseVersionNumber) {
				return { kind: "stale" };
			}
			try {
				await db.insert(productionRecipeVersions).values({
					content: input.content,
					createdByUserId: userId,
					note: input.note,
					projectId: input.projectId,
					recipeId: input.recipeId,
					versionNumber: input.baseVersionNumber + 1,
				});
			} catch (error) {
				// The unique version number makes a concurrent edit from the same base
				// fail here; report it as stale when a newer version now exists.
				const [current] = await readOwnedRecipes(
					db,
					userId,
					input.projectId,
					input.recipeId
				);
				if (current && current.versions.length !== input.baseVersionNumber) {
					return { kind: "stale" };
				}
				throw error;
			}
			const [reread] = await readOwnedRecipes(
				db,
				userId,
				input.projectId,
				input.recipeId
			);
			return reread ? { kind: "created", recipe: reread } : null;
		},
		async create(userId, input) {
			if (!(await isOwnedProject(db, userId, input.projectId))) {
				return null;
			}
			const recipeId = crypto.randomUUID();
			await db.batch([
				db.insert(productionRecipes).values({
					createdByUserId: userId,
					id: recipeId,
					projectId: input.projectId,
					sourceAssetRecordId: input.source.assetRecordId,
					sourceExperimentId: input.source.experimentId,
					sourceGenerationPackageId: input.source.generationPackageId,
					sourceTrialId: input.source.trialId,
					title: input.title,
				}),
				db.insert(productionRecipeVersions).values({
					content: input.content,
					createdByUserId: userId,
					note: null,
					projectId: input.projectId,
					recipeId,
					versionNumber: 1,
				}),
			]);
			const [created] = await readOwnedRecipes(
				db,
				userId,
				input.projectId,
				recipeId
			);
			return created ?? null;
		},
		async get(userId, projectId, recipeId) {
			const [recipe] = await readOwnedRecipes(db, userId, projectId, recipeId);
			return recipe ?? null;
		},
		async list(userId, projectId) {
			if (!(await isOwnedProject(db, userId, projectId))) {
				return null;
			}
			return await readOwnedRecipes(db, userId, projectId);
		},
	};
}
