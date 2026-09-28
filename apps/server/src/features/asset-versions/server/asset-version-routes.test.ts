import { expect, test } from "bun:test";
import { Hono } from "hono";
import type { AssetVersionRouteDependencies } from "./asset-version-routes";
import { mountAssetVersionRoutes } from "./asset-version-routes";

const projectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const assetRecordId = "a7301990-3d79-49c8-887a-c1fa9a468f85";

test("does not let a browser upload claim a connected-provider result", async () => {
	const app = new Hono();
	mountAssetVersionRoutes(app, {
		assetVersionStore: {
			getAssetRecordForUpload: async () => ({
				assetFamilyId: null,
				assetRecordId,
				projectId,
			}),
		},
		createStorage: () => {
			throw new Error("storage must not be reached");
		},
		getProjectForUser: async () => ({ id: projectId }),
		getSession: async () => ({ user: { id: "user-id" } }),
	} as unknown as AssetVersionRouteDependencies);

	const response = await app.request(
		`/api/projects/${projectId}/asset-records/${assetRecordId}/versions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "image/png",
				"X-Asset-Version-File-Name": "result.png",
				"X-Asset-Version-Size": "1",
				"X-Asset-Version-Production-Source": "connected_provider",
				"Idempotency-Key": "5436c215-0cb2-4d5f-a979-cbe8ec5f33f2",
			},
			body: new Uint8Array([0]),
		}
	);

	expect(response.status).toBe(400);
});
