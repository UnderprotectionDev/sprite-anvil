import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ProductionExperiment,
	ProductionExperimentStore,
} from "@sprite-anvil/api/production-experiments";
import type {
	ContextProposal,
	ContextRevision,
} from "@sprite-anvil/api/project-context";
import { appRouter } from "@sprite-anvil/api/routers/index";

const userId = "d7393f91-65c0-44f0-a174-7508226cfd77";
const projectId = "9c6b338a-bdde-484d-9675-2e1861156c79";
const assetRecordId = "b178f612-12ec-432a-b254-32a6fd781cc4";
const packageAId = "2de54a7e-962c-48d3-b07a-bfbc16a2b724";
const packageBId = "8a4c2f0e-3c1e-4d6a-bf3c-52f6f5c7a111";
const versionAId = "7bb6f7dc-a09d-4f02-b324-e247081e3974";
const versionBId = "5d0c6a5b-1c1c-4b0b-9b1b-0a1b2c3d4e5f";
const revisionId = "0d9e1b0a-6c53-4b4f-9a43-3c5d6c5e7a10";
const unknownId = "11111111-2222-4333-8444-555555555555";
const visualWorldId = "3f1c8a52-7d41-4c0e-9a0b-6a7d2f1e5b01";
const themeId = "a2b4c6d8-1e3f-4a5b-8c7d-9e0f1a2b3c4d";
const timestamp = "2026-09-28T09:00:00.000Z";
const causalWording = /\bcaused\b|\bbecause\b/i;

const record = {
	availability: "active",
	createdAt: timestamp,
	id: assetRecordId,
	identityCriteria: ["independent_product_meaning"],
	name: "Ash Knight attack",
	projectId,
	supportLevel: "general",
	themeId,
	visualWorldId,
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
			contextRevisionId: revisionId,
			generalArtDirection: "Readable silhouettes.",
			ruleContractVersion: "context-rule/1.0.0",
			revisionNumber: 1,
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
	producedFromPackageId: string
) {
	return {
		assetFamilyId: "cae44a22-bf95-4582-a7d1-52fa111fbfc0",
		assetRecordId,
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
		providerGenerationRecord: null,
		reviewDisposition: "candidate",
		reviewEvents: [],
		versionNumber,
	};
}

function createContext(options: { packageB?: Record<string, unknown> } = {}) {
	const experiments: ProductionExperiment[] = [];
	const proposals: ContextProposal[] = [];
	const baseRevision: ContextRevision = {
		createdAt: timestamp,
		id: revisionId,
		isActive: false,
		projectId,
		revisionNumber: 0,
		rules: [],
		ruleContractVersion: "context-rule/1.0.0",
		sourceProposalId: null,
	};
	const packages = [
		createPackage(packageAId),
		createPackage(packageBId, options.packageB),
	];
	const versions = [
		createVersion(versionAId, 1, packageAId),
		createVersion(versionBId, 2, packageBId),
	];
	const productionExperimentStore: ProductionExperimentStore = {
		conclude: (_user, input) => {
			const experiment = experiments.find((e) => e.id === input.experimentId);
			if (!experiment) {
				return Promise.resolve(null);
			}
			experiment.conclusion = {
				concludedAt: timestamp,
				note: input.note,
				outcome: input.outcome,
				selectedTrialId: input.selectedTrialId,
			};
			return Promise.resolve({
				experiment: structuredClone(experiment),
				kind: "concluded" as const,
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
					...trial,
					createdAt: timestamp,
					id: crypto.randomUUID(),
					position,
				})),
			};
			experiments.push(experiment);
			return Promise.resolve(structuredClone(experiment));
		},
		get: (_user, _project, id) =>
			Promise.resolve(
				structuredClone(experiments.find((e) => e.id === id) ?? null)
			),
		list: () => Promise.resolve(structuredClone(experiments)),
	};
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
		generationPackageStore: { list: async () => structuredClone(packages) },
		productionExperimentStore,
		projectContextScopeStore: {
			list: async () => ({
				themes: [
					{
						createdAt: timestamp,
						description: "",
						id: themeId,
						name: "Ember",
						projectId,
						visualWorldId,
					},
				],
				visualWorlds: [
					{
						createdAt: timestamp,
						description: "",
						id: visualWorldId,
						name: "Ash",
						projectId,
					},
				],
			}),
		},
		projectContextStore: {
			createProposal: (_user: string, proposal: ContextProposal) => {
				proposals.push(structuredClone(proposal));
				return Promise.resolve();
			},
			getProposal: async (_u: string, _p: string, id: string) =>
				structuredClone(proposals.find((p) => p.id === id) ?? null),
			getRevision: async (_u: string, _p: string, id: string) =>
				id === revisionId ? structuredClone(baseRevision) : null,
			getRevisionByProposal: async () => null,
			listProjects: async () => [
				{
					createdAt: timestamp,
					currentContextRevision: baseRevision,
					generalArtDirection: "Readable silhouettes.",
					id: projectId,
					name: "Ash",
				},
			],
			listProposals: async () => structuredClone(proposals),
		},
		session: { user: { id: userId } },
	} as unknown as Context;
	return { baseRevision, context, experiments, packages, proposals };
}

