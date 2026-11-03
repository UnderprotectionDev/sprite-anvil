import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ProductionExperiment,
	ProductionExperimentStore,
} from "@sprite-anvil/api/production-experiments";
import type {
	ProductionRecipe,
	ProductionRecipeStore,
} from "@sprite-anvil/api/production-recipes";
import { appRouter } from "@sprite-anvil/api/routers/index";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";
const assetRecordId = "b178f612-12ec-432a-b254-32a6fd781cc4";
const packageAId = "2de54a7e-962c-48d3-b07a-bfbc16a2b724";
const packageBId = "8a4c2f0e-3c1e-4d6a-bf3c-52f6f5c7a111";
const versionAId = "7bb6f7dc-a09d-4f02-b324-e247081e3974";
const versionBId = "5d0c6a5b-1c1c-4b0b-9b1b-0a1b2c3d4e5f";
const unknownId = "11111111-2222-4333-8444-555555555555";
const timestamp = "2026-09-28T09:00:00.000Z";
const placeholderMessage = /placeholder/i;
const fixedValueMessage = /fixed/i;
const staleMessage = /newer version/i;
const trialMessage = /trial/i;
const notFoundMessage = /not found/i;

const record = {
	availability: "active",
	createdAt: timestamp,
	id: assetRecordId,
	identityCriteria: ["independent_product_meaning"],
	name: "Ash Knight attack",
	projectId,
	supportLevel: "general",
};

function createPackage(id: string, targetTask: string) {
	return {
		assetRecord: record,
		assetRecordId,
		avoidConstraints: ["No glow effects."],
		canonicalDesign: null,
		changeConstraints: ["Change the attack pose."],
		createdAt: timestamp,
		expectedOutputStructure: "A four-frame PNG sprite sheet.",
		id,
		lockedUnits: [],
		preserveConstraints: ["Keep the silhouette."],
		productionContextSnapshot: {
			contextRevisionId: "6fdf9f81-8f20-45b5-bf4c-0d0b3b503f2b",
			generalArtDirection: "Readable silhouettes.",
			ruleContractVersion: "context-rule/1.0.0",
			revisionNumber: 3,
			rules: [],
			theme: null,
			visualWorld: null,
		},
		projectId,
		referenceRoles: [
			{
				assetRecordId,
				assetRecordName: "Ash Knight idle",
				assetVersionId: versionAId,
				contentDigest: null,
				contentType: null,
				contextOverrideRationale: null,
				customPurpose: null,
				fileName: null,
				forbiddenFeatures: ["palette"],
				id: crypto.randomUUID(),
				kind: "asset_version",
				notes: "Pose guide",
				role: "pose",
				transferredFeatures: ["pose"],
				versionNumber: 1,
			},
		],
		targetDimensions: { height: 80, width: 72 },
		targetTask,
	};
}

function createExperiment(trialIds: [string, string]): ProductionExperiment {
	return {
		assetRecordId,
		conclusion: null,
		createdAt: timestamp,
		id: crypto.randomUUID(),
		projectId,
		title: "Attack pose wording",
		trials: [
			{
				assetVersionId: versionAId,
				createdAt: timestamp,
				generationPackageId: packageAId,
				id: trialIds[0],
				label: "A",
				position: 0,
			},
			{
				assetVersionId: versionBId,
				createdAt: timestamp,
				generationPackageId: packageBId,
				id: trialIds[1],
				label: "B",
				position: 1,
			},
		],
	};
}

function createRecipeStore(): ProductionRecipeStore & {
	recipes: ProductionRecipe[];
} {
	const recipes: ProductionRecipe[] = [];
	return {
		recipes,
		addVersion: (_user, input) => {
			const recipe = recipes.find((entry) => entry.id === input.recipeId);
			if (!recipe) {
				return Promise.resolve(null);
			}
			if (recipe.versions.length !== input.baseVersionNumber) {
				return Promise.resolve({ kind: "stale" as const });
			}
			recipe.versions.push({
				content: input.content,
				createdAt: timestamp,
				id: crypto.randomUUID(),
				note: input.note,
				versionNumber: recipe.versions.length + 1,
			});
			return Promise.resolve({
				kind: "created" as const,
				recipe: structuredClone(recipe),
			});
		},
		create: (_user, input) => {
			const recipe: ProductionRecipe = {
				createdAt: timestamp,
				id: crypto.randomUUID(),
				projectId: input.projectId,
				source: input.source,
				title: input.title,
				versions: [
					{
						content: input.content,
						createdAt: timestamp,
						id: crypto.randomUUID(),
						note: null,
						versionNumber: 1,
					},
				],
			};
			recipes.push(recipe);
			return Promise.resolve(structuredClone(recipe));
		},
		get: (_user, _project, id) =>
			Promise.resolve(
				structuredClone(recipes.find((entry) => entry.id === id) ?? null)
			),
		list: () => Promise.resolve(structuredClone(recipes)),
	};
}

function createTestContext() {
	const trialIds: [string, string] = [crypto.randomUUID(), crypto.randomUUID()];
	const experiment = createExperiment(trialIds);
	const packages = [
		createPackage(packageAId, "Create a four-frame attack animation."),
		createPackage(packageBId, "Create a faster attack animation."),
	];
	let packageWrites = 0;
	const experimentStore = {
		get: async () => structuredClone(experiment),
	} as unknown as ProductionExperimentStore;
	const context = {
		generationPackageStore: {
			create: () => {
				packageWrites += 1;
				throw new Error("A recipe must never create a Generation Package.");
			},
			list: async () => structuredClone(packages),
		},
		productionExperimentStore: experimentStore,
		productionRecipeStore: createRecipeStore(),
		session: { user: { id: userId } },
	} as unknown as Context;
	return {
		context,
		experiment,
		packageWrites: () => packageWrites,
		trialIds,
	};
}

