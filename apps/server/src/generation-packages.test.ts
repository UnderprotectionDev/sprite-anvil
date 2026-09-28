import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ContextRevision,
	ContextRule,
	ProjectContext,
} from "@sprite-anvil/api/project-context";
import { appRouter } from "@sprite-anvil/api/routers/index";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";
const assetRecordId = "b178f612-12ec-432a-b254-32a6fd781cc4";
const assetFamilyId = "cae44a22-bf95-4582-a7d1-52fa111fbfc0";
const visualWorldId = "e1711617-2ce8-4cd2-98e1-cfbc8e6b018a";
const themeId = "49d705e7-90c0-4f4e-9a82-36f457ffcf9a";
const canonicalVersionId = "7bb6f7dc-a09d-4f02-b324-e247081e3974";
const canonicalDesignId = "54a61d88-d9c1-4e81-94e7-3e959b464f18";
const unitVersionId = "4b909473-f0e1-4aac-a37a-60b22c8d1fa0";
const referenceId = "e23f4089-ce39-45d6-bbcc-760a6f5260c2";
const packageId = "2de54a7e-962c-48d3-b07a-bfbc16a2b724";
const timestamp = "2026-09-28T09:00:00.000Z";

const paletteRule: ContextRule = {
	contractVersion: "context-rule/1.0.0",
	createdAt: timestamp,
	id: "palette",
	precedenceChain: [{ id: projectId, kind: "project" }],
	rationale: "Keep the palette restrained.",
	scope: { id: projectId, kind: "project" },
	source: { kind: "project_setup" },
	value: { type: "text_list", value: ["charcoal", "warm gray"] },
};

const activeRevision: ContextRevision = {
	createdAt: timestamp,
	id: "6fdf9f81-8f20-45b5-bf4c-0d0b3b503f2b",
	isActive: true,
	projectId,
	revisionNumber: 3,
	ruleContractVersion: "context-rule/1.0.0",
	rules: [paletteRule],
	sourceProposalId: null,
};

const projectContext: ProjectContext = {
	createdAt: timestamp,
	currentContextRevision: activeRevision,
	generalArtDirection: "Readable silhouettes and clean outlines.",
	id: projectId,
	name: "Ash Knight",
};

const measurements = {
	atlasDimensions: { confirmed: null, proposal: null },
	cellDimensions: { confirmed: null, proposal: null },
	displayScale: { confirmed: null, proposal: null },
	logicalResolution: {
		confirmed: { height: 80, width: 72 },
		proposal: null,
	},
	sourceImageDimensions: {
		confirmed: { height: 160, width: 144 },
		proposal: null,
	},
	visibleContentBounds: { confirmed: null, proposal: null },
};

const record = {
	assetCategory: "character_creature_animation",
	availability: "active",
	createdAt: timestamp,
	id: assetRecordId,
	identityCriteria: ["independent_product_meaning"],
	measurements,
	name: "Ash Knight attack",
	projectId,
	supportLevel: "general",
	tags: [],
	themeId,
	visualWorldId,
};

const canonicalVersion = {
	assetFamilyId,
	assetRecordId,
	contentDigest: "a".repeat(64),
	contentLength: 1,
	contentType: "image/png",
	createdAt: timestamp,
	fileName: null,
	id: canonicalVersionId,
	integrityVerified: true,
	previewUrl: "/private/canonical-preview",
	projectId,
	reviewDisposition: "approved",
	reviewEvents: [],
	versionNumber: 4,
};

const lockedUnit = {
	assetRecordId,
	assetVersionId: canonicalVersionId,
	createdAt: timestamp,
	id: unitVersionId,
	projectId,
	sourceAssetVersionId: canonicalVersionId,
	unitKey: "idle-01",
	unitType: "frame",
	versionNumber: 2,
};

const referenceImage = {
	assetRecordId,
	contentLength: 1,
	contentType: "image/png",
	conflictFeatures: [],
	contextOverrideRationale: null,
	createdAt: timestamp,
	customPurpose: null,
	fileName: "pose-reference.png",
	forbiddenFeatures: ["identity"],
	history: [],
	id: referenceId,
	notes: "Use only the shoulder and sword movement.",
	revision: 1,
	role: "pose",
	sha256: "b".repeat(64),
	sortOrder: 0,
	transferredFeatures: ["pose"],
	updatedAt: timestamp,
};

