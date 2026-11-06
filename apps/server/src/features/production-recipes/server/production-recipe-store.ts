import type {
	ProductionRecipe,
	ProductionRecipeStore,
} from "@sprite-anvil/api/production-recipes";
import { productionRecipeSchema } from "@sprite-anvil/api/production-recipes";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
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
		source:
			row.sourceAssetRecordId &&
			row.sourceExperimentId &&
			row.sourceGenerationPackageId &&
			row.sourceTrialId
				? {
						assetRecordId: row.sourceAssetRecordId,
						experimentId: row.sourceExperimentId,
						generationPackageId: row.sourceGenerationPackageId,
						trialId: row.sourceTrialId,
					}
				: null,
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

async function readOwnedRecipeRows(
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
		return { recipes: [], versions: [] };
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
	return { recipes: rows.map((row) => row.recipe), versions };
}

async function readOwnedRecipes(
	db: Database,
	userId: string,
	projectId: string,
	recipeId?: string
) {
	const { recipes, versions } = await readOwnedRecipeRows(
		db,
		userId,
		projectId,
		recipeId
	);
	return recipes.map((recipe) => mapRecipe(recipe, versions));
}

async function withdrawAndFail(
	db: Database,
	recipeId: string,
	message: string
): Promise<never> {
	await db.batch([
		db
			.delete(productionRecipeVersions)
			.where(eq(productionRecipeVersions.recipeId, recipeId)),
		db.delete(productionRecipes).where(eq(productionRecipes.id, recipeId)),
	]);
	throw new RecordIntegrityError(message);
}

/**
 * Re-reads the published recipe and checks its relations and the first
 * version's content digest against what was submitted. A half-done or
 * mismatched record is withdrawn and fails instead of showing as success.
 */
async function verifyPublishedRecipe(
	db: Database,
	userId: string,
	input: {
		content: unknown;
		projectId: string;
		source: ProductionRecipe["source"];
		title: string;
	},
	recipeId: string
) {
	const { recipes, versions } = await readOwnedRecipeRows(
		db,
		userId,
		input.projectId,
		recipeId
	);
	const [recipe] = recipes;
	if (!recipe) {
		throw new RecordIntegrityError(
			"The published Production Recipe could not be re-read from the persisted record."
		);
	}
	const own = versions.filter((version) => version.recipeId === recipeId);
	const [first] = own;
	if (
		own.length !== 1 ||
		first?.versionNumber !== 1 ||
		first.projectId !== input.projectId ||
		recipe.projectId !== input.projectId ||
		recipe.title !== input.title ||
		(recipe.sourceAssetRecordId ?? null) !==
			(input.source?.assetRecordId ?? null) ||
		(recipe.sourceExperimentId ?? null) !==
			(input.source?.experimentId ?? null) ||
		(recipe.sourceGenerationPackageId ?? null) !==
			(input.source?.generationPackageId ?? null) ||
		(recipe.sourceTrialId ?? null) !== (input.source?.trialId ?? null)
	) {
		return withdrawAndFail(
			db,
			recipeId,
			"Production Recipe relation check failed: the persisted recipe is missing its first version or differs from the submitted source."
		);
	}
	const [submitted, stored] = await Promise.all([
		recordContentDigest(input.content),
		recordContentDigest(first.content),
	]);
	if (submitted !== stored) {
		return withdrawAndFail(
			db,
			recipeId,
			"Production Recipe content digest check failed: the persisted content differs from the submitted one."
		);
	}
	return mapRecipe(recipe, versions);
}

type RecipeCreateInput = Parameters<ProductionRecipeStore["create"]>[1];

/** The recipe an earlier request with this key published, or a conflict when its content differs. */
async function readReplay(
	db: Database,
	userId: string,
	input: RecipeCreateInput,
	recipeId: string
) {
	const { recipes, versions } = await readOwnedRecipeRows(
		db,
		userId,
		input.projectId,
		recipeId
	);
	const [recipe] = recipes;
	if (!recipe) {
		return null;
	}
	const own = versions.filter((version) => version.recipeId === recipeId);
	const [submitted, stored] = await Promise.all([
		recordContentDigest(input.content),
		recordContentDigest(own[0]?.content ?? null),
	]);
	if (
		recipe.createdByUserId !== userId ||
		recipe.title !== input.title ||
		(recipe.sourceAssetRecordId ?? null) !==
			(input.source?.assetRecordId ?? null) ||
		(recipe.sourceExperimentId ?? null) !==
			(input.source?.experimentId ?? null) ||
		(recipe.sourceGenerationPackageId ?? null) !==
			(input.source?.generationPackageId ?? null) ||
		(recipe.sourceTrialId ?? null) !== (input.source?.trialId ?? null) ||
		submitted !== stored
	) {
		throw new IdempotencyConflictError("Production Recipe");
	}
	return mapRecipe(recipe, versions);
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
			const publishRecipeRows = (newRecipeId: string) =>
				db.batch([
					db.insert(productionRecipes).values({
						createdByUserId: userId,
						id: newRecipeId,
						projectId: input.projectId,
						sourceAssetRecordId: input.source?.assetRecordId ?? null,
						sourceExperimentId: input.source?.experimentId ?? null,
						sourceGenerationPackageId:
							input.source?.generationPackageId ?? null,
						sourceTrialId: input.source?.trialId ?? null,
						title: input.title,
					}),
					db.insert(productionRecipeVersions).values({
						content: input.content,
						createdByUserId: userId,
						note: null,
						projectId: input.projectId,
						recipeId: newRecipeId,
						versionNumber: 1,
					}),
				]);
			// No column holds the key, so a keyed request derives the recipe id from
			// it: the same key always addresses the same recipe.
			const recipeId = input.idempotencyKey
				? await idempotentRecordId(
						["production-recipe", input.projectId],
						input.idempotencyKey
					)
				: crypto.randomUUID();
			if (input.idempotencyKey) {
				const replayed = await readReplay(db, userId, input, recipeId);
				if (replayed) {
					return replayed;
				}
			}
			try {
				await publishRecipeRows(recipeId);
			} catch (error) {
				// A concurrent request with the same key won the insert.
				const raced = input.idempotencyKey
					? await readReplay(db, userId, input, recipeId)
					: null;
				if (raced) {
					return raced;
				}
				throw error;
			}
			return verifyPublishedRecipe(db, userId, input, recipeId);
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
