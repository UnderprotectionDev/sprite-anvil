import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ProductionExperiment,
	ProductionExperimentStore,
} from "@sprite-anvil/api/production-experiments";
import { appRouter } from "@sprite-anvil/api/routers/index";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";
const assetRecordId = "b178f612-12ec-432a-b254-32a6fd781cc4";
const otherAssetRecordId = "0b7a0dd6-5f3a-4c11-8d3c-4f1d2a7d1a10";
const packageAId = "2de54a7e-962c-48d3-b07a-bfbc16a2b724";
const packageBId = "8a4c2f0e-3c1e-4d6a-bf3c-52f6f5c7a111";
const packageCId = "c1a7a1d3-2f0e-4a0b-9f77-1f1d7b2f0c22";
const foreignPackageId = "f3d6a2c5-7b3e-4e5f-8d0a-6a1c2b3d4e55";
const versionAId = "7bb6f7dc-a09d-4f02-b324-e247081e3974";
const versionBId = "5d0c6a5b-1c1c-4b0b-9b1b-0a1b2c3d4e5f";
const versionCId = "6e1d7b6c-2d2d-4c1c-8c2c-1b2c3d4e5f60";
const foreignVersionId = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const unknownId = "11111111-2222-4333-8444-555555555555";
const pinnedInputMessage = /Generation Package or Candidate Version/;
const productionExperimentMessage = /Production Experiment/;
const differentPackageMessage = /different Generation Package/;
const noPackageMessage = /records no Generation Package/;
const selectedTrialMessage = /selected trial/;
const causalWording = /\bcaused\b|\bbecause\b/i;
const timestamp = "2026-09-28T09:00:00.000Z";

const record = {
	availability: "active",
	createdAt: timestamp,
	id: assetRecordId,
	identityCriteria: ["independent_product_meaning"],
	name: "Ash Knight attack",
	projectId,
	supportLevel: "general",
};

const packageForVersion: Record<string, string> = {
	[versionAId]: packageAId,
	[versionBId]: packageBId,
	[versionCId]: packageCId,
};

function createPackage(id: string, overrides: Record<string, unknown> = {}) {
	return {
		assetRecord: record,
		assetRecordId,
		avoidConstraints: [],
		canonicalDesign: null,
		changeConstraints: ["Change the attack pose."],
		createdAt: timestamp,
		expectedOutputStructure: "A four-frame PNG sprite sheet.",
		id,
		lockedUnits: [],
		preserveConstraints: ["Keep the silhouette."],
		productionContextSnapshot: {
			contextRevisionId: "6fdf9f81-8f20-45b5-bf4c-0d0b3b503f2b",
			generalArtDirection: "Readable silhouettes.",
			ruleContractVersion: "context-rule/1.0.0",
			revisionNumber: 3,
			rules: [],
			theme: null,
			visualWorld: null,
		},
		projectId,
		referenceRoles: [],
		targetDimensions: { height: 80, width: 72 },
		targetTask: "Create a four-frame attack animation.",
		...overrides,
	};
}

function createVersion(
	id: string,
	versionNumber: number,
	providerGenerationRecord: Record<string, unknown> | null = null,
	forAssetRecordId = assetRecordId,
	producedFromPackageId = packageForVersion[id] ?? foreignPackageId
) {
	return {
		assetFamilyId: "cae44a22-bf95-4582-a7d1-52fa111fbfc0",
		assetRecordId: forAssetRecordId,
		contentDigest: null,
		contentLength: 1,
		contentType: "image/png",
		createdAt: timestamp,
		id,
		integrityVerified: true,
		previewUrl: `/private/${id}`,
		projectId,
		productionEvidence: {
			evidenceLevel: "complete",
			managedSnapshots: [],
			manualImportEvidence: {
				actualInstruction: "Generate.",
				generationPackageId: producedFromPackageId,
				id: crypto.randomUUID(),
				recordedAt: timestamp,
				revision: 1,
				sourceSurface: "Provider",
			},
			sourceKind: "manual_import",
		},
		providerGenerationRecord,
		reviewDisposition: "candidate",
		reviewEvents: [],
		versionNumber,
	};
}

