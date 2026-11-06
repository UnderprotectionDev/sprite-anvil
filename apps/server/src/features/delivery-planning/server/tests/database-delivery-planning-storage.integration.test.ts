import { expect, test } from "bun:test";
import type { DeliveryTargetDraftSaveInput } from "@sprite-anvil/api/delivery-planning-inputs";
import { createDb } from "@sprite-anvil/db";
import { assetFamilies } from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { familyRequiredSetRevisions } from "@sprite-anvil/db/schema/family-readiness";
import { project } from "@sprite-anvil/db/schema/project";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { eq, inArray } from "drizzle-orm";
import { createDatabaseDeliveryPlanningStorage } from "../database-delivery-planning-storage";
import { createDeliveryTargetStore } from "../delivery-target-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

// Neon HTTP cannot address a loopback PostgreSQL, so test runs against a
// disposable local database use the repository's TCP test adapter instead.
function createTestDb(targetUrl: string) {
	const target = new URL(targetUrl);
	return target.hostname === "127.0.0.1"
		? createLocalTestDb({ DATABASE_URL: targetUrl })
		: createDb({ DATABASE_URL: targetUrl });
}

type TestDatabase = ReturnType<typeof createDb>;

interface SeededProject {
	contextRevisionId: string;
	families: { assetFamilyId: string; requiredSetRevisionId: string }[];
	projectId: string;
}

const seededProjectIds: string[] = [];

/** Inserts a project with a Context Revision and two Asset Families that each pin a Required Items List revision; the planning tables only reference these rows. */
async function seedProject(
	db: TestDatabase,
	userId: string,
	name: string
): Promise<SeededProject> {
	const projectId = crypto.randomUUID();
	const contextRevisionId = crypto.randomUUID();
	const visualWorldId = crypto.randomUUID();
	await db.insert(project).values({ id: projectId, name, ownerUserId: userId });
	seededProjectIds.push(projectId);
	await db.insert(contextRevisions).values({
		contractVersion: "test",
		createdByUserId: userId,
		id: contextRevisionId,
		projectId,
		revisionNumber: 1,
		rules: [],
		state: "baseline",
	});
	await db.insert(visualWorlds).values({
		createdByUserId: userId,
		id: visualWorldId,
		name: "Gameplay",
		projectId,
	});
	const families = ["Knight Sprite", "Slime Sprite"].map((familyName) => ({
		assetFamilyId: crypto.randomUUID(),
		name: familyName,
		requiredSetRevisionId: crypto.randomUUID(),
	}));
	await db.insert(assetFamilies).values(
		families.map((family) => ({
			createdByUserId: userId,
			id: family.assetFamilyId,
			name: family.name,
			projectId,
			useContext: "combat",
			visualWorldId,
		}))
	);
	await db.insert(familyRequiredSetRevisions).values(
		families.map((family) => ({
			assetFamilyId: family.assetFamilyId,
			createdByUserId: userId,
			id: family.requiredSetRevisionId,
			items: [
				{
					assetRecordIds: [crypto.randomUUID()],
					disposition: "required",
					id: "east-facing",
					kind: "direction",
					name: "East facing",
				},
			],
			projectId,
			revisionNumber: 1,
		}))
	);
	return {
		contextRevisionId,
		families: families.map(({ assetFamilyId, requiredSetRevisionId }) => ({
			assetFamilyId,
			requiredSetRevisionId,
		})),
		projectId,
	};
}

function draftInput(
	seeded: SeededProject,
	overrides: Partial<DeliveryTargetDraftSaveInput> = {}
): DeliveryTargetDraftSaveInput {
	return {
		contextRevisionId: seeded.contextRevisionId,
		deliveryTargetId: crypto.randomUUID(),
		families: seeded.families,
		id: crypto.randomUUID(),
		name: "Demo build",
		productionEvidencePolicy: {
			defaultRequirement: "legacy_asset_attestation_acceptable",
			familyRequirements: [
				{
					assetFamilyId: seeded.families[0]?.assetFamilyId ?? "",
					requirement: "full_generation_package_history",
				},
			],
		},
		projectId: seeded.projectId,
		purpose: "demo",
		rightsEvidencePolicy: {
			acceptableStates: ["documented", "assertion_only"],
			requireRecordFor: ["references", "results"],
		},
		...overrides,
	};
}

