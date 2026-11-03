import { expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { user } from "@sprite-anvil/db/schema/auth";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { productionExperiments } from "@sprite-anvil/db/schema/production-experiments";
import { eq, inArray } from "drizzle-orm";
import { createProductionExperimentStore } from "../production-experiment-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

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
	"persists, rereads, and concludes Production Experiments with a guarded write",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}

		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		const otherUserId = crypto.randomUUID();
		let insertedUsers = false;

		try {
			await db.insert(user).values(
				[userId, otherUserId].map((id) => ({
					id,
					name: "Production Experiment Integration Test",
					email: `production-experiments-${id}@example.test`,
				}))
			);
			insertedUsers = true;

			// The app-root composition owns every store this flow needs; it is
			// imported lazily because loading it reads the server environment.
			const services = await import("../../../../services");
			const context: Context = {
				assetFamilyStore: services.assetFamilyStore,
				assetRecordStore: services.assetRecordStore,
				assetRecordTrackingStore: services.assetRecordTrackingStore,
				assetVersionStore: services.assetVersionStore,
				collectionStore: services.collectionStore,
				db: services.db,
				projectAccess: services.projectAccess,
				projectContextScopeStore: services.projectContextScopeStore,
				projectContextStore: services.projectContextStore,
				session: { user: { id: userId } } as Context["session"],
			};
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Production Experiment Integration",
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
			const record = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId: project.id,
					assetFamilyId: family.id,
					name: "Attack",
					identityCriteria: ["independent_product_meaning"],
				},
				{ context }
			);
			const seedTrial = async (label: string) => {
				const generationPackageId = crypto.randomUUID();
				await db.insert(generationPackages).values({
					id: generationPackageId,
					projectId: project.id,
					assetRecordId: record.id,
					createdByUserId: userId,
					snapshot: {},
				});
				const version = await call(
					appRouter.assetRecords.createManualImportVersion,
					{
						assetRecordId: record.id,
						contentBase64: makePng(label).toString("base64"),
						contentType: "image/png",
						fileName: `attack-${label}.png`,
						generationInstruction: `Create attack pose ${label}.`,
						generationPackageId,
						id: crypto.randomUUID(),
						projectId: project.id,
						sourceSurface: "ChatGPT web",
					},
					{ context }
				);
				return { assetVersionId: version.id, generationPackageId, label };
			};
			const trials = [await seedTrial("A"), await seedTrial("B")];

			const store = createProductionExperimentStore(db);
			const created = await store.create(userId, {
				assetRecordId: record.id,
				projectId: project.id,
				title: "Attack pose wording",
				trials,
			});
			if (!created) {
				throw new Error("Expected the Production Experiment to be created.");
			}
			expect(created.conclusion).toBeNull();
			expect(created.trials.map((trial) => trial.label)).toEqual(["A", "B"]);
			expect(created.trials.map((trial) => trial.position)).toEqual([0, 1]);

			// Reread through a fresh store and connection.
			const rereadStore = createProductionExperimentStore(services.db);
			expect(await rereadStore.get(userId, project.id, created.id)).toEqual(
				created
			);
			expect(await rereadStore.list(userId, project.id, record.id)).toEqual([
				created,
			]);

			// Ownership: another user sees nothing and cannot conclude.
			expect(await store.get(otherUserId, project.id, created.id)).toBeNull();
			expect(await store.list(otherUserId, project.id, record.id)).toBeNull();
			expect(
				await store.conclude(otherUserId, {
					experimentId: created.id,
					note: null,
					outcome: "abandoned",
					projectId: project.id,
					selectedTrialId: null,
				})
			).toBeNull();

			// A selected trial outside the experiment never concludes it.
			expect(
				await store.conclude(userId, {
					experimentId: created.id,
					note: null,
					outcome: "selection_made",
					projectId: project.id,
					selectedTrialId: crypto.randomUUID(),
				})
			).toEqual({ kind: "trial-not-found" });
			expect(
				(await store.get(userId, project.id, created.id))?.conclusion
			).toBeNull();

			const selectedTrialId = created.trials[1]?.id ?? null;
			const concluded = await store.conclude(userId, {
				experimentId: created.id,
				note: "Wording B reads better.",
				outcome: "selection_made",
				projectId: project.id,
				selectedTrialId,
			});
			expect(concluded).toMatchObject({
				experiment: {
					conclusion: {
						note: "Wording B reads better.",
						outcome: "selection_made",
						selectedTrialId,
					},
				},
				kind: "concluded",
			});

			// The first conclusion is final.
			expect(
				await store.conclude(userId, {
					experimentId: created.id,
					note: null,
					outcome: "abandoned",
					projectId: project.id,
					selectedTrialId: null,
				})
			).toEqual({ kind: "already-concluded" });
		} finally {
			if (insertedUsers) {
				await db
					.delete(productionExperiments)
					.where(eq(productionExperiments.createdByUserId, userId));
				await db.delete(user).where(inArray(user.id, [userId, otherUserId]));
			}
		}
	}
);
