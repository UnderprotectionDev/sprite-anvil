import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { createFamilyReadinessStore } from "@sprite-anvil/api/family-readiness-store";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import { createDb } from "@sprite-anvil/db";
import { createInteractiveDatabase } from "@sprite-anvil/db/interactive-database";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { colourMerges } from "@sprite-anvil/db/schema/context-rule-checks";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createTestAssetVersionStorage } from "./features/asset-versions/server/test-asset-version-storage";
import { createContextRuleCheckStore } from "./features/context-rule-checks/server/context-rule-check-store";
import { measureRaster } from "./features/context-rule-checks/server/pixel-measurement";
import {
	decodeRaster,
	encodePng,
} from "./features/context-rule-checks/server/raster-codec";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

function createTestDb(url: string): Database {
	return new URL(url).hostname === "127.0.0.1"
		? (createLocalTestDb({ DATABASE_URL: url }) as unknown as Database)
		: createDb({ DATABASE_URL: url });
}

const INK = [16, 16, 16, 255];
const RED = [192, 48, 32, 255];
const NEAR_RED = [194, 50, 34, 255];

/** A 6×6 sprite with a one pixel outline and `interior` inside it. */
function sprite(interior: number[][]) {
	const data = new Uint8Array(6 * 6 * 4);
	for (let index = 0; index < 36; index += 1) {
		const x = index % 6;
		const y = Math.floor(index / 6);
		const edge = x === 0 || y === 0 || x === 5 || y === 5;
		const inner = (y - 1) * 4 + (x - 1);
		data.set(edge ? INK : (interior[inner] ?? RED), index * 4);
	}
	return encodePng({ width: 6, height: 6, data });
}

