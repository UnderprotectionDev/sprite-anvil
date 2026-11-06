import { expect, test } from "bun:test";
import { IdempotencyConflictError } from "@sprite-anvil/api/record-publication";
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
	idempotencyKey: "request-1",
	projectId,
	source: null,
	title: "Ash Knight attack",
};

type Row = Record<string, unknown>;

/**
 * Fake database with primary-key behavior: a batch is all-or-nothing and a
 * duplicate recipe id rejects the whole batch. `loseNextReread` drops the first
 * re-read after a write, as an interrupted publication would.
 */
function fakeDb(options: { loseNextReread?: boolean } = {}) {
	const state = {
		recipes: [] as Row[],
		versions: [] as Row[],
	};
	let loseReread = options.loseNextReread ?? false;
	const db = {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => Promise.resolve([{ id: projectId }]),
					orderBy: () => Promise.resolve(state.versions),
				}),
				innerJoin: () => ({
					where: () => ({
						orderBy: () => {
							if (loseReread && state.recipes.length > 0) {
								loseReread = false;
								return Promise.resolve([]);
							}
							return Promise.resolve(
								state.recipes.slice(0, 1).map((recipe) => ({ recipe }))
							);
						},
					}),
				}),
			}),
		}),
		insert: () => ({
			values: (values: Row) => ({ values }),
		}),
		delete: () => ({ where: () => ({ kind: "delete" }) }),
		batch: (statements: { values?: Row }[]) => {
			const [recipe, version] = statements.map((statement) => statement.values);
			if (recipe && "title" in recipe) {
				if (state.recipes.some((existing) => existing.id === recipe.id)) {
					return Promise.reject(
						Object.assign(new Error("duplicate key"), { code: "23505" })
					);
				}
				state.recipes.push({
					createdAt: new Date("2026-11-06T09:00:00.000Z"),
					...recipe,
				});
				state.versions.push({
					createdAt: new Date("2026-11-06T09:00:00.000Z"),
					id: crypto.randomUUID(),
					...version,
				});
			}
			return Promise.resolve([]);
		},
	} as unknown as Database;
	return { db, state };
}

test("a repeated key returns the same Production Recipe and stores exactly one", async () => {
	const { db, state } = fakeDb();
	const store = createProductionRecipeStore(db);
	const first = await store.create(userId, input);
	const repeat = await store.create(userId, input);
	expect(first).not.toBeNull();
	expect(repeat?.id).toBe(first?.id);
	expect(state.recipes).toHaveLength(1);
	expect(state.versions).toHaveLength(1);
});

test("the same key with another title or content conflicts instead of adding a record", async () => {
	const { db, state } = fakeDb();
	const store = createProductionRecipeStore(db);
	await store.create(userId, input);
	await expect(
		store.create(userId, { ...input, title: "Another title" })
	).rejects.toBeInstanceOf(IdempotencyConflictError);
	await expect(
		store.create(userId, {
			...input,
			content: { ...content, instructionSkeleton: "Draw something else." },
		})
	).rejects.toBeInstanceOf(IdempotencyConflictError);
	expect(state.recipes).toHaveLength(1);
});

test("an interrupted publication fails visibly and the retry yields exactly one recipe", async () => {
	const { db, state } = fakeDb({ loseNextReread: true });
	const store = createProductionRecipeStore(db);
	await expect(store.create(userId, input)).rejects.toThrow("re-read");
	expect(state.recipes).toHaveLength(1);
	const retry = await store.create(userId, input);
	expect(retry?.id).toBe(state.recipes[0]?.id as string);
	expect(state.recipes).toHaveLength(1);
	expect(state.versions).toHaveLength(1);
});
