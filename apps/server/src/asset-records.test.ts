import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import {
	type AssetRecordCreateInput,
	assetRecordSchema,
} from "@sprite-anvil/api/asset-records";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";

const ownerId = "user-asset-records";
const projectId = "44e8fa5d-61ad-43b1-9766-89788268a745";
const recordId = "2a580d46-c4af-4d05-9b4a-461dc679f625";

interface TestRecord {
	availability: "active";
	createdAt: string;
	id: string;
	identityCriteria: string[];
	name: string;
	projectId: string;
	supportLevel: "general";
}

function createContext(
	userId: string,
	storedRecords: Map<string, TestRecord>
): Context {
	const store = {
		create: (requestingUserId: string, input: AssetRecordCreateInput) => {
			if (requestingUserId !== ownerId || input.projectId !== projectId) {
				return null;
			}
			const existingRecord = storedRecords.get(input.id);
			if (existingRecord) {
				return existingRecord;
			}
			const record: TestRecord = {
				availability: "active",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: input.id,
				identityCriteria: input.identityCriteria,
				name: input.name,
				projectId: input.projectId,
				supportLevel: "general",
			};
			storedRecords.set(record.id, record);
			return record;
		},
		get: (
			requestingUserId: string,
			targetProjectId: string,
			targetRecordId: string
		) => {
			if (requestingUserId !== ownerId || targetProjectId !== projectId) {
				return null;
			}
			const record = storedRecords.get(targetRecordId);
			return record?.projectId === targetProjectId ? record : null;
		},
		list: (requestingUserId: string, targetProjectId: string) => {
			if (requestingUserId !== ownerId || targetProjectId !== projectId) {
				return null;
			}
			return [...storedRecords.values()].filter(
				(record) => record.projectId === targetProjectId
			);
		},
	};

	return {
		assetRecordStore: store,
		session: { user: { id: userId } },
	} as unknown as Context;
}

test("creates and rereads an Asset Record by its independent identity", async () => {
	const storedRecords = new Map<string, TestRecord>();
	const context = createContext(ownerId, storedRecords);
	const created = await call(
		appRouter.assetRecords.create,
		{
			projectId,
			id: recordId,
			name: "Ash Knight",
			identityCriteria: ["independent_product_meaning"],
		},
		{ context }
	);
	const retried = await call(
		appRouter.assetRecords.create,
		{
			projectId,
			id: recordId,
			name: "Ash Knight",
			identityCriteria: ["independent_product_meaning"],
		},
		{ context }
	);
	const reread = await call(
		appRouter.assetRecords.get,
		{ assetRecordId: created.id, projectId },
		{ context }
	);

	expect(created).toMatchObject({
		availability: "active",
		identityCriteria: ["independent_product_meaning"],
		name: "Ash Knight",
		projectId,
		supportLevel: "general",
	});
	expect(retried).toEqual(created);
	expect(reread).toEqual(created);
});

test("does not expose an Asset Record to another project's user", async () => {
	const storedRecords = new Map<string, TestRecord>([
		[
			recordId,
			{
				availability: "active",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: recordId,
				identityCriteria: ["delivery_identity"],
				name: "Ash Knight export portrait",
				projectId,
				supportLevel: "general",
			},
		],
	]);

	await expect(
		call(
			appRouter.assetRecords.get,
			{ assetRecordId: recordId, projectId },
			{ context: createContext("user-other", storedRecords) }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("rejects reuse of an Asset Record id with different content", async () => {
	const context = createContext(ownerId, new Map());
	await call(
		appRouter.assetRecords.create,
		{
			projectId,
			id: recordId,
			name: "Ash Knight",
			identityCriteria: ["independent_product_meaning"],
		},
		{ context }
	);

	await expect(
		call(
			appRouter.assetRecords.create,
			{
				projectId,
				id: recordId,
				name: "Different asset",
				identityCriteria: ["delivery_identity"],
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("uses the canonical Erased availability value", () => {
	const record = {
		availability: "erased",
		createdAt: "2026-09-25T08:00:00.000Z",
		id: recordId,
		identityCriteria: ["independent_product_meaning"],
		name: "Ash Knight",
		projectId,
		supportLevel: "general",
	};

	expect(assetRecordSchema.safeParse(record).success).toBe(true);
	expect(
		assetRecordSchema.safeParse({ ...record, availability: "deleted" }).success
	).toBe(false);
});
