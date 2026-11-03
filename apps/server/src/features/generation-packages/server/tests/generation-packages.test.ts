import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import {
	type GenerationPackageCorrectionInput,
	generationPackageCorrectionInputSchema,
} from "@sprite-anvil/api/generation-packages";
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
		/** The Working Draft the correction coordinates were taken on (72x80 at revision 3). */
		draftSpace: {
			assetRecordId,
			draftId: pixelDraftId,
			draftRevision: 3,
			height: 80,
			sourceAssetVersionId: canonicalVersionId,
			width: 72,
		} as {
			assetRecordId: string;
			draftId: string;
			draftRevision: number;
			height: number;
			sourceAssetVersionId: string;
			width: number;
		} | null,
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
		readPixelDraftCoordinateSpace: async (
			_requestedUserId: string,
			_requestedProjectId: string,
			requestedDraftId: string
		) =>
			state.draftSpace?.draftId === requestedDraftId ? state.draftSpace : null,
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

test("snapshots the source Asset Record ID for version references", async () => {
	const { context, state } = createTestContext();
	const sourceAssetRecordId = "b699155a-8616-4ef6-a5c9-4f48d2d9160f";
	const sourceAssetVersionId = "d9a83d1a-b6ca-4fa7-9ae5-b70bf57b6d0a";
	const sourceReferenceId = "a05446af-8757-4ce8-aae6-49c95c19f108";
	state.trackingReferences.push({
		assetRecordId: sourceAssetRecordId,
		assetRecordName: "Iron Sentinel",
		contextOverrideRationale: null,
		customPurpose: null,
		forbiddenFeatures: [],
		id: sourceReferenceId,
		notes: "Use the shoulder pose only.",
		role: "pose",
		transferredFeatures: ["pose"],
		versionId: sourceAssetVersionId,
		versionNumber: 2,
	});

	const created = await call(
		appRouter.generationPackages.create,
		createInput(),
		{ context }
	);

	expect(created.referenceRoles).toContainEqual(
		expect.objectContaining({
			assetRecordId: sourceAssetRecordId,
			assetRecordName: "Iron Sentinel",
			assetVersionId: sourceAssetVersionId,
			id: sourceReferenceId,
			kind: "asset_version",
		})
	);
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

const pixelDraftId = "5d7b8f1e-2a64-4f0f-8d1d-3b6f6c0b9a21";
const targetUnitVersionId = "0a6f3a1e-5c0a-4f0e-9f51-3d1c0f4b6a11";
const targetUnit = {
	...lockedUnit,
	id: targetUnitVersionId,
	unitKey: "attack-02",
	versionNumber: 1,
};

function createCorrectionInput() {
	return {
		...createInput(),
		correction: {
			annotations: [
				{ from: { x: 2, y: 3 }, kind: "arrow", to: { x: 10, y: 12 } },
				{ from: { x: 0, y: 0 }, kind: "line", to: { x: 5, y: 5 } },
				{
					kind: "region",
					rect: { height: 6, width: 8, x: 4, y: 4 },
				},
				{ at: { x: 1, y: 1 }, kind: "note", text: "Sword tip is clipped" },
				{ at: { x: 36, y: 79 }, kind: "pivot" },
				{ kind: "ground-line", y: 79 },
			] as GenerationPackageCorrectionInput["annotations"],
			draft: { id: pixelDraftId, revision: 3 },
			issueNote: "The sword tip is clipped on the attack frame.",
			redrawRegion: { height: 10, width: 12, x: 20, y: 8 },
			sourceAssetVersionId: canonicalVersionId,
			targetUnitVersionId: targetUnitVersionId as string | null,
		},
	};
}

test("prepares a selective correction Production Package and rereads it unchanged", async () => {
	const { context, state } = createTestContext();
	state.unitVersions = [lockedUnit, targetUnit];
	const input = createCorrectionInput();

	const created = await call(appRouter.generationPackages.create, input, {
		context,
	});

	const { draft, ...recorded } = input.correction;
	expect(draft.id).toBe(pixelDraftId);
	expect(created.correction).toEqual({
		...recorded,
		coordinateSpace: {
			draftId: pixelDraftId,
			draftRevision: 3,
			height: 80,
			width: 72,
		},
		targetUnit: expect.objectContaining({
			id: targetUnitVersionId,
			unitKey: "attack-02",
		}),
	});
	expect(created.lockedUnits.map((unit) => unit.id)).toEqual([unitVersionId]);

	const reread = await call(
		appRouter.generationPackages.list,
		{ assetRecordId, projectId },
		{ context }
	);
	expect(reread).toEqual([created]);
});

test("the server takes the correction size from the Working Draft, not from the client", async () => {
	const { context, state } = createTestContext();
	state.unitVersions = [lockedUnit, targetUnit];
	const input = createCorrectionInput();
	input.targetDimensions = { height: 4000, width: 4000 };
	const created = await call(appRouter.generationPackages.create, input, {
		context,
	});
	expect(created.targetDimensions).toEqual({ height: 80, width: 72 });
	expect(created.correction?.coordinateSpace).toMatchObject({
		draftId: pixelDraftId,
		draftRevision: 3,
		height: 80,
		width: 72,
	});
});

test("rejects a correction for a stale, unknown or foreign Working Draft", async () => {
	const { context, state, storedPackages } = createTestContext();
	state.unitVersions = [lockedUnit, targetUnit];

	const stale = createCorrectionInput();
	stale.correction.draft.revision = 2;
	await expect(
		call(appRouter.generationPackages.create, stale, { context })
	).rejects.toMatchObject({ code: "CONFLICT" });

	const unknown = createCorrectionInput();
	unknown.correction.draft.id = crypto.randomUUID();
	await expect(
		call(appRouter.generationPackages.create, unknown, { context })
	).rejects.toMatchObject({ code: "NOT_FOUND" });

	if (state.draftSpace) {
		state.draftSpace.assetRecordId = crypto.randomUUID();
	}
	await expect(
		call(appRouter.generationPackages.create, createCorrectionInput(), {
			context,
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(storedPackages).toHaveLength(0);
});

test("rejects a pivot or ground line outside the Working Draft size", async () => {
	const { context, storedPackages } = createTestContext();
	for (const mark of [
		{ at: { x: 72, y: 10 }, kind: "pivot" },
		{ kind: "ground-line", y: 80 },
	] as const) {
		const input = createCorrectionInput();
		input.correction.annotations.push(mark as never);
		// biome-ignore lint/performance/noAwaitInLoops: each mark is checked against a fresh input
		await expect(
			call(appRouter.generationPackages.create, input, { context })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	}
	expect(storedPackages).toHaveLength(0);
});

test("a package without a correction still parses and has no correction", async () => {
	const { context } = createTestContext();
	const created = await call(
		appRouter.generationPackages.create,
		createInput(),
		{ context }
	);
	expect(created.correction).toBeUndefined();
});

test("rejects an annotation or redraw region outside the target bounds", async () => {
	const { context, storedPackages } = createTestContext();
	const outsideAnnotation = createCorrectionInput();
	outsideAnnotation.correction.annotations[0] = {
		from: { x: 2, y: 3 },
		kind: "arrow",
		to: { x: 500, y: 12 },
	};
	await expect(
		call(appRouter.generationPackages.create, outsideAnnotation, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	const outsideRegion = createCorrectionInput();
	outsideRegion.correction.redrawRegion = {
		height: 10,
		width: 60,
		x: 20,
		y: 8,
	};
	await expect(
		call(appRouter.generationPackages.create, outsideRegion, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(storedPackages).toHaveLength(0);
});

test("rejects a correction whose source version or target unit is not in the record", async () => {
	const { context, state, storedPackages } = createTestContext();
	state.unitVersions = [lockedUnit, targetUnit];

	const foreignSource = createCorrectionInput();
	foreignSource.correction.sourceAssetVersionId = crypto.randomUUID();
	await expect(
		call(appRouter.generationPackages.create, foreignSource, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	const foreignTarget = createCorrectionInput();
	foreignTarget.correction.targetUnitVersionId = crypto.randomUUID();
	await expect(
		call(appRouter.generationPackages.create, foreignTarget, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	const lockedTarget = createCorrectionInput();
	lockedTarget.correction.targetUnitVersionId = unitVersionId;
	await expect(
		call(appRouter.generationPackages.create, lockedTarget, { context })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(storedPackages).toHaveLength(0);
});

test("rejects a malformed correction at the input boundary", async () => {
	const { context, storedPackages } = createTestContext();
	const blankNote = createCorrectionInput();
	blankNote.correction.issueNote = "  ";
	await expect(
		call(appRouter.generationPackages.create, blankNote, { context })
	).rejects.toThrow();

	const unknownKind = createCorrectionInput();
	unknownKind.correction.annotations.push({
		kind: "layer",
		name: "paint",
	} as never);
	await expect(
		call(appRouter.generationPackages.create, unknownKind, { context })
	).rejects.toThrow();
	expect(storedPackages).toHaveLength(0);
});

test("preparing a correction only reads asset versions and never writes pixels", async () => {
	const { context, state } = createTestContext();
	state.unitVersions = [lockedUnit, targetUnit];
	const calls: string[] = [];
	const assetVersionStore = new Proxy(
		(context as unknown as { assetVersionStore: object }).assetVersionStore,
		{
			get(target, property, receiver) {
				calls.push(String(property));
				return Reflect.get(target, property, receiver);
			},
		}
	);
	await call(appRouter.generationPackages.create, createCorrectionInput(), {
		context: { ...context, assetVersionStore } as unknown as Context,
	});
	expect(calls).toEqual(["list"]);
});

test("keeps layers, full drawing and skeleton animation out of the correction contract", () => {
	expect(
		Object.keys(generationPackageCorrectionInputSchema.shape).sort()
	).toEqual([
		"annotations",
		"draft",
		"issueNote",
		"redrawRegion",
		"sourceAssetVersionId",
		"targetUnitVersionId",
	]);
});

test("rejects unauthenticated correction preparation", async () => {
	const { context, storedPackages } = createTestContext();
	await expect(
		call(appRouter.generationPackages.create, createCorrectionInput(), {
			context: { ...context, session: null } as unknown as Context,
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	expect(storedPackages).toHaveLength(0);
});
