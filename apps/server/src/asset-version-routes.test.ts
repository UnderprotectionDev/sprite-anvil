import { expect, test } from "bun:test";
import { Hono } from "hono";
import sharp from "sharp";
import {
	type AssetVersionRouteDependencies,
	type AssetVersionSession,
	mountAssetVersionRoutes,
} from "./features/asset-versions/server/asset-version-routes";

const projectId = "asset-version-route-project";
const assetRecordId = "a17f5ff0-a50d-438f-8bf2-a0152b42c3e9";
const userId = "asset-version-route-user";

function createRouteHarness(
	session: AssetVersionSession | null = { user: { id: userId } },
	createCandidateVersionError?: Error
) {
	const calls = {
		candidateVersion: 0,
		delete: 0,
		put: 0,
		storage: 0,
	};
	const objects = new Map<string, Uint8Array>();
	const sourceAssetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c301";
	const previousFrameAssetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c302";
	const unrelatedDirectionAssetVersionId =
		"a17f5ff0-a50d-438f-8bf2-a0152b42c303";
	const savedAssetVersions: unknown[] = [
		{ id: sourceAssetVersionId, reviewDisposition: "approved" },
		{ id: previousFrameAssetVersionId, reviewDisposition: "approved" },
		{ id: unrelatedDirectionAssetVersionId, reviewDisposition: "approved" },
	];
	const savedUnitVersions: unknown[] = [
		{
			id: "unit-version-old-frame",
			assetRecordId,
			assetVersionId: previousFrameAssetVersionId,
			sourceAssetVersionId,
			unitType: "frame",
			unitKey: "attack/frame-3",
			versionNumber: 1,
		},
		{
			id: "unit-version-unrelated-direction",
			assetRecordId,
			assetVersionId: unrelatedDirectionAssetVersionId,
			sourceAssetVersionId,
			unitType: "direction",
			unitKey: "north",
			versionNumber: 1,
		},
	];
	let createIdCount = 0;
	const storage = {
		async put(
			key: string,
			body: ReadableStream<Uint8Array>,
			_contentType: "image/png" | "image/webp"
		) {
			calls.put += 1;
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
		get: () => Promise.resolve(null),
		delete(key: string) {
			return Promise.resolve().then(() => {
				calls.delete += 1;
				objects.delete(key);
			});
		},
	};
	const dependencies: AssetVersionRouteDependencies = {
		assetVersionStore: {
			createCompositeVersion: () => Promise.resolve(null),
			createCandidateVersion(_requestedUserId, input) {
				calls.candidateVersion += 1;
				if (createCandidateVersionError) {
					throw createCandidateVersionError;
				}
				const unitCorrection = Reflect.get(input, "unitCorrection");
				if (!unitCorrection || typeof unitCorrection !== "object") {
					return Promise.resolve(null);
				}
				const { id } = input;
				const createdAt = "2026-09-27T12:00:00.000Z";
				const versionNumber = savedAssetVersions.length + 1;
				const version = {
					id,
					projectId,
					assetFamilyId: "asset-version-route-family",
					assetRecordId,
					versionNumber,
					contentType: input.contentType,
					contentLength: input.contentLength,
					contentDigest: input.contentDigest,
					integrityVerified: true,
					previewUrl: `/api/projects/${projectId}/asset-versions/${id}/preview`,
					reviewDisposition: "candidate",
					reviewEvents: [],
					createdAt,
				};
				const unitVersion = {
					id: `unit-${id}`,
					projectId,
					assetRecordId,
					assetVersionId: id,
					sourceAssetVersionId: Reflect.get(
						unitCorrection,
						"sourceAssetVersionId"
					),
					unitType: Reflect.get(unitCorrection, "unitType"),
					unitKey: Reflect.get(unitCorrection, "unitKey"),
					versionNumber:
						savedUnitVersions.filter(
							(candidate) =>
								candidate !== null &&
								typeof candidate === "object" &&
								Reflect.get(candidate, "unitType") ===
									Reflect.get(unitCorrection, "unitType") &&
								Reflect.get(candidate, "unitKey") ===
									Reflect.get(unitCorrection, "unitKey")
						).length + 1,
					createdAt,
				};
				savedAssetVersions.push(version);
				savedUnitVersions.push(unitVersion);
				return Promise.resolve({
					kind: "created",
					version,
					unitVersion,
				} as never);
			},
			getAssetRecordForUpload(
				requestedUserId,
				requestedProjectId,
				requestedRecordId
			) {
				return Promise.resolve(
					requestedUserId === userId &&
						requestedProjectId === projectId &&
						requestedRecordId === assetRecordId
						? {
								projectId,
								assetFamilyId: "asset-version-route-family",
								assetRecordId,
							}
						: null
				);
			},
			getFileRecord() {
				return Promise.resolve(null);
			},
			list() {
				return Promise.resolve({
					assetVersions: savedAssetVersions,
					canonicalDesigns: [],
					unitVersions: savedUnitVersions,
					compositeVersions: [],
				} as never);
			},
			recordReviewEvent() {
				return Promise.resolve(null);
			},
			recordCompositeVersionReviewEvent() {
				return Promise.resolve(null);
			},
			selectCanonicalDesign() {
				return Promise.resolve(null);
			},
		},
		createId() {
			createIdCount += 1;
			return `a17f5ff0-a50d-438f-8bf2-a0152b42c30${createIdCount}`;
		},
		createStorage() {
			calls.storage += 1;
			return storage;
		},
		getProjectForUser: (requestedUserId, requestedProjectId) =>
			Promise.resolve(
				requestedUserId === userId && requestedProjectId === projectId
					? { id: projectId }
					: null
			),
		getSession: () => Promise.resolve(session),
	};
	const app = new Hono();
	mountAssetVersionRoutes(app, dependencies);
	return {
		app,
		calls,
		dependencies,
		objects,
		savedAssetVersions,
		savedUnitVersions,
	};
}

function upload(
	app: Hono,
	bytes: Uint8Array,
	declaredLength: number,
	route: "versions" | "unit-versions" = "unit-versions",
	contentType = "image/png"
) {
	return app.request(
		`/api/projects/${projectId}/asset-records/${assetRecordId}/${route}`,
		{
			method: "POST",
			headers: {
				"Content-Type": contentType,
				"X-Asset-Version-File-Name": "upload.png",
				"X-Asset-Version-Size": declaredLength.toString(),
				"Idempotency-Key": "asset-version-route-test",
				"X-Source-Asset-Version-Id": "a17f5ff0-a50d-438f-8bf2-a0152b42c301",
				"X-Unit-Version-Type": "frame",
				"X-Unit-Version-Key": "attack/frame-3",
			},
			body: bytes,
		}
	);
}

test("denies Asset Version uploads before reading project or storage without a session", async () => {
	const { app, calls } = createRouteHarness(null);

	const response = await upload(app, new Uint8Array([1]), 1, "versions");

	expect(response.status).toBe(401);
	expect(calls.storage).toBe(0);
	expect(calls.candidateVersion).toBe(0);
});

test("requires Manual Import Evidence before accepting a direct Asset Version upload", async () => {
	const { app, calls, objects } = createRouteHarness();
	const png = await sharp({
		create: {
			width: 1,
			height: 1,
			channels: 4,
			background: { r: 255, g: 64, b: 128, alpha: 1 },
		},
	})
		.png()
		.toBuffer();

	const response = await upload(app, png, png.byteLength, "versions");
	const error = await response.json();

	expect(response.status).toBe(400);
	expect(error).toMatchObject({
		error: "Manual Import Evidence is required for Asset Version uploads",
	});
	expect(calls.storage).toBe(0);
	expect(calls.put).toBe(0);
	expect(calls.candidateVersion).toBe(0);
	expect(objects.size).toBe(0);
});

test("denies Unit Version uploads before reading storage without a session", async () => {
	const { app, calls } = createRouteHarness(null);
	const response = await app.request(
		`/api/projects/${projectId}/asset-records/${assetRecordId}/unit-versions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "image/png",
				"X-Asset-Version-File-Name": "frame.png",
				"X-Asset-Version-Size": "1",
				"Idempotency-Key": "unit-version-unauthorized",
				"X-Source-Asset-Version-Id": "a17f5ff0-a50d-438f-8bf2-a0152b42c301",
				"X-Unit-Version-Type": "frame",
				"X-Unit-Version-Key": "attack/frame-3",
			},
			body: new Uint8Array([1]),
		}
	);

	expect(response.status).toBe(401);
	expect(calls.storage).toBe(0);
	expect(calls.candidateVersion).toBe(0);
});

test("rejects invalid Unit Version metadata before storing the uploaded object", async () => {
	const { app, calls, objects } = createRouteHarness();
	const response = await app.request(
		`/api/projects/${projectId}/asset-records/${assetRecordId}/unit-versions`,
		{
			method: "POST",
			headers: {
				"Content-Type": "image/png",
				"X-Asset-Version-File-Name": "frame.png",
				"X-Asset-Version-Size": "1",
				"Idempotency-Key": "unit-version-invalid-metadata",
				"X-Source-Asset-Version-Id": "a17f5ff0-a50d-438f-8bf2-a0152b42c301",
				"X-Unit-Version-Type": "animation",
				"X-Unit-Version-Key": "attack/frame-3",
			},
			body: new Uint8Array([1]),
		}
	);
	const error = await response.json();

	expect(response.status).toBe(400);
	expect(error).toMatchObject({ error: "Invalid Unit Version correction" });
	expect(calls.storage).toBe(0);
	expect(calls.candidateVersion).toBe(0);
	expect(objects.size).toBe(0);
});

test("rejects a declared upload length that is larger than the streamed content and removes the object", async () => {
	const { app, calls, objects } = createRouteHarness();

	const response = await upload(app, new Uint8Array([1]), 2);
	const error = await response.json();

	expect(response.status).toBe(400);
	expect(error).toMatchObject({
		error: "Invalid Asset Version content length",
	});
	expect(calls.put).toBe(1);
	expect(calls.delete).toBe(1);
	expect(calls.candidateVersion).toBe(0);
	expect(objects.size).toBe(0);
});

test("rejects streamed content that exceeds the declared length and removes the object", async () => {
	const { app, calls, objects } = createRouteHarness();

	const response = await upload(app, new Uint8Array([1, 2]), 1);
	const error = await response.json();

	expect(response.status).toBe(400);
	expect(error).toMatchObject({
		error: "Invalid Asset Version content length",
	});
	expect(calls.delete).toBe(1);
	expect(calls.candidateVersion).toBe(0);
	expect(objects.size).toBe(0);
});

test("rejects a PNG signature without a complete valid image", async () => {
	const { app, calls, objects } = createRouteHarness();

	const response = await upload(app, new Uint8Array([137, 80, 78, 71]), 4);
	const error = await response.json();

	expect(response.status).toBe(422);
	expect(error).toMatchObject({ error: "Invalid Asset Version image content" });
	expect(calls.candidateVersion).toBe(0);
	expect(calls.delete).toBe(1);
	expect(objects.size).toBe(0);
});

test("retains an uploaded object when candidate persistence has an uncertain outcome", async () => {
	const { app, calls, objects } = createRouteHarness(
		{ user: { id: userId } },
		new Error("database response was lost")
	);
	const png = await sharp({
		create: {
			width: 1,
			height: 1,
			channels: 4,
			background: { r: 255, g: 64, b: 128, alpha: 1 },
		},
	})
		.png()
		.toBuffer();

	const response = await upload(app, png, png.byteLength);

	expect(response.status).toBe(503);
	expect(calls.candidateVersion).toBe(1);
	expect(calls.delete).toBe(0);
	expect(objects.size).toBe(1);
});

test("stores and reads back selective Unit Versions without changing the source or unrelated units", async () => {
	const { app, dependencies, objects, savedAssetVersions, savedUnitVersions } =
		createRouteHarness();
	const sourceAssetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c301";
	const previousFrameAssetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c302";
	const [previousFrame, unrelatedDirection] = savedUnitVersions;
	const [sourceAssetVersion] = savedAssetVersions;
	const unitCases = [
		{
			unitType: "frame",
			unitKey: "attack/frame-3",
			sourceAssetVersionId: previousFrameAssetVersionId,
			unitVersionNumber: 2,
		},
		{
			unitType: "direction",
			unitKey: "west",
			sourceAssetVersionId,
			unitVersionNumber: 1,
		},
		{
			unitType: "tile",
			unitKey: "grass/inner-corner",
			sourceAssetVersionId,
			unitVersionNumber: 1,
		},
		{
			unitType: "state",
			unitKey: "damaged",
			sourceAssetVersionId,
			unitVersionNumber: 1,
		},
	] as const;

	const unitUploads = await Promise.all(
		unitCases.map(async (unit, index) => ({
			...unit,
			png: await sharp({
				create: {
					width: 1,
					height: 1,
					channels: 4,
					background: { r: index, g: 64, b: 128, alpha: 1 },
				},
			})
				.png()
				.toBuffer(),
		}))
	);
	await Promise.all(
		unitUploads.map(async (unit) => {
			const response = await app.request(
				`/api/projects/${projectId}/asset-records/${assetRecordId}/unit-versions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "image/png",
						"X-Asset-Version-File-Name": `${unit.unitType}.png`,
						"X-Asset-Version-Size": unit.png.byteLength.toString(),
						"Idempotency-Key": `unit-version-${unit.unitType}`,
						"X-Source-Asset-Version-Id": unit.sourceAssetVersionId,
						"X-Unit-Version-Type": unit.unitType,
						"X-Unit-Version-Key": unit.unitKey,
					},
					body: unit.png,
				}
			);

			expect(response.status).toBe(201);
			expect(await response.json()).toMatchObject({
				assetVersion: { reviewDisposition: "candidate" },
				unitVersion: {
					assetRecordId,
					sourceAssetVersionId: unit.sourceAssetVersionId,
					unitType: unit.unitType,
					unitKey: unit.unitKey,
					versionNumber: unit.unitVersionNumber,
				},
			});
		})
	);

	const catalog = await dependencies.assetVersionStore.list(userId, projectId);
	const unitVersions = Reflect.get(catalog ?? {}, "unitVersions");
	expect(unitVersions).toHaveLength(unitCases.length + 2);
	expect(unitVersions).toEqual(
		expect.arrayContaining([
			previousFrame,
			unrelatedDirection,
			...unitCases.map((unit) =>
				expect.objectContaining({
					sourceAssetVersionId: unit.sourceAssetVersionId,
					unitType: unit.unitType,
					unitKey: unit.unitKey,
					versionNumber: unit.unitVersionNumber,
				})
			),
		])
	);
	expect(savedAssetVersions).toContain(sourceAssetVersion);
	expect(savedAssetVersions).toContainEqual({
		id: previousFrameAssetVersionId,
		reviewDisposition: "approved",
	});
	expect(objects.size).toBe(unitCases.length);
	expect(savedAssetVersions).toHaveLength(unitCases.length + 3);
});
