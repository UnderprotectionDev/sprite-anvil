import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import {
	type AssetRecordCreateInput,
	assetRecordMeasurementsUpdateInputSchema,
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
	measurements?: MeasurementFixture;
	name: string;
	projectId: string;
	supportLevel: "general";
}

const measurements: MeasurementFixture = {
	sourceImageDimensions: {
		proposal: { width: 512, height: 256 },
		confirmed: { width: 512, height: 256 },
	},
	logicalResolution: {
		proposal: { width: 72, height: 80 },
		confirmed: { width: 72, height: 80 },
	},
	cellDimensions: {
		proposal: null,
		confirmed: { width: 24, height: 32 },
	},
	visibleContentBounds: {
		proposal: { x: 3, y: 4, width: 66, height: 74 },
		confirmed: { x: 3, y: 4, width: 66, height: 74 },
	},
	displayScale: { proposal: 2.5, confirmed: 2 },
	atlasDimensions: {
		proposal: { width: 1024, height: 512 },
		confirmed: null,
	},
};

interface MeasurementFixture {
	atlasDimensions: {
		confirmed: PixelDimensions | null;
		proposal: PixelDimensions | null;
	};
	cellDimensions: {
		confirmed: PixelDimensions | null;
		proposal: PixelDimensions | null;
	};
	displayScale: { confirmed: number | null; proposal: number | null };
	logicalResolution: {
		confirmed: PixelDimensions | null;
		proposal: PixelDimensions | null;
	};
	sourceImageDimensions: {
		confirmed: PixelDimensions | null;
		proposal: PixelDimensions | null;
	};
	visibleContentBounds: {
		confirmed: ContentBounds | null;
		proposal: ContentBounds | null;
	};
}

interface PixelDimensions {
	height: number;
	width: number;
}

interface ContentBounds {
	height: number;
	width: number;
	x: number;
	y: number;
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
		updateMeasurements: (
			requestingUserId: string,
			input: {
				assetRecordId: string;
				measurements: MeasurementFixture;
				projectId: string;
			}
		) => {
			if (requestingUserId !== ownerId || input.projectId !== projectId) {
				return null;
			}
			const record = storedRecords.get(input.assetRecordId);
			if (!record || record.projectId !== input.projectId) {
				return null;
			}
			const updatedRecord = { ...record, measurements: input.measurements };
			storedRecords.set(record.id, updatedRecord);
			return updatedRecord;
		},
	};

	return {
		assetRecordStore: store,
		assetRecordTrackingStore: {} as never,
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

test("accepts legacy Asset Records whose identity criteria were not recorded", () => {
	const record = {
		availability: "active",
		createdAt: "2026-09-25T08:00:00.000Z",
		id: recordId,
		identityCriteria: [],
		name: "Ash Knight",
		projectId,
		supportLevel: "general",
	};

	expect(assetRecordSchema.safeParse(record).success).toBe(true);
});

test("saves independent measurements and rereads proposals separately from confirmed values", async () => {
	const storedRecords = new Map<string, TestRecord>([
		[
			recordId,
			{
				availability: "active",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: recordId,
				identityCriteria: ["independent_product_meaning"],
				name: "Ash Knight",
				projectId,
				supportLevel: "general",
			},
		],
	]);
	const context = createContext(ownerId, storedRecords);
	const saved = await call(
		appRouter.assetRecords.updateMeasurements,
		{ assetRecordId: recordId, measurements, projectId },
		{ context }
	);
	const reread = await call(
		appRouter.assetRecords.get,
		{ assetRecordId: recordId, projectId },
		{ context }
	);

	expect(saved.measurements).toEqual(measurements);
	expect(reread.measurements).toEqual(measurements);
	expect(reread.measurements.sourceImageDimensions.confirmed).not.toEqual(
		reread.measurements.logicalResolution.confirmed
	);
	expect(reread.measurements.displayScale).toEqual({
		proposal: 2.5,
		confirmed: 2,
	});
});

test("rejects invalid pixel geometry and non-positive display scales", () => {
	const input = { assetRecordId: recordId, measurements, projectId };
	expect(
		assetRecordMeasurementsUpdateInputSchema.safeParse({
			...input,
			measurements: {
				...measurements,
				logicalResolution: {
					confirmed: null,
					proposal: { width: 0, height: 80 },
				},
			},
		}).success
	).toBe(false);
	expect(
		assetRecordMeasurementsUpdateInputSchema.safeParse({
			...input,
			measurements: {
				...measurements,
				displayScale: { confirmed: 0, proposal: null },
			},
		}).success
	).toBe(false);
	const incompleteBounds = { y: 4, width: 66, height: 74 };
	expect(
		assetRecordMeasurementsUpdateInputSchema.safeParse({
			...input,
			measurements: {
				...measurements,
				visibleContentBounds: {
					confirmed: null,
					proposal: incompleteBounds,
				},
			},
		}).success
	).toBe(false);
});

test("keeps measurement updates inside the owning project's access boundary", async () => {
	const storedRecords = new Map<string, TestRecord>([
		[
			recordId,
			{
				availability: "active",
				createdAt: "2026-09-25T08:00:00.000Z",
				id: recordId,
				identityCriteria: ["independent_product_meaning"],
				name: "Ash Knight",
				projectId,
				supportLevel: "general",
			},
		],
	]);

	await expect(
		call(
			appRouter.assetRecords.updateMeasurements,
			{ assetRecordId: recordId, measurements, projectId },
			{ context: createContext("user-other", storedRecords) }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(storedRecords.get(recordId)?.measurements).toBeUndefined();
});