test.skipIf(!databaseUrl)(
	"checks exact stored versions and creates one Candidate Version per confirmed Colour Merge",
	async () => {
		const url = databaseUrl ?? "";
		const db = createTestDb(url);
		const storage = createTestAssetVersionStorage();
		const projectContextStore = createProjectContextStore(
			db,
			createInteractiveDatabase({ DATABASE_URL: url })
		);
		const projectContextScopeStore = createProjectContextScopeStore(db);
		const assetVersionStore = createAssetVersionStore(db);
		const contextRuleCheckStore = createContextRuleCheckStore(db, {
			assetVersionStore,
			createStorage: () => storage,
			familyReadinessStore: createFamilyReadinessStore(db),
			projectContextScopeStore,
			projectContextStore,
		});
		const createContext = (sessionUserId: string) =>
			({
				assetFamilyStore: createAssetFamilyStore(db),
				assetRecordStore: createAssetRecordStore(db),
				assetVersionStore,
				contextRuleCheckStore,
				db,
				projectAccess: createProjectAccessStore(db, projectContextStore),
				projectContextScopeStore,
				projectContextStore,
				session: { user: { id: sessionUserId } } as Context["session"],
			}) as unknown as Context;
		const userId = crypto.randomUUID();
		const strangerId = crypto.randomUUID();
		await db.insert(user).values(
			[userId, strangerId].map((id) => ({
				id,
				name: "Context Rule Check Test",
				email: `rule-checks-${id}@example.test`,
			}))
		);
		const context = createContext(userId);
		const gameProject = await call(
			appRouter.projectContexts.create,
			{
				name: `Rule checks ${userId.slice(0, 8)}`,
				generalArtDirection: "",
			},
			{ context }
		);
		const visualWorld = await call(
			appRouter.contextScopes.createVisualWorld,
			{ projectId: gameProject.id, name: "Gameplay", description: "" },
			{ context }
		);
		const identity = await call(
			appRouter.assetFamilies.createSubjectIdentity,
			{ projectId: gameProject.id, name: "Ember" },
			{ context }
		);
		const family = await call(
			appRouter.assetFamilies.createAssetFamily,
			{
				projectId: gameProject.id,
				subjectIdentityId: identity.id,
				name: "Sprite",
				visualWorldId: visualWorld.id,
				useContext: "combat",
			},
			{ context }
		);

		async function addRecord(name: string, png: Uint8Array) {
			const record = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId: gameProject.id,
					assetFamilyId: family.id,
					name,
					identityCriteria: ["independent_product_meaning"],
				},
				{ context }
			);
			const versionId = crypto.randomUUID();
			const objectKey = `rule-checks/${versionId}.png`;
			await storage.put(
				objectKey,
				new Blob([new Uint8Array(png)]).stream(),
				"image/png",
				png.byteLength
			);
			await assetVersionStore.createCandidateVersion(userId, {
				id: versionId,
				projectId: gameProject.id,
				assetFamilyId: family.id,
				assetRecordId: record.id,
				objectKey,
				contentType: "image/png",
				contentLength: png.byteLength,
				contentDigest: createHash("sha256").update(png).digest("hex"),
				fileName: `${name}.png`,
				idempotencyKey: versionId,
				integrityVerified: true,
				sourceKind: "manual_import",
			});
			return { recordId: record.id, versionId, objectKey };
		}

		const passing = await addRecord("A passing", await sprite([]));
		const merging = await addRecord("B merging", await sprite([NEAR_RED]));
		const broken = await addRecord("C unreadable", await sprite([]));
		await storage.delete(broken.objectKey);

		// Rules become authoritative only through a user-activated proposal.
		const proposal = await call(
			appRouter.contextProposals.create,
			{
				projectId: gameProject.id,
				baseContextRevisionId: gameProject.currentContextRevision.id,
				summary: "Limit colours and outline",
				changes: [
					["palette.max_colors", 2],
					["outline.width", 1],
				].map(([ruleId, value]) => ({
					operation: "add" as const,
					ruleId: String(ruleId),
					scope: { kind: "project" as const, id: gameProject.id },
					value: { type: "number" as const, value: Number(value) },
					rationale: "Readable sprites",
					evidence: [
						{ kind: "user_decision" as const, statement: "Keep it tight" },
					],
				})),
			},
			{ context }
		);
		const review = await call(
			appRouter.contextProposals.review,
			{ projectId: gameProject.id, proposalId: proposal.id },
			{ context }
		);
		const revision = await call(
			appRouter.contextProposals.activate,
			{
				projectId: gameProject.id,
				proposalId: proposal.id,
				expectedCurrentRevisionId: review.currentRevisionId,
			},
			{ context }
		);

		await expect(
			call(
				appRouter.contextRuleChecks.overview,
				{ projectId: gameProject.id },
				{ context: createContext(strangerId) }
			)
		).rejects.toMatchObject({ code: "NOT_FOUND" });

		const overview = await call(
			appRouter.contextRuleChecks.overview,
			{ projectId: gameProject.id },
			{ context }
		);
		expect(overview.contextRevisionId).toBe(revision.id);
		expect(
			overview.items.map((item) => [item.name, item.status, item.results])
		).toEqual([
			[
				"A passing",
				"checked",
				[
					{ ruleId: "palette.max_colors", limit: 2, observed: 2, passes: true },
					{ ruleId: "outline.width", limit: 1, observed: 1, passes: true },
				],
			],
			[
				"B merging",
				"checked",
				[
					{
						ruleId: "palette.max_colors",
						limit: 2,
						observed: 3,
						passes: false,
					},
					{ ruleId: "outline.width", limit: 1, observed: 1, passes: true },
				],
			],
			["C unreadable", "unreadable", []],
		]);
		expect(overview.items[1]?.merge?.changesBoundary).toBe(false);

		const mergeInput = {
			projectId: gameProject.id,
			assetVersionId: merging.versionId,
			targets: {},
		};
		const preview = await call(
			appRouter.contextRuleChecks.previewMerge,
			mergeInput,
			{ context }
		);
		expect(preview.colourCount).toBe(2);
		const versionCount = async () =>
			(
				await db
					.select()
					.from(assetVersions)
					.where(eq(assetVersions.assetRecordId, merging.recordId))
			).length;
		expect(await versionCount()).toBe(1);

		await expect(
			call(
				appRouter.contextRuleChecks.applyMerge,
				{
					...mergeInput,
					expectedContextRevisionId: gameProject.currentContextRevision.id,
				},
				{ context }
			)
		).rejects.toMatchObject({ code: "CONFLICT" });
		await expect(
			call(
				appRouter.contextRuleChecks.applyMerge,
				{ ...mergeInput, expectedContextRevisionId: revision.id },
				{ context: createContext(strangerId) }
			)
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(await versionCount()).toBe(1);

		const apply = () =>
			call(
				appRouter.contextRuleChecks.applyMerge,
				{ ...mergeInput, expectedContextRevisionId: revision.id },
				{ context }
			);
		const first = await apply();
		const repeated = await apply();
		expect(first.created).toBe(true);
		expect(repeated).toEqual({ ...first, created: false });
		expect(await versionCount()).toBe(2);

		const [history] = await db
			.select()
			.from(colourMerges)
			.where(eq(colourMerges.assetVersionId, first.assetVersionId));
		expect(history).toMatchObject({
			sourceAssetVersionId: merging.versionId,
			contextRevisionId: revision.id,
			steps: preview.steps,
		});
		const read = async (versionId: string) => {
			const [row] = await db
				.select()
				.from(assetVersions)
				.where(eq(assetVersions.id, versionId));
			const object = await storage.get(row?.objectKey ?? "");
			return measureRaster(
				await decodeRaster(
					new Uint8Array(await new Response(object?.body).arrayBuffer())
				)
			);
		};
		expect((await read(first.assetVersionId)).colours).toHaveLength(2);
		expect((await read(merging.versionId)).colours).toHaveLength(3);

		const rechecked = await call(
			appRouter.contextRuleChecks.recheck,
			{ projectId: gameProject.id, assetRecordIds: [passing.recordId] },
			{ context }
		);
		// The unapproved merge is now the newest Candidate Version of its record.
		expect(rechecked.items[1]?.assetVersionId).toBe(first.assetVersionId);
	},
	60_000
);