const trialInputs = [
	{ assetVersionId: versionAId, generationPackageId: packageAId, label: "A" },
	{ assetVersionId: versionBId, generationPackageId: packageBId, label: "B" },
];

async function openExperiment(context: Context) {
	return await call(
		appRouter.productionExperiments.create,
		{
			assetRecordId,
			projectId,
			title: "Attack pose wording",
			trials: trialInputs,
		},
		{ context }
	);
}

async function concludedExperiment(context: Context) {
	const created = await openExperiment(context);
	const selectedTrialId = created.trials[1]?.id;
	await call(
		appRouter.productionExperiments.conclude,
		{
			experimentId: created.id,
			outcome: "selection_made",
			projectId,
			selectedTrialId,
		},
		{ context }
	);
	return { id: created.id, selectedTrialId };
}

function learningInput(experimentId: string, overrides = {}) {
	return {
		baseContextRevisionId: revisionId,
		changes: [
			{
				evidence: [
					{ kind: "user_decision" as const, statement: "I prefer wording B." },
				],
				operation: "add" as const,
				rationale: "Wording B produced a clearer attack pose.",
				ruleId: "detail.density",
				scope: { id: themeId, kind: "theme" as const },
				value: { type: "text" as const, value: "low" },
			},
		],
		comment: "Try this for the whole Ember theme.",
		experimentId,
		projectId,
		summary: "Keep attack poses low-detail",
		...overrides,
	};
}

test("transfers a concluded experiment into a reviewable Context Proposal at the narrowest scope", async () => {
	const { context, proposals, baseRevision } = createContext({
		packageB: { targetTask: "Create a faster four-frame attack animation." },
	});
	const experiment = await concludedExperiment(context);

	const created = await call(
		appRouter.productionExperiments.transferLearning,
		learningInput(experiment.id),
		{ context }
	);

	expect(created.activationAllowed).toBe(false);
	expect(created.source).toMatchObject({
		causeCanBeSeparated: true,
		changedInputs: ["instruction"],
		separability: "single_changed",
		comment: "Try this for the whole Ember theme.",
		experimentId: experiment.id,
		kind: "production_experiment",
		narrowestScope: { id: themeId, kind: "theme" },
		scopeWidenedByUser: false,
		selectedTrialId: experiment.selectedTrialId,
	});
	if (created.source.kind !== "production_experiment") {
		throw new Error("Expected a Production Experiment source.");
	}
	expect(created.source.comparedTrials.map((trial) => trial.label)).toEqual([
		"A",
		"B",
	]);
	expect(created.source.comparisonStatement).not.toMatch(causalWording);
	expect(created.changes[0]?.precedenceChain).toEqual([
		{ id: themeId, kind: "theme" },
		{ id: visualWorldId, kind: "visual_world" },
		{ id: projectId, kind: "project" },
	]);

	// Persisted and re-read through the shared Context Proposal list.
	const listed = await call(
		appRouter.contextProposals.list,
		{ projectId },
		{ context }
	);
	expect(listed.map((proposal) => proposal.id)).toEqual([created.id]);
	expect(proposals).toHaveLength(1);

	// Not an active rule: the base Context Revision is unchanged and the
	// proposal still needs the separate activation gate.
	expect(baseRevision.rules).toEqual([]);
	const review = await call(
		appRouter.contextProposals.review,
		{ projectId, proposalId: created.id },
		{ context }
	);
	expect(review.activatedRevisionNumber).toBeNull();

	// Experiment conclusion and trial evidence stay intact.
	const reread = await call(
		appRouter.productionExperiments.get,
		{ experimentId: experiment.id, projectId },
		{ context }
	);
	expect(reread.conclusion?.outcome).toBe("selection_made");
	expect(reread.trials).toHaveLength(2);
	expect(
		reread.trials.map((trial) => trial.candidateVersion.reviewDisposition)
	).toEqual(["candidate", "candidate"]);
});