/** Runs `body` with a test user, then removes everything it seeded: Required Items List revisions (cascading to the planning rows), Asset Families, then the user and its projects. */
async function withTestUser(
	body: (setup: { db: TestDatabase; userId: string }) => Promise<void>
) {
	if (!databaseUrl) {
		throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
	}
	const db = createTestDb(databaseUrl);
	const userId = crypto.randomUUID();
	let insertedUser = false;
	seededProjectIds.length = 0;
	try {
		await db.insert(user).values({
			id: userId,
			name: "Delivery Planning Integration Test",
			email: `delivery-planning-${userId}@example.test`,
		});
		insertedUser = true;
		await body({ db, userId });
	} finally {
		if (seededProjectIds.length > 0) {
			await db
				.delete(familyRequiredSetRevisions)
				.where(inArray(familyRequiredSetRevisions.projectId, seededProjectIds));
			await db
				.delete(assetFamilies)
				.where(inArray(assetFamilies.projectId, seededProjectIds));
		}
		if (insertedUser) {
			await db.delete(user).where(eq(user.id, userId));
		}
	}
}

function storeFor(db: TestDatabase) {
	return createDeliveryTargetStore(
		db,
		createDatabaseDeliveryPlanningStorage(db)
	);
}

test.skipIf(!databaseUrl)(
	"persists a saved and activated Delivery Target through a fresh connection",
	async () => {
		await withTestUser(async ({ db, userId }) => {
			const seeded = await seedProject(db, userId, "Delivery Planning Reread");
			const input = draftInput(seeded);
			const revisionId = crypto.randomUUID();

			const saved = await storeFor(db).saveDraft(userId, input);
			expect(saved?.status).toBe("saved");
			const activated = await storeFor(db).activate(userId, {
				draftId: input.id,
				id: revisionId,
				projectId: seeded.projectId,
			});
			expect(activated).toMatchObject({
				revision: { id: revisionId, revisionNumber: 1, scopeDiff: null },
				status: "activated",
			});

			const rereadDb = createTestDb(databaseUrl ?? "");
			const catalog = await storeFor(rereadDb).list(userId, seeded.projectId);
			const [target] = catalog?.deliveryTargets ?? [];
			expect(target).toMatchObject({
				id: input.deliveryTargetId,
				name: input.name,
				purpose: input.purpose,
			});
			expect(target?.drafts).toHaveLength(1);
			expect(target?.drafts[0]).toMatchObject({
				activatedRevisionId: revisionId,
				contextRevisionId: seeded.contextRevisionId,
				id: input.id,
				productionEvidencePolicy: input.productionEvidencePolicy,
				rightsEvidencePolicy: input.rightsEvidencePolicy,
			});
			expect(
				target?.drafts[0]?.families.map((family) => family.assetFamilyId)
			).toEqual(seeded.families.map((family) => family.assetFamilyId));
			expect(target?.activeRevision?.id).toBe(revisionId);
			expect(target?.revisions).toHaveLength(1);
		});
	}
);

test.skipIf(!databaseUrl)(
	"numbers a target's revisions as the previous maximum plus one",
	async () => {
		await withTestUser(async ({ db, userId }) => {
			const seeded = await seedProject(db, userId, "Delivery Planning Numbers");
			const deliveryTargetId = crypto.randomUUID();
			const activateNext = async () => {
				const input = draftInput(seeded, { deliveryTargetId });
				await storeFor(db).saveDraft(userId, input);
				const result = await storeFor(db).activate(userId, {
					draftId: input.id,
					id: crypto.randomUUID(),
					projectId: seeded.projectId,
				});
				if (result?.status !== "activated") {
					throw new Error("The draft was not activated.");
				}
				return result.revision.revisionNumber;
			};
			// Sequential on purpose: each activation must see the previous revision number.
			const first = await activateNext();
			const second = await activateNext();
			const third = await activateNext();
			const numbers = [first, second, third];

			expect(numbers).toEqual([1, 2, 3]);
			const catalog = await storeFor(db).list(userId, seeded.projectId);
			expect(catalog?.deliveryTargets[0]?.activeRevision?.revisionNumber).toBe(
				3
			);
		});
	}
);

