import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type {
	AssetRecord,
	AssetRecordMetadataUpdateInput,
	AssetRecordSearchInput,
	AssetRecordSearchResponse,
} from "@sprite-anvil/api/asset-records";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";

const ownerId = "user-asset-discovery";
const projectId = "44e8fa5d-61ad-43b1-9766-89788268a745";
const assetRecordId = "2a580d46-c4af-4d9a-9766-89788268f201";
const visualWorldId = "4ee8fa5d-61ad-43b1-9766-89788268a745";
const themeId = "5ee8fa5d-61ad-43b1-9766-89788268a745";
const versionId = "6ee8fa5d-61ad-43b1-9766-89788268a745";

const searchInput: AssetRecordSearchInput = {
	assetCategory: "icon",
	availability: "archived",
	name: "ash",
	projectId,
	sourceImageHeight: 48,
	sourceImageWidth: 32,
	tag: "inventory",
	themeId,
	visualWorldId,
};

const searchRecord: AssetRecord = {
	assetCategory: "icon",
	availability: "archived",
	createdAt: "2026-09-25T08:00:00.000Z",
	id: assetRecordId,
	identityCriteria: ["independent_product_meaning"],
	name: "Ash Knight Icon",
	projectId,
	supportLevel: "general",
	tags: ["inventory"],
	themeId,
	visualWorldId,
};

const searchResult: AssetRecordSearchResponse = {
	records: [
		{
			matchingVersions: [
				{
					fileName: "ash-knight-icon.webp",
					id: versionId,
					sourceImageHeight: 48,
					sourceImageWidth: 32,
					versionNumber: 3,
				},
			],
			record: searchRecord,
		},
	],
	totalCount: 1,
};

function createContext(
	search: (
		userId: string,
		input: AssetRecordSearchInput
	) => Promise<AssetRecordSearchResponse | null>
) {
	return {
		assetRecordStore: { search } as unknown as Context["assetRecordStore"],
		assetRecordTrackingStore: {} as never,
		session: { user: { id: ownerId } },
	} as unknown as Context;
}

test("searches an owned project and returns the matching Asset Version with its record", async () => {
	const received: {
		userId?: string;
		input?: AssetRecordSearchInput;
	} = {};
	const context = createContext((userId, input) => {
		received.userId = userId;
		received.input = input;
		return Promise.resolve(searchResult);
	});

	const result = await call(appRouter.assetRecords.search, searchInput, {
		context,
	});

	expect(received).toMatchObject({ userId: ownerId, input: searchInput });
	expect(result).toEqual(searchResult);
});

test("does not expose search results outside the owned project", async () => {
	const context = {
		...createContext(() => Promise.resolve(null)),
		session: { user: { id: "user-other-project" } },
	} as unknown as Context;

	await expect(
		call(appRouter.assetRecords.search, searchInput, { context })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("updates editable record metadata for its owner", async () => {
	const updateInput: AssetRecordMetadataUpdateInput = {
		assetCategory: "icon" as const,
		assetRecordId,
		projectId,
		tags: ["inventory"],
		themeId,
		visualWorldId,
	};
	const updatedRecord = {
		...searchRecord,
		createdAt: "2026-09-25T08:00:00.000Z",
	};
	const received: {
		userId?: string;
		input?: AssetRecordMetadataUpdateInput;
	} = {};
	const context = {
		...createContext(() => Promise.resolve(searchResult)),
		assetRecordStore: {
			updateMetadata: (
				userId: string,
				input: AssetRecordMetadataUpdateInput
			) => {
				received.userId = userId;
				received.input = input;
				return Promise.resolve({ ok: true as const, record: updatedRecord });
			},
		} as unknown as Context["assetRecordStore"],
	} as unknown as Context;

	const result = await call(
		appRouter.assetRecords.updateMetadata,
		updateInput,
		{ context }
	);

	expect(received).toMatchObject({ userId: ownerId, input: updateInput });
	expect(result).toMatchObject({
		assetCategory: "icon",
		id: assetRecordId,
		tags: ["inventory"],
		themeId,
		visualWorldId,
	});
});

test("rejects metadata that assigns a Theme outside the selected Visual World", async () => {
	const context = {
		...createContext(() => Promise.resolve(searchResult)),
		assetRecordStore: {
			updateMetadata: () =>
				Promise.resolve({
					ok: false as const,
					reason: "invalid_scope" as const,
				}),
		} as unknown as Context["assetRecordStore"],
	} as unknown as Context;

	await expect(
		call(
			appRouter.assetRecords.updateMetadata,
			{
				assetCategory: "icon",
				assetRecordId,
				projectId,
				tags: [],
				themeId,
				visualWorldId,
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("reports that the Visual World metadata scope is invalid", async () => {
	const context = {
		...createContext(() => Promise.resolve(searchResult)),
		assetRecordStore: {
			updateMetadata: () =>
				Promise.resolve({
					ok: false as const,
					reason: "invalid_scope" as const,
				}),
		} as unknown as Context["assetRecordStore"],
	} as unknown as Context;

	await expect(
		call(
			appRouter.assetRecords.updateMetadata,
			{
				assetCategory: "icon",
				assetRecordId,
				projectId,
				tags: [],
				themeId: null,
				visualWorldId,
			},
			{ context }
		)
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: "Tema veya Görsel Dünya seçilen proje kapsamında olmalıdır.",
	});
});