test("records that the cause cannot be separated and makes no causal claim", async () => {
	const { context } = createContext({
		packageB: {
			expectedOutputStructure: "An eight-frame PNG sprite sheet.",
			targetTask: "Create a faster four-frame attack animation.",
		},
	});
	const experiment = await concludedExperiment(context);

	const created = await call(
		appRouter.productionExperiments.transferLearning,
		learningInput(experiment.id),
		{ context }
	);

	if (created.source.kind !== "production_experiment") {
		throw new Error("Expected a Production Experiment source.");
	}
	expect(created.source.causeCanBeSeparated).toBe(false);
	expect(created.source.separability).toBe("several_changed");
	expect(created.source.changedInputs).toEqual([
		"instruction",
		"output_structure",
	]);
	expect(created.source.comparisonStatement).toContain("cannot be separated");
	expect(created.source.comparisonStatement).not.toMatch(causalWording);
});

test("states that no input changed instead of calling it several", async () => {
	const { context } = createContext();
	const experiment = await concludedExperiment(context);

	const created = await call(
		appRouter.productionExperiments.transferLearning,
		learningInput(experiment.id),
		{ context }
	);

	if (created.source.kind !== "production_experiment") {
		throw new Error("Expected a Production Experiment source.");
	}
	expect(created.source.causeCanBeSeparated).toBe(false);
	expect(created.source.separability).toBe("none_changed");
	expect(created.source.changedInputs).toEqual([]);
});

test("keeps widening the scope a user decision", async () => {
	const { context } = createContext();
	const experiment = await concludedExperiment(context);
	const widened = {
		changes: [
			{
				...learningInput(experiment.id).changes[0],
				scope: { id: projectId, kind: "project" as const },
			},
		],
	};

	await expect(
		call(
			appRouter.productionExperiments.transferLearning,
			learningInput(experiment.id, widened),
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	const created = await call(
		appRouter.productionExperiments.transferLearning,
		learningInput(experiment.id, { ...widened, widenScope: true }),
		{ context }
	);
	if (created.source.kind !== "production_experiment") {
		throw new Error("Expected a Production Experiment source.");
	}
	expect(created.source.scopeWidenedByUser).toBe(true);
	expect(created.source.narrowestScope).toEqual({
		id: themeId,
		kind: "theme",
	});
	expect(created.changes[0]?.scope).toEqual({ id: projectId, kind: "project" });
});

test("rejects open, unknown, unowned, and unauthenticated transfers", async () => {
	const { context, proposals } = createContext();
	const open = await openExperiment(context);

	await expect(
		call(
			appRouter.productionExperiments.transferLearning,
			learningInput(open.id),
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		call(
			appRouter.productionExperiments.transferLearning,
			learningInput(unknownId),
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(
			appRouter.productionExperiments.transferLearning,
			learningInput(open.id, { comment: " " }),
			{ context }
		)
	).rejects.toBeDefined();
	await expect(
		call(
			appRouter.productionExperiments.transferLearning,
			learningInput(open.id),
			{ context: { ...context, session: null } as unknown as Context }
		)
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });

	const experiment = await concludedExperiment(context);
	await expect(
		call(
			appRouter.productionExperiments.transferLearning,
			learningInput(experiment.id, { baseContextRevisionId: unknownId }),
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect(proposals).toHaveLength(0);
});