test.skipIf(!databaseUrl)(
	"retries a contested revision number so concurrent activations both succeed",
	async () => {
		await withTestUser(async ({ db, userId }) => {
			const seeded = await seedProject(db, userId, "Delivery Planning Race");
			const deliveryTargetId = crypto.randomUUID();
			const first = draftInput(seeded, { deliveryTargetId });
			const second = draftInput(seeded, { deliveryTargetId });
			await storeFor(db).saveDraft(userId, first);
			await storeFor(db).saveDraft(userId, second);

			const results = await Promise.all(
				[first, second].map((draft) =>
					storeFor(createTestDb(databaseUrl ?? "")).activate(userId, {
						draftId: draft.id,
						id: crypto.randomUUID(),
						projectId: seeded.projectId,
					})
				)
			);

			const numbers = results.map((result) =>
				result?.status === "activated" ? result.revision.revisionNumber : null
			);
			expect(numbers.sort()).toEqual([1, 2]);
		});
	}
);

test.skipIf(!databaseUrl)(
	"scopes targets to the project and the signed-in owner",
	async () => {
		await withTestUser(async ({ db, userId }) => {
			const seeded = await seedProject(db, userId, "Delivery Planning Scope A");
			const other = await seedProject(db, userId, "Delivery Planning Scope B");
			const input = draftInput(seeded);
			await storeFor(db).saveDraft(userId, input);

			const otherCatalog = await storeFor(db).list(userId, other.projectId);
			expect(otherCatalog?.deliveryTargets).toEqual([]);
			expect(
				await storeFor(db).activate(userId, {
					draftId: input.id,
					id: crypto.randomUUID(),
					projectId: other.projectId,
				})
			).toBeNull();
			expect(
				await storeFor(db).list(crypto.randomUUID(), seeded.projectId)
			).toBeNull();
		});
	}
);

test.skipIf(!databaseUrl)(
	"rejects a Delivery Target id that another project already uses",
	async () => {
		await withTestUser(async ({ db, userId }) => {
			const seeded = await seedProject(db, userId, "Delivery Planning Owner");
			const other = await seedProject(db, userId, "Delivery Planning Other");
			const deliveryTargetId = crypto.randomUUID();
			await storeFor(db).saveDraft(
				userId,
				draftInput(seeded, { deliveryTargetId })
			);

			const rejected = await storeFor(db).saveDraft(
				userId,
				draftInput(other, { deliveryTargetId })
			);

			expect(rejected).toEqual({
				reason: "delivery_target_unavailable",
				status: "rejected",
			});
			const catalog = await storeFor(db).list(userId, other.projectId);
			expect(catalog?.deliveryTargets).toEqual([]);
		});
	}
);

test.skipIf(!databaseUrl)(
	"returns the stored draft for an identical re-save and conflicts on different content",
	async () => {
		await withTestUser(async ({ db, userId }) => {
			const seeded = await seedProject(db, userId, "Delivery Planning Resave");
			const input = draftInput(seeded);
			const first = await storeFor(db).saveDraft(userId, input);

			const same = await storeFor(db).saveDraft(userId, input);
			const different = await storeFor(db).saveDraft(userId, {
				...input,
				name: "Renamed build",
			});

			expect(same).toEqual(first);
			expect(different).toEqual({
				reason: "draft_id_conflict",
				status: "rejected",
			});
			const catalog = await storeFor(db).list(userId, seeded.projectId);
			expect(catalog?.deliveryTargets[0]?.drafts).toHaveLength(1);
			expect(catalog?.deliveryTargets[0]?.name).toBe(input.name);
		});
	}
);
