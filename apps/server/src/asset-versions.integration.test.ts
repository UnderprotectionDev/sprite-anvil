import { expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { call } from "@orpc/server";
import {
	type UnitVersionType,
	unitVersionCorrectionUploadResponseSchema,
} from "@sprite-anvil/api/asset-versions";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb, getProjectForUser } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import { verifyAssetVersionStream } from "./features/asset-versions/server/asset-version-integrity";
import { mountAssetVersionRoutes } from "./features/asset-versions/server/asset-version-routes";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createCollectionStore } from "./features/collections/server/collection-store";
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
	"persists Asset Versions, selective Unit Version corrections, reviews, and exact derivative lineage",
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
				assetRecordTrackingStore: createAssetRecordTrackingStore(db, storage),
				collectionStore: createCollectionStore(db),
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
			const uploadApp = new Hono();
			mountAssetVersionRoutes(uploadApp, {
				assetVersionStore: createAssetVersionStore(db),
				createStorage: () => storage,
				getProjectForUser: (requestedUserId, projectId) =>
					getProjectForUser(db, requestedUserId, projectId),
				getSession: async () => ({ user: { id: userId } }),
			});

			const fileBytes = makePng("first");
			const legacyVersionInput = {
				assetRecordId: source.id,
				contentBase64: fileBytes.toString("base64"),
				contentType: "image/png" as const,
				fileName: "ash-knight-base.png",
				id: crypto.randomUUID(),
				projectId: project.id,
				knownSource: "Imported from the project's source files",
				supportingEvidence: null,
				unknownHistoryDetails: "The original generation history is unknown.",
				userRelationship: "received_from_team" as const,
				historyUnknown: true as const,
			};
			const createdVersion = await call(
				appRouter.assetRecords.createVersion,
				legacyVersionInput,
				{ context }
			);
			const versionCatalog = await call(
				appRouter.assetVersions.list,
				{ projectId: project.id },
				{ context }
			);
			const uploadedVersion = versionCatalog.assetVersions.find(
				(version) => version.id === createdVersion.id
			);
			if (!uploadedVersion) {
				throw new Error("Expected the imported Asset Version in the catalog.");
			}
			expect(uploadedVersion).toMatchObject({
				assetRecordId: source.id,
				assetFamilyId: family.id,
				versionNumber: 1,
				reviewDisposition: "candidate",
				integrityVerified: true,
				contentDigest: expect.stringMatching(sha256Pattern),
				sourceKind: "legacy_asset",
			});

			const retryVersion = await call(
				appRouter.assetRecords.createVersion,
				legacyVersionInput,
				{ context }
			);
			expect(retryVersion.id).toBe(uploadedVersion.id);
			expect(storedObjects.size).toBe(1);

			const uploadUnitCorrection = async ({
				sourceAssetVersionId,
				unitType,
				unitKey,
				fileName,
			}: {
				sourceAssetVersionId: string;
				unitType: UnitVersionType;
				unitKey: string;
				fileName: string;
			}) => {
				const correctionBytes = makePng(fileName);
				const correctionResponse = await uploadApp.request(
					`/api/projects/${project.id}/asset-records/${source.id}/unit-versions`,
					{
						method: "POST",
						headers: {
							"Content-Type": "image/png",
							"X-Asset-Version-File-Name": fileName,
							"X-Asset-Version-Size": correctionBytes.byteLength.toString(),
							"Idempotency-Key": crypto.randomUUID(),
							"X-Source-Asset-Version-Id": sourceAssetVersionId,
							"X-Unit-Version-Type": unitType,
							"X-Unit-Version-Key": unitKey,
						},
						body: correctionBytes,
					}
				);
				expect(correctionResponse.status).toBe(201);
				return unitVersionCorrectionUploadResponseSchema.parse(
					await correctionResponse.json()
				);
			};
			const firstFrameCorrection = await uploadUnitCorrection({
				sourceAssetVersionId: uploadedVersion.id,
				unitType: "frame",
				unitKey: "attack/frame-3",
				fileName: "attack-frame-3.png",
			});
			const unrelatedDirection = await uploadUnitCorrection({
				sourceAssetVersionId: uploadedVersion.id,
				unitType: "direction",
				unitKey: "east",
				fileName: "east-direction.png",
			});
			const secondFrameCorrection = await uploadUnitCorrection({
				sourceAssetVersionId: firstFrameCorrection.unitVersion.assetVersionId,
				unitType: "frame",
				unitKey: "attack/frame-3",
				fileName: "attack-frame-3-revision-2.png",
			});
			expect(firstFrameCorrection.unitVersion.versionNumber).toBe(1);
			expect(firstFrameCorrection.assetVersion.reviewDisposition).toBe(
				"candidate"
			);
			expect(unrelatedDirection.unitVersion.versionNumber).toBe(1);
			expect(unrelatedDirection.assetVersion.reviewDisposition).toBe(
				"candidate"
			);
			expect(secondFrameCorrection.unitVersion).toMatchObject({
				sourceAssetVersionId: firstFrameCorrection.unitVersion.assetVersionId,
				unitType: "frame",
				unitKey: "attack/frame-3",
				versionNumber: 2,
			});
			expect(secondFrameCorrection.assetVersion.id).not.toBe(
				firstFrameCorrection.assetVersion.id
			);
			expect(secondFrameCorrection.assetVersion.reviewDisposition).toBe(
				"candidate"
			);
			await expect(
				call(
					appRouter.assetVersions.createCompositeVersion,
					{
						projectId: project.id,
						assetRecordId: source.id,
						unitVersionIds: [
							firstFrameCorrection.unitVersion.id,
							secondFrameCorrection.unitVersion.id,
						],
						idempotencyKey: crypto.randomUUID(),
					},
					{ context }
				)
			).rejects.toThrow();

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
			const incompleteCatalog = await createAssetVersionStore(db).list(
				userId,
				project.id
			);
			expect(
				incompleteCatalog?.assetVersions.find(
					(version) => version.id === uploadedVersion.id
				)?.productionEvidence
			).toMatchObject({
				evidenceLevel: "incomplete",
				sourceKind: "manual_import",
			});
			await expect(
				call(
					appRouter.assetVersions.review,
					{
						projectId: project.id,
						assetVersionId: uploadedVersion.id,
						decision: "approved",
						rationale: "The silhouette matches the family design.",
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.assetRecords.recordReview,
					{
						assetRecordId: source.id,
						decision: "approved",
						id: crypto.randomUUID(),
						projectId: project.id,
						rationale: "The silhouette matches the family design.",
						versionId: uploadedVersion.id,
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
			const generationPackageId = crypto.randomUUID();
			await db.insert(generationPackages).values({
				id: generationPackageId,
				projectId: project.id,
				assetRecordId: source.id,
				createdByUserId: userId,
				snapshot: {},
			});
			const importEvidence = await call(
				appRouter.assetVersions.saveManualImportEvidence,
				{
					actualInstruction: "Create a readable ash knight idle sprite.",
					assetRecordId: source.id,
					generationPackageId,
					projectId: project.id,
					sourceSurface: "ChatGPT web",
					versionId: uploadedVersion.id,
				},
				{ context }
			);
			expect(importEvidence.revision).toBe(1);
			const completeCatalog = await createAssetVersionStore(db).list(
				userId,
				project.id
			);
			expect(
				completeCatalog?.assetVersions.find(
					(version) => version.id === uploadedVersion.id
				)?.productionEvidence
			).toMatchObject({
				evidenceLevel: "complete",
				sourceKind: "manual_import",
				manualImportEvidence: { generationPackageId, revision: 1 },
			});
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
			await expect(
				call(
					appRouter.assetVersions.review,
					{
						projectId: project.id,
						assetVersionId: secondFrameCorrection.assetVersion.id,
						decision: "approved",
						rationale: "The corrected frame is ready for composition.",
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.assetRecords.recordReview,
					{
						assetRecordId: source.id,
						decision: "approved",
						id: crypto.randomUUID(),
						projectId: project.id,
						rationale: "The corrected frame is ready for composition.",
						versionId: secondFrameCorrection.assetVersion.id,
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
			const correctionEvidence = await call(
				appRouter.assetVersions.saveManualImportEvidence,
				{
					actualInstruction:
						"Refine the attack frame outline and preserve the silhouette.",
					assetRecordId: source.id,
					generationPackageId,
					projectId: project.id,
					sourceSurface: "Aseprite 1.3.15",
					versionId: secondFrameCorrection.assetVersion.id,
				},
				{ context }
			);
			expect(correctionEvidence.revision).toBe(1);
			await call(
				appRouter.assetVersions.review,
				{
					projectId: project.id,
					assetVersionId: secondFrameCorrection.assetVersion.id,
					decision: "approved",
					rationale: "The corrected frame is ready for composition.",
				},
				{ context }
			);
			const firstCompositeVersionKey = crypto.randomUUID();
			const firstCompositeVersionInput = {
				projectId: project.id,
				assetRecordId: source.id,
				unitVersionIds: [
					firstFrameCorrection.unitVersion.id,
					unrelatedDirection.unitVersion.id,
				],
				idempotencyKey: firstCompositeVersionKey,
			};
			const firstCompositeVersion = await call(
				appRouter.assetVersions.createCompositeVersion,
				firstCompositeVersionInput,
				{ context }
			);
			expect(
				await call(
					appRouter.assetVersions.createCompositeVersion,
					firstCompositeVersionInput,
					{ context }
				)
			).toEqual(firstCompositeVersion);
			await expect(
				call(
					appRouter.assetVersions.createCompositeVersion,
					{
						...firstCompositeVersionInput,
						unitVersionIds: [
							secondFrameCorrection.unitVersion.id,
							unrelatedDirection.unitVersion.id,
						],
					},
					{ context }
				)
			).rejects.toThrow();
			await call(
				appRouter.assetVersions.reviewCompositeVersion,
				{
					projectId: project.id,
					compositeVersionId: firstCompositeVersion.id,
					decision: "approved",
					rationale: "The earlier frame and direction work together.",
				},
				{ context }
			);
			const secondCompositeVersion = await call(
				appRouter.assetVersions.createCompositeVersion,
				{
					projectId: project.id,
					assetRecordId: source.id,
					unitVersionIds: [
						secondFrameCorrection.unitVersion.id,
						unrelatedDirection.unitVersion.id,
					],
					idempotencyKey: crypto.randomUUID(),
				},
				{ context }
			);
			expect(secondCompositeVersion).toMatchObject({
				versionNumber: firstCompositeVersion.versionNumber + 1,
				reviewDisposition: "candidate",
			});

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
				collectionStore: createCollectionStore(rereadDb),
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
					versionNumber: uploadedVersion.versionNumber,
					contentDigest: uploadedVersion.contentDigest,
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
			expect(versions.unitVersions).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						id: firstFrameCorrection.unitVersion.id,
						assetVersionId: firstFrameCorrection.unitVersion.assetVersionId,
						sourceAssetVersionId: uploadedVersion.id,
						unitType: "frame",
						unitKey: "attack/frame-3",
						versionNumber: 1,
					}),
					expect.objectContaining({
						id: secondFrameCorrection.unitVersion.id,
						assetVersionId: secondFrameCorrection.unitVersion.assetVersionId,
						sourceAssetVersionId:
							firstFrameCorrection.unitVersion.assetVersionId,
						unitType: "frame",
						unitKey: "attack/frame-3",
						versionNumber: 2,
					}),
					expect.objectContaining({
						id: unrelatedDirection.unitVersion.id,
						assetVersionId: unrelatedDirection.unitVersion.assetVersionId,
						sourceAssetVersionId: uploadedVersion.id,
						unitType: "direction",
						unitKey: "east",
						versionNumber: 1,
					}),
				])
			);
			expect(versions.compositeVersions).toContainEqual(
				expect.objectContaining({
					id: firstCompositeVersion.id,
					reviewDisposition: "approved",
					compositionMemberships: expect.arrayContaining([
						expect.objectContaining({
							unitVersionId: firstFrameCorrection.unitVersion.id,
							unitType: "frame",
						}),
						expect.objectContaining({
							unitVersionId: unrelatedDirection.unitVersion.id,
							unitType: "direction",
						}),
					]),
				})
			);
			expect(versions.compositeVersions).toContainEqual(
				expect.objectContaining({
					id: secondCompositeVersion.id,
					reviewDisposition: "candidate",
					reviewEvents: [
						expect.objectContaining({ type: "candidate", rationale: null }),
					],
					compositionMemberships: expect.arrayContaining([
						expect.objectContaining({
							unitVersionId: secondFrameCorrection.unitVersion.id,
							unitType: "frame",
						}),
						expect.objectContaining({
							unitVersionId: unrelatedDirection.unitVersion.id,
							unitType: "direction",
						}),
					]),
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
