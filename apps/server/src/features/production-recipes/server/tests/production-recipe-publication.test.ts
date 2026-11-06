import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { createProductionRecipeStore } from "../production-recipe-store";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";

const content = {
	expectedOutputStructure: "A four-frame PNG sprite sheet.",
	fields: [],
	instructionSkeleton: "Draw the attack pose.",
	referenceRoles: [],
};

const input = {
	content,
	projectId,
	source: null,
	title: "Ash Knight attack",
};

function recipeRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "recipe-1",
		projectId,
		createdByUserId: userId,
		title: "Ash Knight attack",
		sourceAssetRecordId: null,
		sourceExperimentId: null,
		sourceGenerationPackageId: null,
		sourceTrialId: null,
		createdAt: new Date("2026-11-06T09:00:00.000Z"),
		...overrides,
	};
}

function versionRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "7bb6f7dc-a09d-4f02-b324-e247081e3974",
		projectId,
		recipeId: "recipe-1",
		versionNumber: 1,
		content,
		note: null,
		createdByUserId: userId,
		createdAt: new Date("2026-11-06T09:00:00.000Z"),
		...overrides,
	};
}

function fakeDb(persisted: {
	recipe: Record<string, unknown> | null;
	versions: Record<string, unknown>[];
}) {
	const state = { batches: [] as number[], recipeId: "" };
	const db = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve([{ id: projectId }]),
					orderBy: () =>
						Promise.resolve(
							persisted.versions.map((version) => ({
								...version,
								recipeId: state.recipeId,
							}))
						),
				}),
				innerJoin: () => ({
					where: () => ({
						orderBy: () =>
							Promise.resolve(
								persisted.recipe
									? [{ recipe: { ...persisted.recipe, id: state.recipeId } }]
									: []
							),
					}),
				}),
			}),
		}),
		insert: () => ({
			values: (values: { id?: string }) => {
				state.recipeId = values.id ?? state.recipeId;
				return { kind: "insert" };
			},
		}),
		delete: () => ({ where: () => ({ kind: "delete" }) }),
		batch: (statements: unknown[]) => {
			state.batches.push(statements.length);
			return Promise.resolve([]);
		},
	} as unknown as Database;
	return { db, state };
}

test("publishes recipe and first version together and returns the re-read record", async () => {
	const { db, state } = fakeDb({
		recipe: recipeRow(),
		versions: [versionRow()],
	});
	const created = await createProductionRecipeStore(db).create(userId, input);
	expect(state.batches).toEqual([2]);
	expect(created).toMatchObject({ title: "Ash Knight attack" });
	expect(created?.versions).toHaveLength(1);
});

test("withdraws and rejects a recipe whose persisted content digest differs", async () => {
	const { db, state } = fakeDb({
		recipe: recipeRow(),
		versions: [
			versionRow({
				content: { ...content, instructionSkeleton: "Draw something else." },
			}),
		],
	});
	await expect(
		createProductionRecipeStore(db).create(userId, input)
	).rejects.toThrow("content digest");
	expect(state.batches).toEqual([2, 2]);
});

test("withdraws and rejects a half-done recipe that has no first version", async () => {
	const { db, state } = fakeDb({ recipe: recipeRow(), versions: [] });
	await expect(
		createProductionRecipeStore(db).create(userId, input)
	).rejects.toThrow("relation");
	expect(state.batches).toEqual([2, 2]);
});

test("rejects a recipe whose persisted source relation differs from the submitted one", async () => {
	const { db } = fakeDb({
		recipe: recipeRow({ sourceTrialId: "trial-x" }),
		versions: [versionRow()],
	});
	await expect(
		createProductionRecipeStore(db).create(userId, input)
	).rejects.toThrow("differs from the submitted");
});

test("does not report success when the written recipe cannot be re-read", async () => {
	const { db } = fakeDb({ recipe: null, versions: [] });
	await expect(
		createProductionRecipeStore(db).create(userId, input)
	).rejects.toThrow("re-read");
});