function createProviderRecord(
	assetVersionId: string,
	parameters: Record<string, unknown>
) {
	return {
		actualDimensions: null,
		assetRecordId,
		assetVersionId,
		createdAt: timestamp,
		id: crypto.randomUUID(),
		interface: null,
		model: "image-model",
		modelVersion: null,
		palette: [],
		parameterSnapshot: {
			parameters,
			schemaVersion: "provider-generation-parameters/1.0.0",
		},
		projectId,
		provider: "Provider",
		referenceIds: [],
		requestedDimensions: null,
		seed: null,
	};
}

function createExperimentStore(): ProductionExperimentStore & {
	experiments: ProductionExperiment[];
} {
	const experiments: ProductionExperiment[] = [];
	return {
		experiments,
		conclude: (_user, input) => {
			const experiment = experiments.find(
				(entry) => entry.id === input.experimentId
			);
			if (!experiment) {
				return Promise.resolve(null);
			}
			if (experiment.conclusion) {
				return Promise.resolve({ kind: "already-concluded" as const });
			}
			if (
				input.selectedTrialId &&
				!experiment.trials.some((trial) => trial.id === input.selectedTrialId)
			) {
				return Promise.resolve({ kind: "trial-not-found" as const });
			}
			experiment.conclusion = {
				concludedAt: timestamp,
				note: input.note,
				outcome: input.outcome,
				selectedTrialId: input.selectedTrialId,
			};
			return Promise.resolve({
				kind: "concluded" as const,
				experiment: structuredClone(experiment),
			});
		},
		create: (_user, input) => {
			const experiment: ProductionExperiment = {
				assetRecordId: input.assetRecordId,
				conclusion: null,
				createdAt: timestamp,
				id: crypto.randomUUID(),
				projectId: input.projectId,
				title: input.title,
				trials: input.trials.map((trial, position) => ({
					assetVersionId: trial.assetVersionId,
					createdAt: timestamp,
					generationPackageId: trial.generationPackageId,
					id: crypto.randomUUID(),
					label: trial.label,
					position,
				})),
			};
			experiments.push(experiment);
			return Promise.resolve(structuredClone(experiment));
		},
		get: (_user, _project, id) =>
			Promise.resolve(
				structuredClone(experiments.find((entry) => entry.id === id) ?? null)
			),
		list: () => Promise.resolve(structuredClone(experiments)),
	};
}

function createTestContext() {
	const packages = [
		createPackage(packageAId),
		createPackage(packageBId),
		createPackage(packageCId),
	];
	const versions = [
		createVersion(versionAId, 1),
		createVersion(versionBId, 2),
		createVersion(versionCId, 3),
		createVersion(foreignVersionId, 1, null, otherAssetRecordId),
	];
	const experimentStore = createExperimentStore();
	const context = {
		assetRecordStore: { get: async () => record },
		assetVersionStore: {
			list: async () => ({
				assetVersions: structuredClone(versions),
				canonicalDesigns: [],
				compositeVersions: [],
				unitVersions: [],
			}),
		},
		generationPackageStore: {
			list: async () => structuredClone(packages),
		},
		productionExperimentStore: experimentStore,
		session: { user: { id: userId } },
	} as unknown as Context;
	return { context, experimentStore, packages, versions };
}

function createInput(
	trials = [
		{ assetVersionId: versionAId, generationPackageId: packageAId, label: "A" },
		{ assetVersionId: versionBId, generationPackageId: packageBId, label: "B" },
	]
) {
	return {
		assetRecordId,
		projectId,
		title: "Attack pose wording",
		trials,
	};
}

async function createExperiment(
	context: Context,
	input = createInput()
): Promise<{ id: string; trialIds: string[] }> {
	const created = await call(appRouter.productionExperiments.create, input, {
		context,
	});
	return { id: created.id, trialIds: created.trials.map((trial) => trial.id) };
}

