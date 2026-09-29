import { expect, test } from "bun:test";
import { createRouterClient } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";

const testProjectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const testAssetRecordId = "a7301990-3d79-49c8-887a-c1fa9a468f85";

function createTestClient(
	session: { user: { id: string } } | null = {
		user: { id: "user-id" },
	}
) {
	const records: Record<string, unknown>[] = [];
	const rightsRecordStore = {
		createRevision(_userId: string, input: Record<string, unknown>) {
			const existing = records.find(
				(candidateRecord) => candidateRecord.id === input.id
			);
			if (existing) {
				return { ok: true, record: existing };
			}
			const versionNumber =
				records.filter(
					(candidateRecord) =>
						candidateRecord.projectId === input.projectId &&
						candidateRecord.assetRecordId === input.assetRecordId
				).length + 1;
			const savedRecord = {
				...input,
				createdAt: new Date(
					`2026-09-29T10:0${versionNumber}:00.000Z`
				).toISOString(),
				versionNumber,
			};
			records.push(savedRecord);
			return { ok: true, record: savedRecord };
		},
		list(
			_userId: string,
			requestedProjectId: string,
			requestedAssetRecordId: string
		) {
			return records
				.filter(
					(candidateRecord) =>
						candidateRecord.projectId === requestedProjectId &&
						candidateRecord.assetRecordId === requestedAssetRecordId
				)
				.sort(
					(left, right) =>
						Number(right.versionNumber) - Number(left.versionNumber)
				);
		},
	};
	const context = {
		rightsRecordStore,
		session,
	};
	return createRouterClient(appRouter as never, {
		context: context as never,
	}) as {
		rightsRecords: {
			create: (
				input: Record<string, unknown>
			) => Promise<Record<string, unknown>>;
			list: (
				input: Record<string, unknown>
			) => Promise<Record<string, unknown>[]>;
		};
	};
}

test("creates a new Rights Record revision and rereads immutable history", async () => {
	const client = createTestClient();
	const firstInput = {
		assetRecordId: testAssetRecordId,
		assertedScope: "The game may use this icon in paid releases.",
		evidence: "License reference: https://example.test/license",
		id: "3d9d07a4-37af-43d6-8583-e2256baf0a58",
		projectId: testProjectId,
		restrictions: "Do not resell the source file.",
		rightsHolderOrProvider: "Example Studio",
		source: "https://example.test/source",
		state: "documented",
		uncertainty: "The license has not been reviewed for merchandising.",
	};

	const firstRevision = await client.rightsRecords.create(firstInput);
	const secondRevision = await client.rightsRecords.create({
		...firstInput,
		id: "5240db4d-6cb5-4962-b013-cadfffb6da02",
		state: "restricted",
		uncertainty: "The provider clarified a limit on commercial use.",
	});
	const history = await client.rightsRecords.list({
		assetRecordId: testAssetRecordId,
		projectId: testProjectId,
	});

	expect(firstRevision).toMatchObject({
		...firstInput,
		versionNumber: 1,
	});
	expect(secondRevision).toMatchObject({
		assetRecordId: testAssetRecordId,
		id: "5240db4d-6cb5-4962-b013-cadfffb6da02",
		state: "restricted",
		versionNumber: 2,
	});
	expect(history).toEqual([secondRevision, firstRevision]);
	expect(history[1]).toMatchObject(firstInput);
});

test("does not return a Rights Record history without an authenticated session", async () => {
	const client = createTestClient(null);
	await expect(
		client.rightsRecords.list({
			assetRecordId: testAssetRecordId,
			projectId: testProjectId,
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("rejects declared Rights Record states without their required evidence", async () => {
	const client = createTestClient();
	const input = {
		assetRecordId: testAssetRecordId,
		assertedScope: "Paid game releases",
		evidence: null,
		id: "3d9d07a4-37af-43d6-8583-e2256baf0a58",
		projectId: testProjectId,
		restrictions: null,
		rightsHolderOrProvider: "Example Studio",
		source: "https://example.test/source",
		state: "documented",
		uncertainty: null,
	};

	await expect(client.rightsRecords.create(input)).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	await expect(
		client.rightsRecords.create({
			...input,
			id: "5240db4d-6cb5-4962-b013-cadfffb6da02",
			state: "restricted",
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