function createTestContext() {
	const storedPackages: Record<string, unknown>[] = [];
	const state = {
		assetVersions: [canonicalVersion],
		canonicalDesigns: [
			{
				assetFamilyId,
				assetRecordId,
				assetVersionId: canonicalVersionId,
				createdAt: timestamp,
				id: canonicalDesignId,
				projectId,
			},
		],
		projectContext,
		referenceImages: [referenceImage],
		trackingReferences: [] as Record<string, unknown>[],
		unitVersions: [lockedUnit],
	};

	const context = {
		assetRecordStore: {
			get: async () => record,
		},
		assetRecordTrackingStore: {
			getTracking: async () => ({
				record,
				tracking: {
					family: {
						canonicalVersionId,
						id: assetFamilyId,
						name: "Ash Knight",
						useContext: "Combat sprite",
						visualWorldId,
						visualWorldName: "Ashen Kingdom",
					},
					references: state.trackingReferences,
				},
			}),
		},
		assetVersionStore: {
			list: async () => ({
				assetVersions: state.assetVersions,
				canonicalDesigns: state.canonicalDesigns,
				compositeVersions: [],
				unitVersions: state.unitVersions,
			}),
		},
		generationPackageStore: {
			create: (
				_requestedUserId: string,
				input: { projectId: string; assetRecordId: string; snapshot: object }
			) => {
				const value = {
					assetRecordId: input.assetRecordId,
					createdAt: timestamp,
					id: packageId,
					projectId: input.projectId,
					...input.snapshot,
				};
				storedPackages.push(structuredClone(value));
				return Promise.resolve(structuredClone(value));
			},
			list: () => Promise.resolve(structuredClone(storedPackages)),
		},
		projectContextScopeStore: {
			list: async () => ({
				themes: [
					{
						createdAt: timestamp,
						description: "Warm cinders and old stone.",
						id: themeId,
						name: "Ember",
						projectId,
						visualWorldId,
					},
				],
				visualWorlds: [
					{
						createdAt: timestamp,
						description: "A worn medieval kingdom.",
						id: visualWorldId,
						name: "Ashen Kingdom",
						projectId,
					},
				],
			}),
		},
		projectContextStore: {
			listProjects: async () => [state.projectContext],
		},
		referenceProductionStore: {
			listImages: async () => state.referenceImages,
		},
		session: { user: { id: userId } },
	} as unknown as Context;

	return { context, state, storedPackages };
}

function createInput() {
	return {
		assetRecordId,
		changeConstraints: ["Change the attack pose."],
		expectedOutputStructure: "A four-frame PNG sprite sheet.",
		lockedUnitVersionIds: [unitVersionId],
		projectId,
		targetDimensions: { height: 80, width: 72 },
		targetTask: "Create a four-frame attack animation.",
		avoidConstraints: ["Do not use a blue palette."],
		preserveConstraints: ["Keep the Ash Knight silhouette."],
	};
}

test("pins the current production inputs and rereads the immutable Generation Package", async () => {
	const { context, state } = createTestContext();
	const input = createInput();

	const created = await call(appRouter.generationPackages.create, input, {
		context,
	});

	expect(created.targetTask).toBe(input.targetTask);
	expect(created.targetDimensions).toEqual(input.targetDimensions);
	expect(created.productionContextSnapshot.contextRevisionId).toBe(
		activeRevision.id
	);
	expect(created.productionContextSnapshot.rules).toEqual([paletteRule]);
	expect(created.canonicalDesign?.assetVersionId).toBe(canonicalVersionId);
	expect(created.referenceRoles).toEqual([
		expect.objectContaining({
			forbiddenFeatures: ["identity"],
			role: "pose",
			transferredFeatures: ["pose"],
		}),
	]);
	expect(created.lockedUnits).toEqual([
		expect.objectContaining({ id: unitVersionId, unitKey: "idle-01" }),
	]);
	expect(created.expectedOutputStructure).toBe(input.expectedOutputStructure);

	state.projectContext = {
		...state.projectContext,
		currentContextRevision: {
			...activeRevision,
			id: "fe1cce28-f6a1-4c9d-9687-4a234cb0bd68",
			revisionNumber: activeRevision.revisionNumber + 1,
			rules: [],
		},
	};
	state.referenceImages = [];

	const reread = await call(
		appRouter.generationPackages.list,
		{ assetRecordId, projectId },
		{ context }
	);

	expect(reread).toEqual([created]);
	expect(reread[0]?.productionContextSnapshot.contextRevisionId).toBe(
		activeRevision.id
	);
	expect(reread[0]?.referenceRoles).toHaveLength(1);
});

