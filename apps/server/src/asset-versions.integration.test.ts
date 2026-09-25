import { expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { call } from "@orpc/server";
import { assetVersionSchema } from "@sprite-anvil/api/asset-versions";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb, getProjectForUser } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import { verifyAssetVersionStream } from "./features/asset-versions/server/asset-version-integrity";
import { mountAssetVersionRoutes } from "./features/asset-versions/server/asset-version-routes";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;
const sha256Pattern = /^[0-9a-f]{64}$/;

function pngChunk(type: string, data: Buffer) {
	const typeBytes = Buffer.from(type, "ascii");
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	let crc = 0xff_ff_ff_ff;
	for (const byte of Buffer.concat([typeBytes, data])) {
		// biome-ignore lint/suspicious/noBitwiseOperators: CRC32 uses unsigned 32-bit integer operations.
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			// biome-ignore lint/suspicious/noBitwiseOperators: CRC32 uses unsigned 32-bit integer operations.
			crc = (crc & 1) === 1 ? 0xed_b8_83_20 ^ (crc >>> 1) : crc >>> 1;
		}
	}
	const checksum = Buffer.alloc(4);
	// biome-ignore lint/suspicious/noBitwiseOperators: CRC32 uses unsigned 32-bit integer operations.
	checksum.writeUInt32BE((crc ^ 0xff_ff_ff_ff) >>> 0);
	return Buffer.concat([length, typeBytes, data, checksum]);
}

function makePng(note: string) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(1, 0);
	header.writeUInt32BE(1, 4);
	header[8] = 8;
	header[9] = 6;
	const metadata = Buffer.from(`Comment\0${note}`, "latin1");
	const imageData = deflateSync(Buffer.from([0, 20, 30, 40, 255]));
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		pngChunk("IHDR", header),
		pngChunk("tEXt", metadata),
		pngChunk("IDAT", imageData),
		pngChunk("IEND", Buffer.alloc(0)),
	]);
}

