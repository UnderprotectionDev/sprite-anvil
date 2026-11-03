import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ProductionRecipe,
	ProductionRecipeContent,
	ProductionRecipeStore,
} from "@sprite-anvil/api/production-recipes";
import type {
	ContextRevision,
	ProjectContext,
} from "@sprite-anvil/api/project-context";
import { appRouter } from "@sprite-anvil/api/routers/index";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";
const otherProjectId = "0a3d9c5e-4b1f-4f43-8f0a-6a3a5d0f7e21";
const noAccessProjectId = "f2f0b8f2-39b0-4e0e-b5ad-3c8c53e9a8d4";
const assetRecordId = "b178f612-12ec-432a-b254-32a6fd781cc4";
const referenceId = "e23f4089-ce39-45d6-bbcc-760a6f5260c2";
const unknownId = "11111111-2222-4333-8444-555555555555";
const timestamp = "2026-10-01T09:00:00.000Z";

const missingFieldMessage = /target_task/;
const unknownFieldMessage = /Unknown field/;
const fixedFieldMessage = /fixed/;
const rolesMissingMessage = /recipe roles/;
const conflictMessage = /conflict/i;
const differentProjectMessage = /different project/i;

const revision: ContextRevision = {
	createdAt: timestamp,
	id: "6fdf9f81-8f20-45b5-bf4c-0d0b3b503f2b",
	isActive: true,
	projectId,
	revisionNumber: 3,
	ruleContractVersion: "context-rule/1.0.0",
	rules: [],
	sourceProposalId: null,
};

const baseContent: ProductionRecipeContent = {
	expectedOutputStructure: "A four-frame PNG sprite sheet.",
	fields: [
		{ key: "target_task", label: "Target task", mode: "fill_in", value: null },
		{
			key: "preserve_constraints",
			label: "Preserve",
			mode: "fixed",
			value: "Keep the silhouette.",
		},
	],
	instructionSkeleton:
		"Task: {{target_task}}\nPreserve: {{preserve_constraints}}",
	referenceRoles: [
		{
			customPurpose: null,
			forbiddenFeatures: ["palette"],
			notes: "Pose guide",
			role: "pose",
			transferredFeatures: ["pose"],
		},
	],
};

