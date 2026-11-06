import { expect, test } from "bun:test";
import { generationPackageSnapshotSchema } from "@sprite-anvil/api/generation-packages";
import {
	IdempotencyConflictError,
	RecordIntegrityError,
} from "@sprite-anvil/api/record-publication";
import type { Database } from "@sprite-anvil/db";
import { createGenerationPackageStore } from "../generation-package-store";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";
const assetRecordId = "b178f612-12ec-432a-b254-32a6fd781cc4";

const snapshot = generationPackageSnapshotSchema.parse({
	assetRecord: {
		availability: "active",
		createdAt: "2026-11-06T09:00:00.000Z",
		id: assetRecordId,
		identityCriteria: ["independent_product_meaning"],
		name: "Ash Knight attack",
		projectId,
		supportLevel: "general",
	},
	avoidConstraints: ["Avoid changing the silhouette."],
	canonicalDesign: null,
	changeConstraints: ["Change the animation timing."],
	expectedOutputStructure: "A four-frame PNG sprite sheet.",
	lockedUnits: [],
	preserveConstraints: ["Keep the outline width."],
	productionContextSnapshot: {
		contextRevisionId: "6fdf9f81-8f20-45b5-bf4c-0d0b3b503f2b",
		generalArtDirection: "Readable silhouettes.",
		ruleContractVersion: "context-rule/1.0.0",
		rules: [],
		revisionNumber: 1,
		theme: null,
		visualWorld: null,
	},
	referenceRoles: [],
	targetDimensions: { height: 80, width: 72 },
	targetTask: "Create a four-frame attack animation.",
});

type Row = Record<string, unknown>;

/**
 * Fake database with primary-key behavior: a second insert of the same id
 * changes nothing. `loseNextReread` drops the first re-read, as an interrupted
 * publication would.
 */
function fakeDb(
	options: { failDeletes?: number; loseNextReread?: boolean } = {}
) {
	const state = { deleted: 0, rereadsLost: 0, rows: [] as Row[] };
	let failDeletes = options.failDeletes ?? 0;
	let loseReread = options.loseNextReread ?? false;
	const db = {
		select: () => ({
			from: () => ({
				innerJoin: () => ({
					where: () => ({
						limit: () =>
							Promise.resolve([{ availability: "active", id: assetRecordId }]),
					}),
				}),
				where: () => ({
					limit: () => {
						if (loseReread && state.rows.length > 0) {
							loseReread = false;
							state.rereadsLost += 1;
							return Promise.resolve([]);
						}
						return Promise.resolve(state.rows.slice(0, 1));
					},
				}),
			}),
		}),
		insert: () => ({
			values: (values: Row) => {
				const insert = () => {
					const id = (values.id as string | undefined) ?? crypto.randomUUID();
					if (state.rows.some((existing) => existing.id === id)) {
						return [];
					}
					const created = {
						...values,
						createdAt: new Date("2026-11-06T09:30:00.000Z"),
						id,
						snapshot: JSON.parse(JSON.stringify(values.snapshot)),
					};
					state.rows.push(created);
					return [created];
				};
				return {
					onConflictDoNothing: () => ({
						returning: () => Promise.resolve(insert()),
					}),
					returning: () => Promise.resolve(insert()),
				};
			},
		}),
		delete: () => ({
			where: () => {
				if (failDeletes > 0) {
					failDeletes -= 1;
					return Promise.reject(new Error("connection reset"));
				}
				state.deleted += 1;
				state.rows.length = 0;
				return Promise.resolve();
			},
		}),
	} as unknown as Database;
	return { db, state };
}

const input = {
	assetRecordId,
	idempotencyKey: "request-1",
	projectId,
	snapshot,
};

test("a repeated key returns the same Generation Package and stores exactly one", async () => {
	const { db, state } = fakeDb();
	const store = createGenerationPackageStore(db);
	const first = await store.create(userId, input);
	const repeat = await store.create(userId, input);
	expect(first).not.toBeNull();
	expect(repeat?.id).toBe(first?.id);
	expect(state.rows).toHaveLength(1);
});