test.skipIf(!databaseUrl)(
	"persists uploaded Asset Versions, Review Events, Canonical Design, and exact derivative lineage",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		let insertedUser = false;
		const storedObjects = new Map<
			string,
			{ bytes: Uint8Array; contentType: "image/png" | "image/webp" }
		>();

		try {
			await db.insert(user).values({
				id: userId,
				name: "Asset Version Integration Test",
				email: `asset-versions-${userId}@example.test`,
			});
			insertedUser = true;

			const projectContextStore = createProjectContextStore(db);
			const verifyAssetVersionContent = async (
				requestedUserId: string,
				requestedProjectId: string,
				assetVersionId: string
			) => {
				const fileRecord = await createAssetVersionStore(db).getFileRecord(
					requestedUserId,
					requestedProjectId,
					assetVersionId
				);
				const storedObject = fileRecord
					? storedObjects.get(fileRecord.objectKey)
					: undefined;
				if (
					!(
						fileRecord &&
						storedObject &&
						fileRecord.integrityVerified &&
						fileRecord.contentDigest
					) ||
					storedObject.contentType !== fileRecord.contentType ||
					storedObject.bytes.byteLength !== fileRecord.contentLength
				) {
					return false;
				}
				const body = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(storedObject.bytes.slice());
						controller.close();
					},
				});
				const reader = verifyAssetVersionStream(
					body,
					fileRecord.contentType,
					fileRecord.contentLength,
					fileRecord.contentDigest
				).body.getReader();
				try {
					let result = await reader.read();
					while (!result.done) {
						// biome-ignore lint/performance/noAwaitInLoops: A stream reader must consume chunks sequentially.
						result = await reader.read();
					}
					return true;
				} catch {
					return false;
				} finally {
					reader.releaseLock();
				}
			};
			const context: Context = {
				assetFamilyStore: createAssetFamilyStore(db),
				assetVersionStore: createAssetVersionStore(db),
				assetRecordStore: createAssetRecordStore(db),
				assetRecordTrackingStore: createAssetRecordTrackingStore(db, null),
				verifyAssetVersionContent,
				db,
				projectAccess: createProjectAccessStore(db, projectContextStore),
				projectContextScopeStore: createProjectContextScopeStore(db),
				projectContextStore,
				session: { user: { id: userId } } as Context["session"],
			};
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Asset Version Lineage Integration",
					generalArtDirection: "Readable silhouettes with clean outlines",
				},
				{ context }
			);
			const visualWorld = await call(
				appRouter.contextScopes.createVisualWorld,
				{ projectId: project.id, name: "Gameplay", description: "In-game art" },
				{ context }
			);
			const identity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId: project.id, name: "Ash Knight" },
				{ context }
			);
			const family = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId: project.id,
					subjectIdentityId: identity.id,
					name: "Game Sprite",
					visualWorldId: visualWorld.id,
					useContext: "combat",
				},
				{ context }
			);
			const source = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId: project.id,
					assetFamilyId: family.id,
					name: "Base",
					identityCriteria: ["independent_product_meaning"],
				},
				{ context }
			);
			const target = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId: project.id,
					assetFamilyId: family.id,
					name: "East",
					identityCriteria: ["delivery_identity"],
				},
				{ context }
			);
			const storage = {
				async put(
					key: string,
					body: ReadableStream<Uint8Array>,
					contentType: "image/png" | "image/webp"
				) {
					const bytes = new Uint8Array(await new Response(body).arrayBuffer());
					storedObjects.set(key, { bytes, contentType });
				},
				get(key: string) {
					const object = storedObjects.get(key);
					return Promise.resolve(
						object
							? {
									body: new ReadableStream<Uint8Array>({
										start(controller) {
											controller.enqueue(object.bytes.slice());
											controller.close();
										},
									}),
									contentLength: object.bytes.byteLength,
									contentType: object.contentType,
								}
							: null
					);
				},
				delete(key: string) {
					return Promise.resolve().then(() => {
						storedObjects.delete(key);
					});
				},
			};
			const uploadApp = new Hono();
			mountAssetVersionRoutes(uploadApp, {
				assetVersionStore: createAssetVersionStore(db),
				createStorage: () => storage,
				getProjectForUser: (requestedUserId, projectId) =>
					getProjectForUser(db, requestedUserId, projectId),
				getSession: async () => ({ user: { id: userId } }),
			});

			const fileBytes = makePng("first");
			const idempotencyKey = crypto.randomUUID();
			const uploadResponse = await uploadApp.request(
				`/api/projects/${project.id}/asset-records/${source.id}/versions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "image/png",
						"X-Asset-Version-File-Name": "ash-knight-base.png",
						"X-Asset-Version-Size": fileBytes.byteLength.toString(),
						"Idempotency-Key": idempotencyKey,
					},
					body: fileBytes.slice(),
				}
			);
			expect(uploadResponse.status).toBe(201);
			const uploadedVersion = assetVersionSchema.parse(
				await uploadResponse.json()
			);
			expect(uploadedVersion).toMatchObject({
				assetRecordId: source.id,
				assetFamilyId: family.id,
				versionNumber: 1,
				reviewDisposition: "candidate",
				integrityVerified: true,
				contentDigest: expect.stringMatching(sha256Pattern),
			});

			const retryResponse = await uploadApp.request(
				`/api/projects/${project.id}/asset-records/${source.id}/versions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "image/png",
						"X-Asset-Version-File-Name": "ash-knight-base.png",
						"X-Asset-Version-Size": fileBytes.byteLength.toString(),
						"Idempotency-Key": idempotencyKey,
					},
					body: fileBytes.slice(),
				}
			);
			expect(retryResponse.status).toBe(200);
			expect(await retryResponse.json()).toMatchObject({
				id: uploadedVersion.id,
			});
			expect(storedObjects.size).toBe(1);

			const previewPath = `/api/projects/${project.id}/asset-versions/${uploadedVersion.id}/preview`;
			const previewResponse = await uploadApp.request(previewPath);
			expect(previewResponse.status).toBe(200);
			expect(Buffer.from(await previewResponse.arrayBuffer())).toEqual(
				fileBytes
			);
			const replacementBytes = makePng("other");
			expect(replacementBytes.byteLength).toBe(fileBytes.byteLength);
			const [objectKey] = [...storedObjects.keys()];
			if (!objectKey) {
				throw new Error("Expected the uploaded image in test storage.");
			}
			storedObjects.set(objectKey, {
				bytes: replacementBytes,
				contentType: "image/png",
			});
			const replacedPreviewResponse = await uploadApp.request(previewPath);
			await expect(replacedPreviewResponse.arrayBuffer()).rejects.toThrow();
			storedObjects.set(objectKey, {
				bytes: fileBytes,
				contentType: "image/png",
			});

			await expect(
				call(
					appRouter.assetVersions.selectCanonicalDesign,
					{
						projectId: project.id,
						assetFamilyId: family.id,
						assetVersionId: uploadedVersion.id,
					},
					{ context }
				)
			).rejects.toThrow();
			const reviewEvent = await call(
				appRouter.assetVersions.review,
				{
					projectId: project.id,
					assetVersionId: uploadedVersion.id,
					decision: "approved",
					rationale: "The silhouette matches the family design.",
				},
				{ context }
			);
			const canonicalDesign = await call(
				appRouter.assetVersions.selectCanonicalDesign,
				{
					projectId: project.id,
					assetFamilyId: family.id,
					assetVersionId: uploadedVersion.id,
				},
				{ context }
			);
			const relationship = await call(
				appRouter.assetFamilies.createRelationship,
				{
					projectId: project.id,
					assetFamilyId: family.id,
					sourceAssetRecordId: source.id,
					sourceAssetVersionId: uploadedVersion.id,
					targetAssetRecordId: target.id,
					type: "derivative",
				},
				{ context }
			);
			const rejectionEvent = await call(
				appRouter.assetVersions.review,
				{
					projectId: project.id,
					assetVersionId: uploadedVersion.id,
					decision: "rejected",
					rationale: "Reopened for a detail correction.",
				},
				{ context }
			);
			const candidateEvent = await call(
				appRouter.assetVersions.review,
				{
					projectId: project.id,
					assetVersionId: uploadedVersion.id,
					decision: "candidate",
					rationale: "Ready for a second review.",
				},
				{ context }
			);
			const reapprovalEvent = await call(
				appRouter.assetVersions.review,
				{
					projectId: project.id,
					assetVersionId: uploadedVersion.id,
					decision: "approved",
					rationale: "Correction accepted.",
				},
				{ context }
			);

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadProjectContextStore = createProjectContextStore(rereadDb);
			const rereadContext: Context = {
				assetFamilyStore: createAssetFamilyStore(rereadDb),
				assetVersionStore: createAssetVersionStore(rereadDb),
				assetRecordStore: createAssetRecordStore(rereadDb),
				assetRecordTrackingStore: createAssetRecordTrackingStore(
					rereadDb,
					null
				),
				verifyAssetVersionContent,
				db: rereadDb,
				projectAccess: createProjectAccessStore(
					rereadDb,
					rereadProjectContextStore
				),
				projectContextScopeStore: createProjectContextScopeStore(rereadDb),
				projectContextStore: rereadProjectContextStore,
				session: { user: { id: userId } } as Context["session"],
			};
			const [versions, families] = await Promise.all([
				call(
					appRouter.assetVersions.list,
					{ projectId: project.id },
					{ context: rereadContext }
				),
				call(
					appRouter.assetFamilies.list,
					{ projectId: project.id },
					{ context: rereadContext }
				),
			]);

			expect(versions.assetVersions).toContainEqual(
				expect.objectContaining({
					id: uploadedVersion.id,
					reviewDisposition: "approved",
					reviewEvents: [
						expect.objectContaining({ type: "candidate", rationale: null }),
						reviewEvent,
						rejectionEvent,
						candidateEvent,
						reapprovalEvent,
					],
				})
			);
			expect(versions.canonicalDesigns).toContainEqual(canonicalDesign);
			expect(families.relationships).toContainEqual(relationship);
			expect(relationship.sourceAssetVersionId).toBe(uploadedVersion.id);
		} finally {
			if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