function createRecipeStore() {
	const recipes: ProductionRecipe[] = [];
	const accessible = new Set([projectId, otherProjectId]);
	const store: ProductionRecipeStore = {
		addVersion: (_user, input) => {
			const recipe = recipes.find((entry) => entry.id === input.recipeId);
			if (!recipe) {
				return Promise.resolve(null);
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
			if (!accessible.has(input.projectId)) {
				return Promise.resolve(null);
			}
			const recipe: ProductionRecipe = {
				createdAt: timestamp,
				id: crypto.randomUUID(),
				projectId: input.projectId,
				source: input.source,
				title: input.title,
				versions: [
					{
						content: structuredClone(input.content),
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
		get: (_user, project, id) =>
			Promise.resolve(
				structuredClone(
					accessible.has(project)
						? (recipes.find(
								(entry) => entry.id === id && entry.projectId === project
							) ?? null)
						: null
				)
			),
		list: (_user, project) =>
			Promise.resolve(
				accessible.has(project)
					? structuredClone(
							recipes.filter((entry) => entry.projectId === project)
						)
					: null
			),
	};
	return { recipes, store };
}

function createTestContext() {
	const { recipes, store } = createRecipeStore();
	const storedPackages: Record<string, unknown>[] = [];
	const state = {
		projectContext: {
			createdAt: timestamp,
			currentContextRevision: revision,
			generalArtDirection: "Readable silhouettes.",
			id: projectId,
			name: "Ash Knight",
		} as ProjectContext,
		references: [
			{
				assetRecordId: null,
				assetRecordName: null,
				contextOverrideRationale: null,
				customPurpose: null,
				forbiddenFeatures: [] as string[],
				id: referenceId,
				notes: "Use the shoulder pose only.",
				role: "pose",
				transferredFeatures: ["pose"],
				versionId: "7bb6f7dc-a09d-4f02-b324-e247081e3974",
				versionNumber: 1,
			},
		] as Record<string, unknown>[],
	};
	const record = {
		assetCategory: "character_creature_animation",
		availability: "active",
		createdAt: timestamp,
		id: assetRecordId,
		identityCriteria: ["independent_product_meaning"],
		measurements: {
			atlasDimensions: { confirmed: null, proposal: null },
			cellDimensions: { confirmed: null, proposal: null },
			displayScale: { confirmed: null, proposal: null },
			logicalResolution: { confirmed: null, proposal: null },
			sourceImageDimensions: { confirmed: null, proposal: null },
			visibleContentBounds: { confirmed: null, proposal: null },
		},
		name: "Ash Knight attack",
		projectId,
		supportLevel: "general",
		tags: [],
	};
	const context = {
		assetRecordStore: { get: async () => record },
		assetRecordTrackingStore: {
			getTracking: async () => ({
				record,
				tracking: { family: null, references: state.references },
			}),
		},
		assetVersionStore: {
			list: async () => ({
				assetVersions: [],
				canonicalDesigns: [],
				compositeVersions: [],
				unitVersions: [],
			}),
		},
		generationPackageStore: {
			create: (
				_user: string,
				input: { assetRecordId: string; projectId: string; snapshot: object }
			) => {
				const value = {
					assetRecordId: input.assetRecordId,
					createdAt: timestamp,
					id: crypto.randomUUID(),
					projectId: input.projectId,
					...input.snapshot,
				};
				storedPackages.push(structuredClone(value));
				return Promise.resolve(structuredClone(value));
			},
			list: () => Promise.resolve(structuredClone(storedPackages)),
		},
		productionExperimentStore: {},
		productionRecipeStore: store,
		projectContextScopeStore: {
			list: async () => ({ themes: [], visualWorlds: [] }),
		},
		projectContextStore: {
			listProjects: async () => [
				state.projectContext,
				{ ...state.projectContext, id: otherProjectId },
			],
		},
		referenceProductionStore: { listImages: async () => [] },
		session: { user: { id: userId } },
	} as unknown as Context;
	return { context, recipes, state, storedPackages };
}

function seedRecipe(
	recipes: ProductionRecipe[],
	content: ProductionRecipeContent = baseContent
) {
	const recipe: ProductionRecipe = {
		createdAt: timestamp,
		id: crypto.randomUUID(),
		projectId,
		source: {
			assetRecordId,
			experimentId: crypto.randomUUID(),
			generationPackageId: crypto.randomUUID(),
			trialId: crypto.randomUUID(),
		},
		title: "Attack recipe",
		versions: [
			{
				content: structuredClone(content),
				createdAt: timestamp,
				id: crypto.randomUUID(),
				note: null,
				versionNumber: 1,
			},
		],
	};
	recipes.push(recipe);
	return recipe;
}

function useInput(recipeId: string, fillIns: Record<string, string>) {
	return {
		assetRecordId,
		fillIns,
		projectId,
		recipeId,
		targetDimensions: { height: 80, width: 72 },
	};
}

test("uses a recipe to prepare a new package that consumes the current context", async () => {
	const { context, recipes, state, storedPackages } = createTestContext();
	const recipe = seedRecipe(recipes);

	const first = await call(
		appRouter.productionRecipes.use,
		useInput(recipe.id, { target_task: "Animate a slash." }),
		{ context }
	);
	expect(first.targetTask).toBe(
		"Task: Animate a slash.\nPreserve: Keep the silhouette."
	);
	expect(first.preserveConstraints).toEqual(["Keep the silhouette."]);
	expect(first.productionContextSnapshot.contextRevisionId).toBe(revision.id);
	expect(first.referenceRoles).toHaveLength(1);

	// The context moves on; the next use pins the newer revision as a separate package.
	const newRevisionId = "fe1cce28-f6a1-4c9d-9687-4a234cb0bd68";
	state.projectContext = {
		...state.projectContext,
		currentContextRevision: {
			...revision,
			id: newRevisionId,
			revisionNumber: 4,
		},
	};
	const second = await call(
		appRouter.productionRecipes.use,
		useInput(recipe.id, { target_task: "Animate a slash." }),
		{ context }
	);
	expect(second.id).not.toBe(first.id);
	expect(second.productionContextSnapshot.contextRevisionId).toBe(
		newRevisionId
	);
	expect(storedPackages).toHaveLength(2);
	expect(storedPackages[0]).toMatchObject({
		productionContextSnapshot: { contextRevisionId: revision.id },
	});
});

test("uses the latest recipe version unless one is named", async () => {
	const { context, recipes } = createTestContext();
	const recipe = seedRecipe(recipes);
	recipe.versions.push({
		content: {
			...baseContent,
			expectedOutputStructure: "A six-frame PNG sprite sheet.",
		},
		createdAt: timestamp,
		id: crypto.randomUUID(),
		note: null,
		versionNumber: 2,
	});
	const fillIns = { target_task: "Animate a slash." };

	const latest = await call(
		appRouter.productionRecipes.use,
		useInput(recipe.id, fillIns),
		{ context }
	);
	const pinned = await call(
		appRouter.productionRecipes.use,
		{ ...useInput(recipe.id, fillIns), versionNumber: 1 },
		{ context }
	);
	expect(latest.expectedOutputStructure).toBe("A six-frame PNG sprite sheet.");
	expect(pinned.expectedOutputStructure).toBe("A four-frame PNG sprite sheet.");
	await expect(
		call(
			appRouter.productionRecipes.use,
			{ ...useInput(recipe.id, fillIns), versionNumber: 9 },
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("rejects missing, unknown and fixed-field values without creating a package", async () => {
	const { context, recipes, storedPackages } = createTestContext();
	const recipe = seedRecipe(recipes);

	await expect(
		call(appRouter.productionRecipes.use, useInput(recipe.id, {}), { context })
	).rejects.toThrow(missingFieldMessage);
	await expect(
		call(
			appRouter.productionRecipes.use,
			useInput(recipe.id, { target_task: "   " }),
			{ context }
		)
	).rejects.toThrow(missingFieldMessage);
	await expect(
		call(
			appRouter.productionRecipes.use,
			useInput(recipe.id, { target_task: "x", extra: "y" }),
			{ context }
		)
	).rejects.toThrow(unknownFieldMessage);
	await expect(
		call(
			appRouter.productionRecipes.use,
			useInput(recipe.id, {
				preserve_constraints: "Change everything.",
				target_task: "x",
			}),
			{ context }
		)
	).rejects.toThrow(fixedFieldMessage);
	expect(storedPackages).toHaveLength(0);
});

test("does not expand placeholders typed into a fill-in value", async () => {
	const { context, recipes } = createTestContext();
	const recipe = seedRecipe(recipes);
	const created = await call(
		appRouter.productionRecipes.use,
		useInput(recipe.id, { target_task: "{{preserve_constraints}}" }),
		{ context }
	);
	expect(created.targetTask).toContain("Task: {{preserve_constraints}}");
});

test("never copies old experiment inputs into the package", async () => {
	const { context, recipes } = createTestContext();
	const recipe = seedRecipe(recipes);
	const created = await call(
		appRouter.productionRecipes.use,
		useInput(recipe.id, { target_task: "Animate a slash." }),
		{ context }
	);
	const serialized = JSON.stringify(created);
	expect(serialized).not.toContain(recipe.source.generationPackageId);
	expect(serialized).not.toContain(recipe.source.trialId);
	// Reference inputs come from the target record's own current selection.
	expect(created.referenceRoles.map((entry) => entry.id)).toEqual([
		referenceId,
	]);
});

test("asks to select a reference when the record lacks a role the recipe expects", async () => {
	const { context, recipes, state, storedPackages } = createTestContext();
	const recipe = seedRecipe(recipes);
	state.references = [];

	await expect(
		call(
			appRouter.productionRecipes.use,
			useInput(recipe.id, { target_task: "Animate a slash." }),
			{ context }
		)
	).rejects.toThrow(rolesMissingMessage);
	expect(storedPackages).toHaveLength(0);
});

test("blocks package creation while the recipe conflicts with the selected references", async () => {
	const { context, recipes, state, storedPackages } = createTestContext();
	const recipe = seedRecipe(recipes);
	// The recipe forbids "palette"; the record's reference transfers it.
	state.references = [
		{
			...state.references[0],
			transferredFeatures: ["pose", "palette"],
		},
	];

	await expect(
		call(
			appRouter.productionRecipes.use,
			useInput(recipe.id, { target_task: "Animate a slash." }),
			{ context }
		)
	).rejects.toThrow(conflictMessage);
	expect(storedPackages).toHaveLength(0);

	// Resolved: the package can be prepared.
	state.references = [
		{ ...state.references[0], transferredFeatures: ["pose"] },
	];
	const created = await call(
		appRouter.productionRecipes.use,
		useInput(recipe.id, { target_task: "Animate a slash." }),
		{ context }
	);
	expect(created.id).toBeTruthy();
});

test("requires an active Context Revision and an existing recipe", async () => {
	const { context, recipes, state, storedPackages } = createTestContext();
	const recipe = seedRecipe(recipes);
	state.projectContext = {
		...state.projectContext,
		currentContextRevision: { ...revision, isActive: false },
	};
	await expect(
		call(
			appRouter.productionRecipes.use,
			useInput(recipe.id, { target_task: "Animate a slash." }),
			{ context }
		)
	).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
	await expect(
		call(
			appRouter.productionRecipes.use,
			useInput(unknownId, { target_task: "Animate a slash." }),
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(storedPackages).toHaveLength(0);
});

test("copies a recipe into another project as an independent version 1", async () => {
	const { context, recipes } = createTestContext();
	const recipe = seedRecipe(recipes);
	recipe.versions.push({
		content: { ...baseContent, instructionSkeleton: "Task: {{target_task}}" },
		createdAt: timestamp,
		id: crypto.randomUUID(),
		note: "Shorter skeleton",
		versionNumber: 2,
	});
	const sourceBefore = structuredClone(recipe);

	const copy = await call(
		appRouter.productionRecipes.copy,
		{
			recipeId: recipe.id,
			sourceProjectId: projectId,
			targetProjectId: otherProjectId,
		},
		{ context }
	);
	expect(copy.id).not.toBe(recipe.id);
	expect(copy.projectId).toBe(otherProjectId);
	expect(copy.versions).toHaveLength(1);
	expect(copy.versions[0]?.versionNumber).toBe(1);
	expect(copy.versions[0]?.note).toBeNull();
	expect(copy.versions[0]?.content).toEqual(
		recipe.versions[1]?.content as ProductionRecipeContent
	);
	expect(recipes.find((entry) => entry.id === recipe.id)).toEqual(sourceBefore);

	// No live sync: a new source version leaves the copy unchanged.
	await call(
		appRouter.productionRecipes.createVersion,
		{
			baseVersionNumber: 2,
			content: { ...baseContent, expectedOutputStructure: "Changed." },
			projectId,
			recipeId: recipe.id,
		},
		{ context }
	);
	const reread = await call(
		appRouter.productionRecipes.get,
		{ projectId: otherProjectId, recipeId: copy.id },
		{ context }
	);
	expect(reread).toEqual(copy);
});

test("the receiving project reselects missing inputs separately when using the copy", async () => {
	const { context, recipes, state, storedPackages } = createTestContext();
	const recipe = seedRecipe(recipes);
	const copy = await call(
		appRouter.productionRecipes.copy,
		{
			recipeId: recipe.id,
			sourceProjectId: projectId,
			targetProjectId: otherProjectId,
		},
		{ context }
	);
	// The target record has no reference for the "pose" role yet.
	state.references = [];
	await expect(
		call(
			appRouter.productionRecipes.use,
			{
				...useInput(copy.id, { target_task: "Animate a slash." }),
				projectId: otherProjectId,
			},
			{ context }
		)
	).rejects.toThrow(rolesMissingMessage);
	expect(storedPackages).toHaveLength(0);
});

test("refuses to copy without access to both projects or into the same project", async () => {
	const { context, recipes } = createTestContext();
	const recipe = seedRecipe(recipes);
	const base = { recipeId: recipe.id, sourceProjectId: projectId };

	await expect(
		call(
			appRouter.productionRecipes.copy,
			{ ...base, targetProjectId: noAccessProjectId },
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(
			appRouter.productionRecipes.copy,
			{
				...base,
				sourceProjectId: noAccessProjectId,
				targetProjectId: otherProjectId,
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(
			appRouter.productionRecipes.copy,
			{ ...base, targetProjectId: projectId },
			{ context }
		)
	).rejects.toThrow(differentProjectMessage);
	await expect(
		call(
			appRouter.productionRecipes.copy,
			{ ...base, recipeId: unknownId, targetProjectId: otherProjectId },
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(recipes).toHaveLength(1);
});