test("the same key with other request content conflicts instead of adding a record", async () => {
	const { db, state } = fakeDb();
	const store = createGenerationPackageStore(db);
	await store.create(userId, input);
	await expect(
		store.create(userId, {
			...input,
			snapshot: { ...snapshot, targetTask: "Create a different task." },
		})
	).rejects.toBeInstanceOf(IdempotencyConflictError);
	expect(state.rows).toHaveLength(1);
});

test("the same key for another Asset Record addresses another package", async () => {
	const { db, state } = fakeDb();
	const store = createGenerationPackageStore(db);
	const first = await store.create(userId, input);
	state.rows.length = 0;
	const otherRecord = crypto.randomUUID();
	const other = await store.create(userId, {
		...input,
		assetRecordId: otherRecord,
		snapshot: {
			...snapshot,
			assetRecord: { ...snapshot.assetRecord, id: otherRecord },
		},
	});
	expect(other?.id).not.toBe(first?.id as string);
});

test("a repeat ignores context that changed since the first request", async () => {
	const { db, state } = fakeDb();
	const store = createGenerationPackageStore(db);
	const first = await store.create(userId, input);
	const repeat = await store.create(userId, {
		...input,
		snapshot: {
			...snapshot,
			productionContextSnapshot: {
				...snapshot.productionContextSnapshot,
				revisionNumber: 2,
			},
		},
	});
	expect(repeat?.id).toBe(first?.id);
	expect(state.rows).toHaveLength(1);
});

test("an interrupted publication fails visibly and the retry yields exactly one package", async () => {
	const { db, state } = fakeDb({ loseNextReread: true });
	const store = createGenerationPackageStore(db);
	await expect(store.create(userId, input)).rejects.toThrow("re-read");
	expect(state.rows).toHaveLength(1);
	const retry = await store.create(userId, input);
	expect(retry?.id).toBe(state.rows[0]?.id as string);
	expect(state.rows).toHaveLength(1);
});

test("a request without a key still creates a new package each time", async () => {
	const { db, state } = fakeDb();
	const store = createGenerationPackageStore(db);
	const { idempotencyKey: _key, ...unkeyed } = input;
	await store.create(userId, unkeyed);
	state.rows.length = 0;
	const second = await store.create(userId, unkeyed);
	expect(second).not.toBeNull();
});

test("a stored package pointing at another Asset Record is repaired, not replayed as success", async () => {
	const { db, state } = fakeDb();
	const store = createGenerationPackageStore(db);
	const first = await store.create(userId, input);
	const row = state.rows[0] as Row;
	row.snapshot = {
		...(row.snapshot as Row),
		assetRecord: { ...snapshot.assetRecord, id: crypto.randomUUID() },
	};
	const repaired = await store.create(userId, input);
	expect(repaired?.id).toBe(first?.id as string);
	expect(repaired?.assetRecord.id).toBe(assetRecordId);
	expect(state.deleted).toBe(1);
	expect(state.rows).toHaveLength(1);
});

test("a stored snapshot that is no longer a valid Generation Package snapshot is repaired too", async () => {
	const { db, state } = fakeDb();
	const store = createGenerationPackageStore(db);
	await store.create(userId, input);
	const row = state.rows[0] as Row;
	row.snapshot = { ...(row.snapshot as Row), referenceRoles: "broken" };
	const repaired = await store.create(userId, input);
	expect(repaired?.referenceRoles).toEqual([]);
	expect(state.deleted).toBe(1);
});

test("a failed withdrawal fails retryably and the next request with the same key repairs the residue", async () => {
	const { db, state } = fakeDb({ failDeletes: 1 });
	const store = createGenerationPackageStore(db);
	await store.create(userId, input);
	const row = state.rows[0] as Row;
	row.snapshot = { ...(row.snapshot as Row), referenceRoles: "broken" };
	await expect(store.create(userId, input)).rejects.toBeInstanceOf(
		RecordIntegrityError
	);
	expect(state.rows).toHaveLength(1);
	const repaired = await store.create(userId, input);
	expect(repaired?.referenceRoles).toEqual([]);
	expect(state.rows).toHaveLength(1);
});