test("requires an active Context Revision before creating a Generation Package", async () => {
	const { context, state, storedPackages } = createTestContext();
	state.projectContext = {
		...state.projectContext,
		currentContextRevision: { ...activeRevision, isActive: false },
	};

	await expect(
		call(appRouter.generationPackages.create, createInput(), { context })
	).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
	expect(storedPackages).toHaveLength(0);
});

test("rejects a locked Unit Version from a different Asset Record", async () => {
	const { context, storedPackages } = createTestContext();
	const input = createInput();
	input.lockedUnitVersionIds = [crypto.randomUUID()];

	await expect(
		call(appRouter.generationPackages.create, input, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(storedPackages).toHaveLength(0);
});

test("requires the selected Canonical Design version to be available", async () => {
	const { context, state, storedPackages } = createTestContext();
	state.assetVersions = [];

	await expect(
		call(appRouter.generationPackages.create, createInput(), { context })
	).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
	expect(storedPackages).toHaveLength(0);
});

test("blocks a Generation Package when one Reference Role forbids another's allowance", async () => {
	const { context, state, storedPackages } = createTestContext();
	const avoidReferenceId = "4bf099d8-0b98-4287-abd0-3e1bbf787e90";
	state.referenceImages.push({
		...referenceImage,
		forbiddenFeatures: ["pose"],
		id: avoidReferenceId,
		role: "avoid",
		transferredFeatures: [],
	});

	await expect(
		call(appRouter.generationPackages.create, createInput(), { context })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(storedPackages).toHaveLength(0);
});

test("creates a new immutable Generation Package after opposing rules are resolved", async () => {
	const { context, state, storedPackages } = createTestContext();
	const avoidReferenceId = "4bf099d8-0b98-4287-abd0-3e1bbf787e90";
	state.referenceImages.push({
		...referenceImage,
		forbiddenFeatures: ["pose"],
		id: avoidReferenceId,
		role: "avoid",
		transferredFeatures: [],
	});

	await expect(
		call(appRouter.generationPackages.create, createInput(), { context })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(storedPackages).toHaveLength(0);

	state.referenceImages[0] = {
		...referenceImage,
		transferredFeatures: [],
	};
	const created = await call(
		appRouter.generationPackages.create,
		createInput(),
		{ context }
	);
	expect(created.referenceRoles).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				forbiddenFeatures: ["identity"],
				id: referenceId,
				transferredFeatures: [],
			}),
			expect.objectContaining({
				forbiddenFeatures: ["pose"],
				id: avoidReferenceId,
				role: "avoid",
				transferredFeatures: [],
			}),
		])
	);
	expect(storedPackages).toHaveLength(1);

	const [, forbiddingReference] = state.referenceImages;
	if (!forbiddingReference) {
		throw new Error("Expected a forbidding reference");
	}
	forbiddingReference.forbiddenFeatures = [];
	const reread = await call(
		appRouter.generationPackages.list,
		{ assetRecordId, projectId },
		{ context }
	);
	expect(reread).toEqual([created]);
});

test("rejects unauthenticated Generation Package access before reading or writing", async () => {
	const { context, storedPackages } = createTestContext();
	const unauthenticatedContext = {
		...context,
		session: null,
	} as unknown as Context;

	await expect(
		call(appRouter.generationPackages.create, createInput(), {
			context: unauthenticatedContext,
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	expect(storedPackages).toHaveLength(0);
});