test("groups trials and rereads each pinned Generation Package and Candidate Version", async () => {
	const { context } = createTestContext();
	const { id } = await createExperiment(context);

	const reread = await call(
		appRouter.productionExperiments.get,
		{ experimentId: id, projectId },
		{ context }
	);

	expect(reread.conclusion).toBeNull();
	expect(reread.trials.map((trial) => trial.generationPackage.id)).toEqual([
		packageAId,
		packageBId,
	]);
	expect(reread.trials.map((trial) => trial.candidateVersion.id)).toEqual([
		versionAId,
		versionBId,
	]);
	expect(reread.comparison.changedInputs).toEqual([]);
	expect(reread.comparison.statement).toContain("No recorded input differs");
	expect(reread.comparison.causeCanBeSeparated).toBe(false);
	expect(reread.comparison.separability).toBe("none_changed");
	expect(reread.comparison.statement).not.toMatch(causalWording);
	const listed = await call(
		appRouter.productionExperiments.list,
		{ assetRecordId, projectId },
		{ context }
	);
	expect(listed.map((experiment) => experiment.id)).toEqual([id]);
});

test("names a single differing input without claiming it caused the outcome", async () => {
	const { context, packages } = createTestContext();
	packages[1] = createPackage(packageBId, {
		targetTask: "Create a faster four-frame attack animation.",
	});
	const { id } = await createExperiment(context);

	const { comparison } = await call(
		appRouter.productionExperiments.get,
		{ experimentId: id, projectId },
		{ context }
	);

	expect(comparison.changedInputs).toEqual(["instruction"]);
	expect(comparison.causeCanBeSeparated).toBe(true);
	expect(comparison.separability).toBe("single_changed");
	expect(comparison.statement).toContain("not proof");
	expect(comparison.statement).not.toMatch(causalWording);
	const instruction = comparison.inputs.find(
		(entry) => entry.input === "instruction"
	);
	expect(instruction?.status).toBe("different");
	expect(instruction?.trials.map((entry) => entry.trialId)).toHaveLength(2);
});

test("states that the cause cannot be separated when several inputs differ", async () => {
	const { context, packages, versions } = createTestContext();
	packages[1] = createPackage(packageBId, {
		expectedOutputStructure: "An eight-frame PNG sprite sheet.",
		targetDimensions: { height: 160, width: 144 },
		targetTask: "Create a faster four-frame attack animation.",
	});
	versions[0] = createVersion(
		versionAId,
		1,
		createProviderRecord(versionAId, { steps: 20 })
	);
	versions[1] = createVersion(
		versionBId,
		2,
		createProviderRecord(versionBId, { steps: 40 })
	);
	const { id } = await createExperiment(context);

	const { comparison } = await call(
		appRouter.productionExperiments.get,
		{ experimentId: id, projectId },
		{ context }
	);

	expect(comparison.changedInputs).toEqual([
		"instruction",
		"target_measure",
		"output_structure",
		"provider_parameters",
	]);
	expect(comparison.causeCanBeSeparated).toBe(false);
	expect(comparison.separability).toBe("several_changed");
	expect(comparison.statement).toContain("cannot be separated");
});

test("treats provider parameters as a difference only when they are provided", async () => {
	const { context, versions } = createTestContext();
	const none = await createExperiment(context);
	const withoutProvider = await call(
		appRouter.productionExperiments.get,
		{ experimentId: none.id, projectId },
		{ context }
	);
	expect(
		withoutProvider.comparison.inputs.find(
			(entry) => entry.input === "provider_parameters"
		)?.status
	).toBe("not_provided");

	versions[0] = createVersion(
		versionAId,
		1,
		createProviderRecord(versionAId, { steps: 20 })
	);
	const partial = await createExperiment(context);
	const reread = await call(
		appRouter.productionExperiments.get,
		{ experimentId: partial.id, projectId },
		{ context }
	);
	expect(reread.comparison.changedInputs).toEqual(["provider_parameters"]);
});

test("concludes with Selection Made without approving or removing any trial", async () => {
	const { context, experimentStore, versions } = createTestContext();
	const { id, trialIds } = await createExperiment(context);
	const [, selectedTrialId] = trialIds;

	await call(
		appRouter.productionExperiments.conclude,
		{
			experimentId: id,
			note: "Wording B reads better.",
			outcome: "selection_made",
			projectId,
			selectedTrialId,
		},
		{ context }
	);

	const reread = await call(
		appRouter.productionExperiments.get,
		{ experimentId: id, projectId },
		{ context }
	);
	expect(reread.conclusion).toMatchObject({
		note: "Wording B reads better.",
		outcome: "selection_made",
		selectedTrialId,
	});
	expect(reread.trials).toHaveLength(2);
	expect(
		reread.trials.map((trial) => trial.candidateVersion.reviewDisposition)
	).toEqual(["candidate", "candidate"]);
	expect(versions.every((v) => v.reviewDisposition === "candidate")).toBe(true);
	expect(experimentStore.experiments[0]?.trials).toHaveLength(2);
});

