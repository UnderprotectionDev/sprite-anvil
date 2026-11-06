import type {
	ProductionRecipe,
	ProductionRecipeStore,
} from "@sprite-anvil/api/production-recipes";
import { productionRecipeSchema } from "@sprite-anvil/api/production-recipes";
import { recordContentDigest } from "@sprite-anvil/api/record-content-digest";
import {
	replayPublishedRecord,
	resolveRecordId,
	verifyPublishedRecord,
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

type RecipeRow = typeof productionRecipes.$inferSelect;
type RecipeVersionRow = typeof productionRecipeVersions.$inferSelect;

function sourceMatches(
	recipe: RecipeRow,
	source: ProductionRecipe["source"] | undefined
) {
	return (
		(recipe.sourceAssetRecordId ?? null) === (source?.assetRecordId ?? null) &&
		(recipe.sourceExperimentId ?? null) === (source?.experimentId ?? null) &&
		(recipe.sourceGenerationPackageId ?? null) ===
			(source?.generationPackageId ?? null) &&
		(recipe.sourceTrialId ?? null) === (source?.trialId ?? null)
	);
}

/** A published recipe keeps its version 1 filed under the same project; later versions may follow. */
function firstVersionOf(
	recipe: RecipeRow,
	versions: RecipeVersionRow[],
	projectId: string
) {
	const first = versions.find(
		(version) => version.recipeId === recipe.id && version.versionNumber === 1
	);
	return first &&
		first.projectId === projectId &&
		recipe.projectId === projectId
		? first
		: null;
}

function withdrawRecipe(db: Database, projectId: string, recipeId: string) {
	return db.batch([
		db
			.delete(productionRecipeVersions)
			.where(
				and(
					eq(productionRecipeVersions.projectId, projectId),
					eq(productionRecipeVersions.recipeId, recipeId)
				)
			),
		db
			.delete(productionRecipes)
			.where(
				and(
					eq(productionRecipes.projectId, projectId),
					eq(productionRecipes.id, recipeId)
				)
			),
	]);
}

type RecipeCreateInput = Parameters<ProductionRecipeStore["create"]>[1];

/** The recipe row with its versions, as one record to check. */
interface RecipeRecord {
	recipe: RecipeRow;
	versions: RecipeVersionRow[];
}

async function readRecipeRecord(
	db: Database,
	userId: string,
	projectId: string,
	recipeId: string
): Promise<RecipeRecord | null> {
	const { recipes, versions } = await readOwnedRecipeRows(
		db,
		userId,
		projectId,
		recipeId
	);
	const [recipe] = recipes;
	return recipe ? { recipe, versions } : null;
}

/** Version 1 must be present and filed under this project; the record is otherwise not a recipe. */
function missingFirstVersion(
	{ recipe, versions }: RecipeRecord,
	input: RecipeCreateInput
) {
	return firstVersionOf(recipe, versions, input.projectId)
		? null
		: "Production Recipe relation check failed: the persisted recipe is missing its first version.";
}

/** True when the stored title, source or version 1 content differ from the request. */
async function differsFromRequest(
	{ recipe, versions }: RecipeRecord,
	input: RecipeCreateInput
) {
	const first = firstVersionOf(recipe, versions, input.projectId);
	if (!first) {
		return true;
	}
	const [submitted, stored] = await Promise.all([
		recordContentDigest(input.content),
		recordContentDigest(first.content),
	]);
	return (
		recipe.title !== input.title ||
		!sourceMatches(recipe, input.source) ||
		submitted !== stored
	);
}

/**
 * Re-reads the published recipe and checks its relations and the first
 * version's content digest against what was submitted. A half-done or
 * mismatched record is withdrawn and fails instead of showing as success. The
 * batch that writes the recipe and this check are separate steps: the recipe
 * is briefly readable before it is verified, and a failed withdrawal leaves a
 * residue that the next request with the same key repairs.
 */
function verifyPublishedRecipe(
	db: Database,
	userId: string,
	input: RecipeCreateInput,
	recipeId: string
) {
	return verifyPublishedRecord({
		integrityFailure: async (record) =>
			missingFirstVersion(record, input) ??
			((await differsFromRequest(record, input))
				? "Production Recipe content digest check failed: the persisted recipe differs from the submitted one."
				: null),
		label: "Production Recipe",
		read: () => readRecipeRecord(db, userId, input.projectId, recipeId),
		toResult: ({ recipe, versions }) => mapRecipe(recipe, versions),
		withdraw: () => withdrawRecipe(db, input.projectId, recipeId),
	});
}

/**
 * The recipe an earlier request with this key published, or a conflict when
 * its content differs. The stored recipe is re-verified, so one left behind by
 * a failed publication or withdrawal is repaired and never replayed as
 * success. Later versions of the recipe do not change the replay.
 */
function readReplay(
	db: Database,
	userId: string,
	input: RecipeCreateInput,
	recipeId: string
) {
	return replayPublishedRecord({
		differs: async (record) =>
			record.recipe.createdByUserId !== userId ||
			(await differsFromRequest(record, input)),
		integrityFailure: (record) => missingFirstVersion(record, input),
		label: "Production Recipe",
		read: () => readRecipeRecord(db, userId, input.projectId, recipeId),
		repair: () => withdrawRecipe(db, input.projectId, recipeId),
		toResult: ({ recipe, versions }) => mapRecipe(recipe, versions),
	});
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
			const recipeId = await resolveRecordId(
				{ kind: "production-recipe", projectId: input.projectId, userId },
				input.idempotencyKey
			);
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
