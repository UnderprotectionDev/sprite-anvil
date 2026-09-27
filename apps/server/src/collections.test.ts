import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";

const ownerId = "user-collections";
const projectId = "project-collections";
const characterRecord = {
	assetFamilyId: "family-character",
	assetFamilyName: "Ash Knight",
	availability: "active",
	id: "asset-record-character",
	name: "Idle animation",
};
const propRecord = {
	assetFamilyId: "family-prop",
	assetFamilyName: "Iron Key",
	availability: "active",
	id: "asset-record-prop",
	name: "Inventory icon",
};
const records = [characterRecord, propRecord];

function createContext(userId: string | null = ownerId) {
	const state = {
		assetRecords: records.map((record) => ({ ...record })),
		collections: [] as {
			createdAt: string;
			id: string;
			name: string;
			projectId: string;
		}[],
		memberships: [] as {
			assetRecordId: string;
			collectionId: string;
			createdAt: string;
			projectId: string;
		}[],
	};

	const collectionStore = {
		list(requestingUserId: string, requestedProjectId: string) {
			if (requestingUserId !== ownerId || requestedProjectId !== projectId) {
				return null;
			}
			return state;
		},
		create(
			requestingUserId: string,
			input: { name: string; projectId: string }
		) {
			if (requestingUserId !== ownerId || input.projectId !== projectId) {
				return null;
			}
			const collection = {
				createdAt: "2026-09-27T08:00:00.000Z",
				id: `collection-${state.collections.length + 1}`,
				name: input.name,
				projectId: input.projectId,
			};
			state.collections.push(collection);
			return collection;
		},
		addAssetRecord(
			requestingUserId: string,
			input: {
				assetRecordId: string;
				collectionId: string;
				projectId: string;
			}
		) {
			if (requestingUserId !== ownerId || input.projectId !== projectId) {
				return null;
			}
			if (
				!(
					state.collections.some((item) => item.id === input.collectionId) &&
					state.assetRecords.some((item) => item.id === input.assetRecordId)
				)
			) {
				return null;
			}
			const existing = state.memberships.find(
				(item) =>
					item.collectionId === input.collectionId &&
					item.assetRecordId === input.assetRecordId
			);
			if (existing) {
				return existing;
			}
			const membership = {
				assetRecordId: input.assetRecordId,
				collectionId: input.collectionId,
				createdAt: "2026-09-27T08:01:00.000Z",
				projectId: input.projectId,
			};
			state.memberships.push(membership);
			return membership;
		},
		removeAssetRecord(
			requestingUserId: string,
			input: {
				assetRecordId: string;
				collectionId: string;
				projectId: string;
			}
		) {
			if (requestingUserId !== ownerId || input.projectId !== projectId) {
				return null;
			}
			const index = state.memberships.findIndex(
				(item) =>
					item.collectionId === input.collectionId &&
					item.assetRecordId === input.assetRecordId
			);
			return index >= 0 ? state.memberships.splice(index, 1)[0] : null;
		},
	};

	return {
		context: {
			collectionStore,
			session: userId ? { user: { id: userId } } : null,
		} as unknown as Context,
		state,
	};
}

test("organizes Asset Records from different families without changing their history", async () => {
	const { context, state } = createContext();
	const sourceRecordsBefore = structuredClone(state.assetRecords);
	const collection = await call(
		appRouter.collections.create,
		{ name: "  Field Notes  ", projectId },
		{ context }
	);

	const firstMembership = await call(
		appRouter.collections.addAssetRecord,
		{
			assetRecordId: characterRecord.id,
			collectionId: collection.id,
			projectId,
		},
		{ context }
	);
	expect(firstMembership.assetRecordId).toBe(characterRecord.id);
	await call(
		appRouter.collections.addAssetRecord,
		{
			assetRecordId: characterRecord.id,
			collectionId: collection.id,
			projectId,
		},
		{ context }
	);
	expect(state.memberships).toHaveLength(1);
	await call(
		appRouter.collections.addAssetRecord,
		{ assetRecordId: propRecord.id, collectionId: collection.id, projectId },
		{ context }
	);

	const organized = await call(
		appRouter.collections.list,
		{ projectId },
		{ context }
	);
	expect(collection.name).toBe("Field Notes");
	expect(
		organized.memberships.map(({ assetRecordId }) => assetRecordId)
	).toEqual(records.map(({ id }) => id));
	expect(
		organized.assetRecords.map(({ assetFamilyId }) => assetFamilyId)
	).toEqual(["family-character", "family-prop"]);

	await call(
		appRouter.collections.removeAssetRecord,
		{
			assetRecordId: characterRecord.id,
			collectionId: collection.id,
			projectId,
		},
		{ context }
	);

	const reorganized = await call(
		appRouter.collections.list,
		{ projectId },
		{ context }
	);
	expect(reorganized.collections).toContainEqual(collection);
	expect(reorganized.memberships).toHaveLength(1);
	expect(reorganized.memberships[0]?.assetRecordId).toBe(propRecord.id);
	expect(state.assetRecords).toEqual(sourceRecordsBefore);
});

test("requires an authenticated user to list Collections", async () => {
	const { context } = createContext(null);
	await expect(
		call(appRouter.collections.list, { projectId }, { context })
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("does not expose Collections outside the owned Project", async () => {
	const { context } = createContext();
	await expect(
		call(
			appRouter.collections.list,
			{ projectId: "other-project" },
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("allows one Asset Record in multiple Collections without duplicate membership", async () => {
	const { context } = createContext();
	const firstCollection = await call(
		appRouter.collections.create,
		{ name: "Character Notes", projectId },
		{ context }
	);
	const secondCollection = await call(
		appRouter.collections.create,
		{ name: "UI References", projectId },
		{ context }
	);

	await Promise.all(
		[firstCollection, secondCollection].map((collection) =>
			call(
				appRouter.collections.addAssetRecord,
				{
					assetRecordId: characterRecord.id,
					collectionId: collection.id,
					projectId,
				},
				{ context }
			)
		)
	);
	await call(
		appRouter.collections.addAssetRecord,
		{
			assetRecordId: characterRecord.id,
			collectionId: secondCollection.id,
			projectId,
		},
		{ context }
	);

	const catalog = await call(
		appRouter.collections.list,
		{ projectId },
		{ context }
	);
	expect(catalog.memberships).toHaveLength(2);
	expect(
		new Set(catalog.memberships.map((membership) => membership.collectionId))
	).toEqual(new Set([firstCollection.id, secondCollection.id]));
	for (const membership of catalog.memberships) {
		expect(membership.assetRecordId).toBe(characterRecord.id);
	}
});
