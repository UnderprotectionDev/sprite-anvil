import { expect, test } from "bun:test";
import { generationPackageSnapshotSchema } from "@sprite-anvil/api/generation-packages";
import type { Database } from "@sprite-anvil/db";
import { createGenerationPackageStore } from "../generation-package-store";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";
const assetRecordId = "b178f612-12ec-432a-b254-32a6fd781cc4";
const packageId = "2de54a7e-962c-48d3-b07a-bfbc16a2b724";

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

function row(overrides: Record<string, unknown> = {}) {
	return {
		id: packageId,
		projectId,
		assetRecordId,
		createdByUserId: userId,
		// A JSON column returns members in its own order.
		snapshot: JSON.parse(JSON.stringify(snapshot)),
		createdAt: new Date("2026-11-06T09:30:00.000Z"),
		...overrides,
	};
}

/** Fake database: `persisted` is what a re-read of the new package returns. */
function fakeDb(persisted: Record<string, unknown> | null) {
	const state = { deleted: 0, inserted: 0 };
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
					limit: () => Promise.resolve(persisted ? [persisted] : []),
				}),
			}),
		}),
		insert: () => ({
			values: () => {
				state.inserted += 1;
				return { returning: () => Promise.resolve([row()]) };
			},
		}),
		delete: () => ({
			where: () => {
				state.deleted += 1;
				return Promise.resolve();
			},
		}),
	} as unknown as Database;
	return { db, state };
}

const input = { assetRecordId, projectId, snapshot };

test("publishes a Generation Package whose persisted content digest and relations match", async () => {
	const { db, state } = fakeDb(row());
	const created = await createGenerationPackageStore(db).create(userId, input);
	expect(created).toMatchObject({
		assetRecordId,
		id: packageId,
		projectId,
		targetTask: snapshot.targetTask,
	});
	expect(state.deleted).toBe(0);
});

test("withdraws and rejects a Generation Package whose persisted content digest differs", async () => {
	const { db, state } = fakeDb(
		row({ snapshot: { ...snapshot, targetTask: "Create a different task." } })
	);
	await expect(
		createGenerationPackageStore(db).create(userId, input)
	).rejects.toThrow("content digest");
	expect(state.deleted).toBe(1);
});

test("withdraws and rejects a Generation Package persisted against another Asset Record", async () => {
	const { db, state } = fakeDb(row({ assetRecordId: crypto.randomUUID() }));
	await expect(
		createGenerationPackageStore(db).create(userId, input)
	).rejects.toThrow("relation");
	expect(state.deleted).toBe(1);
});

test("rejects a snapshot that describes a different Asset Record before writing", async () => {
	const { db, state } = fakeDb(row());
	await expect(
		createGenerationPackageStore(db).create(userId, {
			...input,
			assetRecordId: crypto.randomUUID(),
		})
	).rejects.toThrow("relation");
	expect(state.inserted).toBe(0);
});

test("does not report success when the written package cannot be re-read", async () => {
	const { db } = fakeDb(null);
	await expect(
		createGenerationPackageStore(db).create(userId, input)
	).rejects.toThrow("re-read");
});