async function createRecipe(
	context: Context,
	experimentId: string,
	trialId: string
) {
	return await call(
		appRouter.productionRecipes.create,
		{ experimentId, projectId, title: "Attack animation recipe", trialId },
		{ context }
	);
}

test("creates version 1 from a selected trial and rereads it from the persisted record", async () => {
	const { context, experiment, trialIds } = createTestContext();

	const created = await createRecipe(context, experiment.id, trialIds[1]);
	expect(created.versions).toHaveLength(1);
	expect(created.versions[0]?.versionNumber).toBe(1);

	const reread = await call(
		appRouter.productionRecipes.get,
		{ projectId, recipeId: created.id },
		{ context }
	);
	expect(reread.projectId).toBe(projectId);
	expect(reread.title).toBe("Attack animation recipe");
	expect(reread.source).toEqual({
		assetRecordId,
		experimentId: experiment.id,
		generationPackageId: packageBId,
		trialId: trialIds[1],
	});
	const [version] = reread.versions;
	expect(version?.content.expectedOutputStructure).toBe(
		"A four-frame PNG sprite sheet."
	);
	// Reference roles carry the role and intent, never the file or version.
	expect(version?.content.referenceRoles).toEqual([
		{
			customPurpose: null,
			forbiddenFeatures: ["palette"],
			notes: "Pose guide",
			role: "pose",
			transferredFeatures: ["pose"],
		},
	]);
	const fields = version?.content.fields ?? [];
	expect(fields.find((field) => field.key === "preserve_constraints")).toEqual({
		key: "preserve_constraints",
		label: "Preserve",
		mode: "fixed",
		value: "Keep the silhouette.",
	});
	expect(fields.find((field) => field.key === "target_task")).toEqual({
		key: "target_task",
		label: "Target task",
		mode: "fill_in",
		value: null,
	});
	expect(version?.content.instructionSkeleton).toContain("{{target_task}}");
	// The old experiment inputs are not silently copied into the fill-in field.
	expect(JSON.stringify(reread)).not.toContain("faster attack animation");
	expect(JSON.stringify(reread)).not.toContain(versionAId);
});

test("never applies itself and never replaces the trial review decision", async () => {
	const { context, experiment, packageWrites, trialIds } = createTestContext();
	const before = structuredClone(experiment);

	const created = await createRecipe(context, experiment.id, trialIds[0]);

	expect(packageWrites()).toBe(0);
	expect(experiment).toEqual(before);
	expect(Object.keys(created).sort()).toEqual([
		"createdAt",
		"id",
		"projectId",
		"source",
		"title",
		"versions",
	]);
	expect(created.source).not.toHaveProperty("reviewDisposition");
	expect(created.source).not.toHaveProperty("outcome");
});

test("rejects a trial that is not part of the experiment", async () => {
	const { context, experiment } = createTestContext();
	await expect(createRecipe(context, experiment.id, unknownId)).rejects.toThrow(
		trialMessage
	);
});

test("an edit creates a new version and keeps earlier versions unchanged", async () => {
	const { context, experiment, trialIds } = createTestContext();
	const created = await createRecipe(context, experiment.id, trialIds[0]);
	const original = structuredClone(created.versions[0]);
	const content = structuredClone(created.versions[0]?.content);
	if (!(content && original)) {
		throw new Error("Version 1 is required.");
	}
	content.instructionSkeleton = `${content.instructionSkeleton}\nKeep it readable at 1x.`;

	const updated = await call(
		appRouter.productionRecipes.createVersion,
		{
			baseVersionNumber: 1,
			content,
			note: "Added a readability line.",
			projectId,
			recipeId: created.id,
		},
		{ context }
	);
	expect(updated.versions.map((version) => version.versionNumber)).toEqual([
		1, 2,
	]);
	expect(updated.versions[0]).toEqual(original);
	expect(updated.versions[1]?.note).toBe("Added a readability line.");

	await expect(
		call(
			appRouter.productionRecipes.createVersion,
			{ baseVersionNumber: 1, content, projectId, recipeId: created.id },
			{ context }
		)
	).rejects.toThrow(staleMessage);
});

test("rejects a skeleton naming an undefined field or a fixed field without a value", async () => {
	const { context, experiment, trialIds } = createTestContext();
	const created = await createRecipe(context, experiment.id, trialIds[0]);
	const content = structuredClone(created.versions[0]?.content);
	if (!content) {
		throw new Error("Version 1 is required.");
	}

	await expect(
		call(
			appRouter.productionRecipes.createVersion,
			{
				baseVersionNumber: 1,
				content: { ...content, instructionSkeleton: "Draw {{missing_field}}." },
				projectId,
				recipeId: created.id,
			},
			{ context }
		)
	).rejects.toThrow(placeholderMessage);

	await expect(
		call(
			appRouter.productionRecipes.createVersion,
			{
				baseVersionNumber: 1,
				content: {
					...content,
					fields: [
						{ key: "target_task", label: "Task", mode: "fixed", value: null },
					],
					instructionSkeleton: "{{target_task}}",
				},
				projectId,
				recipeId: created.id,
			},
			{ context }
		)
	).rejects.toThrow(fixedValueMessage);
});

test("hides recipes and experiments of an unknown project", async () => {
	const { context, experiment, trialIds } = createTestContext();
	(context.productionExperimentStore as unknown as { get: unknown }).get =
		async () => null;
	await expect(
		createRecipe(context, experiment.id, trialIds[0])
	).rejects.toThrow(notFoundMessage);
	await expect(
		call(
			appRouter.productionRecipes.get,
			{ projectId, recipeId: unknownId },
			{ context }
		)
	).rejects.toThrow(notFoundMessage);
});