test("concludes as Inconclusive or Abandoned without a selected trial", async () => {
	const { context } = createTestContext();
	const outcomes = ["inconclusive", "abandoned"] as const;
	const created = await Promise.all(
		outcomes.map(async (outcome) => ({
			outcome,
			...(await createExperiment(context)),
		}))
	);
	await Promise.all(
		created.map(async ({ id, outcome }) => {
			await call(
				appRouter.productionExperiments.conclude,
				{ experimentId: id, outcome, projectId },
				{ context }
			);
			const reread = await call(
				appRouter.productionExperiments.get,
				{ experimentId: id, projectId },
				{ context }
			);
			expect(reread.conclusion).toMatchObject({
				note: null,
				outcome,
				selectedTrialId: null,
			});
			expect(reread.trials).toHaveLength(2);
		})
	);
});

test("rejects invalid conclusions and keeps the experiment open", async () => {
	const { context } = createTestContext();
	const { id, trialIds } = await createExperiment(context);
	const base = { experimentId: id, projectId };

	await expect(
		call(
			appRouter.productionExperiments.conclude,
			{ ...base, outcome: "selection_made" },
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		call(
			appRouter.productionExperiments.conclude,
			{ ...base, outcome: "inconclusive", selectedTrialId: trialIds[0] },
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		call(
			appRouter.productionExperiments.conclude,
			{ ...base, outcome: "selection_made", selectedTrialId: unknownId },
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		call(
			appRouter.productionExperiments.conclude,
			{ ...base, experimentId: unknownId, outcome: "abandoned" },
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });

	const reread = await call(
		appRouter.productionExperiments.get,
		{ experimentId: id, projectId },
		{ context }
	);
	expect(reread.conclusion).toBeNull();
});

test("does not let a concluded experiment be concluded again", async () => {
	const { context } = createTestContext();
	const { id } = await createExperiment(context);
	await call(
		appRouter.productionExperiments.conclude,
		{ experimentId: id, outcome: "abandoned", projectId },
		{ context }
	);

	await expect(
		call(
			appRouter.productionExperiments.conclude,
			{ experimentId: id, outcome: "inconclusive", projectId },
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const reread = await call(
		appRouter.productionExperiments.get,
		{ experimentId: id, projectId },
		{ context }
	);
	expect(reread.conclusion?.outcome).toBe("abandoned");
});

test("rejects trials that are not distinct, pinned inputs of the Asset Record", async () => {
	const { context, experimentStore } = createTestContext();
	const [first, second] = createInput().trials;
	if (!(first && second)) {
		throw new Error("Expected two trials.");
	}

	const invalid = [
		[first],
		[first, { ...second, generationPackageId: first.generationPackageId }],
		[first, { ...second, assetVersionId: first.assetVersionId }],
		[first, { ...second, generationPackageId: foreignPackageId }],
		[first, { ...second, assetVersionId: foreignVersionId }],
		[first, { ...second, assetVersionId: unknownId }],
	];
	// Pairing: a version produced from another package is rejected, loudly.
	await expect(
		call(
			appRouter.productionExperiments.create,
			createInput([first, { ...second, generationPackageId: packageCId }]),
			{ context }
		)
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: expect.stringMatching(differentPackageMessage),
	});
	expect(experimentStore.experiments).toHaveLength(0);
	await Promise.all(
		invalid.map((trials) =>
			expect(
				call(appRouter.productionExperiments.create, createInput(trials), {
					context,
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" })
		)
	);
	expect(experimentStore.experiments).toHaveLength(0);
});

test("rejects a Candidate Version that records no Generation Package", async () => {
	const { context, versions } = createTestContext();
	const bare = createVersion(versionBId, 2);
	versions[1] = {
		...bare,
		productionEvidence: {
			evidenceLevel: "unknown",
			managedSnapshots: [],
			manualImportEvidence: null,
			sourceKind: "unknown",
		},
	} as unknown as (typeof versions)[number];

	await expect(
		call(appRouter.productionExperiments.create, createInput(), { context })
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: expect.stringMatching(noPackageMessage),
	});
});

test("fails clearly when a concluded selection points at a missing trial", async () => {
	const { context, experimentStore } = createTestContext();
	const { id } = await createExperiment(context);
	const [experiment] = experimentStore.experiments;
	if (!experiment) {
		throw new Error("Expected an experiment.");
	}
	experiment.conclusion = {
		concludedAt: timestamp,
		note: null,
		outcome: "selection_made",
		selectedTrialId: unknownId,
	};

	await expect(
		call(
			appRouter.productionExperiments.get,
			{ experimentId: id, projectId },
			{ context }
		)
	).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(selectedTrialMessage),
	});
});

test("reports a conflict when the selected trial changes during the write", async () => {
	const { context, experimentStore } = createTestContext();
	const { id, trialIds } = await createExperiment(context);
	experimentStore.conclude = () =>
		Promise.resolve({ kind: "trial-changed" as const });

	await expect(
		call(
			appRouter.productionExperiments.conclude,
			{
				experimentId: id,
				outcome: "selection_made",
				projectId,
				selectedTrialId: trialIds[0],
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("lets only a signed-in user conclude or transfer a learning", async () => {
	// The repo has no agent-token or automation credential: every caller is a
	// Better Auth session. Anything without a session user is turned away.
	const { context } = createTestContext();
	const { id, trialIds } = await createExperiment(context);
	const nonUsers = [
		null,
		{},
		{ session: { id: "automation" } },
		{ user: null },
	];
	await Promise.all(
		nonUsers.map(async (session) => {
			const caller = { ...context, session } as unknown as Context;
			await expect(
				call(
					appRouter.productionExperiments.conclude,
					{
						experimentId: id,
						outcome: "selection_made",
						projectId,
						selectedTrialId: trialIds[0],
					},
					{ context: caller }
				)
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await expect(
				call(
					appRouter.productionExperiments.transferLearning,
					{
						baseContextRevisionId: unknownId,
						changes: [
							{
								evidence: [{ kind: "user_decision", statement: "Agent says." }],
								operation: "add",
								rationale: "Automated.",
								ruleId: "detail.density",
								scope: { id: projectId, kind: "project" },
								value: { type: "text", value: "low" },
							},
						],
						comment: "Automated.",
						experimentId: id,
						projectId,
						summary: "Automated",
					},
					{ context: caller }
				)
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		})
	);
	const reread = await call(
		appRouter.productionExperiments.get,
		{ experimentId: id, projectId },
		{ context }
	);
	expect(reread.conclusion).toBeNull();
});

test("rejects unauthenticated and unowned access", async () => {
	const { context } = createTestContext();
	const anonymous = { ...context, session: null } as unknown as Context;
	await expect(
		call(appRouter.productionExperiments.create, createInput(), {
			context: anonymous,
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		call(
			appRouter.productionExperiments.conclude,
			{ experimentId: unknownId, outcome: "abandoned", projectId },
			{ context: anonymous }
		)
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });

	const unowned = {
		...context,
		assetRecordStore: { get: async () => null },
	} as unknown as Context;
	await expect(
		call(appRouter.productionExperiments.create, createInput(), {
			context: unowned,
		})
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("reports a conflict instead of a server error when a pinned input is missing", async () => {
	const { context, packages } = createTestContext();
	const { id } = await createExperiment(context);
	packages.splice(0, 1);

	await expect(
		call(
			appRouter.productionExperiments.get,
			{ experimentId: id, projectId },
			{ context }
		)
	).rejects.toMatchObject({
		code: "CONFLICT",
		message: expect.stringMatching(pinnedInputMessage),
	});
});

test("uses English interface copy for failures", async () => {
	const { context } = createTestContext();
	await expect(
		call(
			appRouter.productionExperiments.get,
			{ experimentId: unknownId, projectId },
			{ context }
		)
	).rejects.toMatchObject({
		message: expect.stringMatching(productionExperimentMessage),
	});
});
