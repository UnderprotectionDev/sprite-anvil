import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ProjectContextScopeCatalog,
	ProjectContextScopeStore,
	ThemeRecord,
	VisualWorldRecord,
} from "@sprite-anvil/api/context-scopes";
import type {
	ContextProposal,
	ContextProposalInput,
	ContextRevision,
	ContextRule,
	ProjectContextStore,
} from "@sprite-anvil/api/project-context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";

class MemoryProjectContextStore implements ProjectContextStore {
	private readonly projects = new Map<
		string,
		{
			ownerId: string;
			value: Awaited<ReturnType<ProjectContextStore["createProject"]>>;
		}
	>();
	private readonly revisions = new Map<string, ContextRevision>();
	private readonly proposals = new Map<string, ContextProposal>();

	listProjects(userId: string) {
		return Promise.resolve(
			[...this.projects.values()]
				.filter((project) => project.ownerId === userId)
				.map((project) => project.value)
		);
	}

	createProject(
		userId: string,
		input: Parameters<ProjectContextStore["createProject"]>[1]
	) {
		const id = "project-ash-knight";
		const currentContextRevision: ContextRevision = {
			id: crypto.randomUUID(),
			projectId: id,
			revisionNumber: 0,
			sourceProposalId: null,
			ruleContractVersion: "context-rule/1.0.0",
			isActive: false,
			rules: [],
			createdAt: new Date().toISOString(),
		};
		const project = {
			id,
			name: input.name,
			generalArtDirection: input.generalArtDirection,
			currentContextRevision,
			createdAt: new Date().toISOString(),
		};
		this.projects.set(id, { ownerId: userId, value: project });
		this.revisions.set(currentContextRevision.id, currentContextRevision);
		return Promise.resolve(project);
	}

	getRevision(userId: string, projectId: string, revisionId: string) {
		const project = this.projects.get(projectId);
		if (project?.ownerId !== userId) {
			return Promise.resolve(null);
		}
		const revision = this.revisions.get(revisionId);
		return Promise.resolve(revision?.projectId === projectId ? revision : null);
	}

	getRevisionByProposal(userId: string, projectId: string, proposalId: string) {
		const project = this.projects.get(projectId);
		if (project?.ownerId !== userId) {
			return Promise.resolve(null);
		}
		const revision = [...this.revisions.values()].find(
			(record) =>
				record.projectId === projectId && record.sourceProposalId === proposalId
		);
		return Promise.resolve(revision ?? null);
	}

	getProposal(userId: string, projectId: string, proposalId: string) {
		const project = this.projects.get(projectId);
		const proposal = this.proposals.get(proposalId);
		return Promise.resolve(
			project?.ownerId === userId && proposal?.projectId === projectId
				? proposal
				: null
		);
	}

	activateProposal(input: {
		userId: string;
		projectId: string;
		proposalId: string;
		expectedCurrentRevisionId: string;
		ruleContractVersion: ContextRevision["ruleContractVersion"];
		rules: ContextRule[];
	}) {
		const project = this.projects.get(input.projectId);
		if (project?.ownerId !== input.userId) {
			return Promise.resolve(null);
		}
		const alreadyActivated = [...this.revisions.values()].find(
			(record) => record.sourceProposalId === input.proposalId
		);
		if (alreadyActivated) {
			return Promise.resolve(
				alreadyActivated.isActive ? alreadyActivated : null
			);
		}
		if (
			project.value.currentContextRevision.id !==
			input.expectedCurrentRevisionId
		) {
			return Promise.resolve(null);
		}
		const proposal = this.proposals.get(input.proposalId);
		if (proposal?.projectId !== input.projectId) {
			return Promise.resolve(null);
		}
		const previousRevision = {
			...project.value.currentContextRevision,
			isActive: false,
		};
		const revision: ContextRevision = {
			id: crypto.randomUUID(),
			projectId: input.projectId,
			revisionNumber: previousRevision.revisionNumber + 1,
			sourceProposalId: input.proposalId,
			ruleContractVersion: input.ruleContractVersion,
			isActive: true,
			rules: input.rules,
			createdAt: new Date().toISOString(),
		};
		this.revisions.set(previousRevision.id, previousRevision);
		this.revisions.set(revision.id, revision);
		project.value.currentContextRevision = revision;
		return Promise.resolve(revision);
	}

	createProposal(_userId: string, proposal: ContextProposal) {
		this.proposals.set(proposal.id, proposal);
		return Promise.resolve();
	}

	addProposalForTest(proposal: ContextProposal) {
		this.proposals.set(proposal.id, proposal);
	}

	listProposals(userId: string, projectId: string) {
		if (this.projects.get(projectId)?.ownerId !== userId) {
			return Promise.resolve([]);
		}
		return Promise.resolve(
			[...this.proposals.values()].filter(
				(proposal) => proposal.projectId === projectId
			)
		);
	}

	addRevisionForTest(revision: ContextRevision) {
		this.revisions.set(revision.id, revision);
		if (revision.isActive) {
			const project = this.projects.get(revision.projectId);
			if (project) {
				project.value.currentContextRevision = revision;
			}
		}
	}
}

class MemoryProjectContextScopeStore implements ProjectContextScopeStore {
	private readonly visualWorlds: VisualWorldRecord[] = [];
	private readonly themes: ThemeRecord[] = [];
	private readonly projectStore: ProjectContextStore;

	constructor(projectStore: ProjectContextStore) {
		this.projectStore = projectStore;
	}

	async list(userId: string, projectId: string) {
		const owned = (await this.projectStore.listProjects(userId)).some(
			(project) => project.id === projectId
		);
		if (!owned) {
			return null;
		}
		const catalog: ProjectContextScopeCatalog = {
			visualWorlds: this.visualWorlds.filter(
				(visualWorld) => visualWorld.projectId === projectId
			),
			themes: this.themes.filter((theme) => theme.projectId === projectId),
		};
		return catalog;
	}

	async createVisualWorld(
		userId: string,
		input: Parameters<ProjectContextScopeStore["createVisualWorld"]>[1]
	) {
		if (!(await this.list(userId, input.projectId))) {
			return null;
		}
		if (
			this.visualWorlds.some(
				(existingWorld) =>
					existingWorld.projectId === input.projectId &&
					existingWorld.name.toLocaleLowerCase() ===
						input.name.toLocaleLowerCase()
			)
		) {
			return null;
		}
		const visualWorldRecord: VisualWorldRecord = {
			id: crypto.randomUUID(),
			projectId: input.projectId,
			name: input.name,
			description: input.description ?? "",
			createdAt: new Date().toISOString(),
		};
		this.visualWorlds.push(visualWorldRecord);
		return visualWorldRecord;
	}

	async createTheme(
		userId: string,
		input: Parameters<ProjectContextScopeStore["createTheme"]>[1]
	) {
		const catalog = await this.list(userId, input.projectId);
		if (
			!catalog?.visualWorlds.some(
				(visualWorld) => visualWorld.id === input.visualWorldId
			)
		) {
			return null;
		}
		if (
			this.themes.some(
				(existingTheme) =>
					existingTheme.visualWorldId === input.visualWorldId &&
					existingTheme.name.toLocaleLowerCase() ===
						input.name.toLocaleLowerCase()
			)
		) {
			return null;
		}
		const themeRecord: ThemeRecord = {
			id: crypto.randomUUID(),
			projectId: input.projectId,
			visualWorldId: input.visualWorldId,
			name: input.name,
			description: input.description ?? "",
			createdAt: new Date().toISOString(),
		};
		this.themes.push(themeRecord);
		return themeRecord;
	}
}

function makeContext(
	store: ProjectContextStore,
	userId: string | null,
	scopeStore: ProjectContextScopeStore = new MemoryProjectContextScopeStore(
		store
	)
): Context {
	return {
		assetRecordStore: {} as Context["assetRecordStore"],
		assetRecordTrackingStore: {} as Context["assetRecordTrackingStore"],
		db: {} as Database,
		projectAccess: {} as Context["projectAccess"],
		projectContextScopeStore: scopeStore,
		projectContextStore: store,
		session: userId ? ({ user: { id: userId } } as Context["session"]) : null,
	};
}

function projectScopedRule(
	projectId: string,
	id: string,
	value: string
): ContextRule {
	return {
		contractVersion: "context-rule/1.0.0",
		id,
		scope: { kind: "project", id: projectId },
		value: { type: "text", value },
		rationale: "Seeded context rule",
		source: { kind: "project_setup" },
		createdAt: new Date().toISOString(),
		precedenceChain: [{ kind: "project", id: projectId }],
	};
}

function proposalInput(
	projectId: string,
	baseContextRevisionId: string,
	changes: ContextProposalInput["changes"]
): ContextProposalInput {
	return {
		projectId,
		baseContextRevisionId,
		summary: "Keep the new sprites consistent",
		changes,
	};
}

function agentProposal(
	projectId: string,
	baseContextRevisionId: string,
	changes: ContextProposal["changes"]
): ContextProposal {
	const createdAt = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		projectId,
		baseContextRevisionId,
		contractVersion: "context-agent/1.0.0",
		ruleContractVersion: "context-rule/1.0.0",
		summary: "Clarify the environment rule",
		source: { kind: "agent", agentId: "context-agent", modelId: "test-model" },
		changes,
		validation: { isValid: true, checkedAt: createdAt, conflicts: [] },
		activationAllowed: false,
		createdAt,
	};
}

test("creates a project context proposal and reads the persisted record back", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Moonlit Vale",
			generalArtDirection: "Compact pixel art with cool dusk colors",
		},
		{ context }
	);

	expect(project.currentContextRevision.revisionNumber).toBe(0);
	expect(project.currentContextRevision.isActive).toBe(false);

	const created = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "palette",
				scope: { kind: "project", id: project.id },
				value: {
					type: "text_list",
					value: ["Keep character palettes to 12 colors"],
				},
				rationale:
					"The first character sheet reads more clearly with fewer colors.",
				evidence: [
					{
						kind: "user_decision",
						statement: "Keep character palettes compact.",
					},
					{
						kind: "observed_change",
						statement:
							"The latest sheet uses more than 20 colors per character.",
					},
				],
			},
		]),
		{ context }
	);

	const reread = await call(
		appRouter.contextProposals.list,
		{ projectId: project.id },
		{ context }
	);

	expect(created.source).toEqual({
		kind: "structured_control",
		controlId: "context-proposal-form",
		controlVersion: "1.0.0",
	});
	expect(created.baseContextRevisionId).toBe(project.currentContextRevision.id);
	expect(created.ruleContractVersion).toBe("context-rule/1.0.0");
	expect(created.validation).toMatchObject({ isValid: true, conflicts: [] });
	expect(created.activationAllowed).toBe(false);
	expect(reread).toEqual([created]);
	await expect(
		call(appRouter.projectContexts.list, {}, { context })
	).resolves.toEqual([project]);
});

test("stores Visual Worlds and Themes under the owner's Project Context", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "owner");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Lantern Vale",
			generalArtDirection: "Soft light and clear silhouettes",
		},
		{ context }
	);
	const visualWorld = await call(
		appRouter.contextScopes.createVisualWorld,
		{
			projectId: project.id,
			name: "Mountain settlements",
			description: "Terraced villages above the cloud line.",
		},
		{ context }
	);
	const theme = await call(
		appRouter.contextScopes.createTheme,
		{
			projectId: project.id,
			visualWorldId: visualWorld.id,
			name: "Winter market",
			description: "A seasonal market beneath blue lanterns.",
		},
		{ context }
	);
	const catalog = await call(
		appRouter.contextScopes.list,
		{ projectId: project.id },
		{ context }
	);

	expect(catalog).toEqual({ visualWorlds: [visualWorld], themes: [theme] });
	await expect(
		call(
			appRouter.contextScopes.createVisualWorld,
			{
				projectId: project.id,
				name: "MOUNTAIN SETTLEMENTS",
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		call(
			appRouter.contextScopes.createTheme,
			{
				projectId: project.id,
				visualWorldId: visualWorld.id,
				name: "WINTER MARKET",
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(
		call(
			appRouter.contextScopes.createTheme,
			{
				projectId: project.id,
				visualWorldId: crypto.randomUUID(),
				name: "Orphan theme",
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(
			appRouter.contextScopes.list,
			{ projectId: project.id },
			{ context: makeContext(store, "other-user") }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("activates a validated proposal as a new Context Revision for production", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Copper Grove",
			generalArtDirection: "Clear silhouettes with compact palettes",
		},
		{ context }
	);
	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "outline.width",
				scope: { kind: "project", id: project.id },
				value: { type: "number", value: 1.5 },
				rationale: "The selected sprite scale needs a fine outline.",
				evidence: [
					{ kind: "user_decision", statement: "Use a 1.5 pixel outline." },
				],
			},
		]),
		{ context }
	);

	const review = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: proposal.id },
		{ context }
	);
	const activated = await call(
		appRouter.contextProposals.activate,
		{
			projectId: project.id,
			proposalId: proposal.id,
			expectedCurrentRevisionId: review.currentRevisionId,
		},
		{ context }
	);
	const reread = await call(appRouter.projectContexts.list, {}, { context });

	expect(review.activationAllowed).toBe(true);
	expect(review.conflicts).toEqual([]);
	expect(review.contextCopy).toContain("1.5");
	expect(activated.revisionNumber).toBe(1);
	expect(activated.isActive).toBe(true);
	expect(activated.sourceProposalId).toBe(proposal.id);
	expect(activated.rules).toHaveLength(1);
	expect(activated.rules[0]).toMatchObject({
		id: "outline.width",
		value: { type: "number", value: 1.5 },
		source: { kind: "context_proposal", proposalId: proposal.id },
	});
	expect(reread[0]?.currentContextRevision).toEqual(activated);
	const repeatedReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: proposal.id },
		{ context }
	);
	expect(repeatedReview.activatedRevisionNumber).toBe(1);
	expect(repeatedReview.activationAllowed).toBe(true);
	expect(repeatedReview.targetRevisionNumber).toBe(1);
	expect(repeatedReview.candidateRules).toEqual(activated.rules);
	await expect(
		call(
			appRouter.contextProposals.activate,
			{
				projectId: project.id,
				proposalId: proposal.id,
				expectedCurrentRevisionId: repeatedReview.currentRevisionId,
			},
			{ context }
		)
	).resolves.toEqual(activated);
});

test("rebases independent proposal changes onto the current revision", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Mosslight",
			generalArtDirection: "Readable sprites with layered forest colors",
		},
		{ context }
	);
	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "outline.width",
				scope: { kind: "project", id: project.id },
				value: { type: "number", value: 1.5 },
				rationale: "Keep small silhouettes legible.",
				evidence: [
					{ kind: "user_decision", statement: "Use a 1.5 pixel outline." },
				],
			},
		]),
		{ context }
	);
	const currentRevision: ContextRevision = {
		...project.currentContextRevision,
		id: crypto.randomUUID(),
		revisionNumber: 1,
		isActive: true,
		rules: [projectScopedRule(project.id, "palette", "fern and amber")],
	};
	store.addRevisionForTest(currentRevision);

	const review = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: proposal.id },
		{ context }
	);

	expect(review.isRebased).toBe(true);
	expect(review.activationAllowed).toBe(true);
	expect(review.currentRevisionId).toBe(currentRevision.id);
	expect(review.candidateRules.map((rule) => rule.id)).toEqual([
		"palette",
		"outline.width",
	]);
	expect(review.contextCopy).toContain("fern and amber");
	expect(review.contextCopy).toContain("1.5");
});

test("does not report an inactive historical revision as a successful activation", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Silver Reed",
			generalArtDirection: "Fine outlines with directional lighting",
		},
		{ context }
	);
	const originalProposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "outline.width",
				scope: { kind: "project", id: project.id },
				value: { type: "number", value: 1.5 },
				rationale: "Keep small silhouettes legible.",
				evidence: [
					{ kind: "user_decision", statement: "Use a 1.5 pixel outline." },
				],
			},
		]),
		{ context }
	);
	const firstReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: originalProposal.id },
		{ context }
	);
	const firstRevision = await call(
		appRouter.contextProposals.activate,
		{
			projectId: project.id,
			proposalId: originalProposal.id,
			expectedCurrentRevisionId: firstReview.currentRevisionId,
		},
		{ context }
	);
	const laterProposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, firstRevision.id, [
			{
				operation: "add",
				ruleId: "light.direction",
				scope: { kind: "project", id: project.id },
				value: { type: "text", value: "north east" },
				rationale: "Keep environmental light consistent.",
				evidence: [
					{
						kind: "user_decision",
						statement: "Light comes from the north east.",
					},
				],
			},
		]),
		{ context }
	);
	const laterReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: laterProposal.id },
		{ context }
	);
	await call(
		appRouter.contextProposals.activate,
		{
			projectId: project.id,
			proposalId: laterProposal.id,
			expectedCurrentRevisionId: laterReview.currentRevisionId,
		},
		{ context }
	);
	const originalReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: originalProposal.id },
		{ context }
	);

	expect(originalReview.activationAllowed).toBe(false);
	expect(originalReview.activatedRevisionNumber).toBe(1);
	expect(originalReview.targetRevisionNumber).toBe(1);
	expect(originalReview.candidateRules).toEqual(firstRevision.rules);
	await expect(
		call(
			appRouter.contextProposals.activate,
			{
				projectId: project.id,
				proposalId: originalProposal.id,
				expectedCurrentRevisionId: originalReview.currentRevisionId,
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("blocks stale changes to the same rule and requires a fresh review", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Copper Finch",
			generalArtDirection: "Warm, simplified character sprites",
		},
		{ context }
	);
	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "palette",
				scope: { kind: "project", id: project.id },
				value: { type: "text_list", value: ["copper", "cream"] },
				rationale: "Keep the focal colors restrained.",
				evidence: [
					{ kind: "user_decision", statement: "Use copper and cream." },
				],
			},
		]),
		{ context }
	);
	const currentRevision: ContextRevision = {
		...project.currentContextRevision,
		id: crypto.randomUUID(),
		revisionNumber: 1,
		isActive: true,
		rules: [projectScopedRule(project.id, "palette", "blue and silver")],
	};
	store.addRevisionForTest(currentRevision);

	const review = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: proposal.id },
		{ context }
	);
	expect(review.activationAllowed).toBe(false);
	expect(review.conflicts.map((conflict) => conflict.code)).toContain(
		"stale_rule_conflict"
	);
	await expect(
		call(
			appRouter.contextProposals.activate,
			{
				projectId: project.id,
				proposalId: proposal.id,
				expectedCurrentRevisionId: review.currentRevisionId,
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(
		(await call(appRouter.projectContexts.list, {}, { context }))[0]
			?.currentContextRevision.id
	).toBe(currentRevision.id);
});

test("validates scope precedence and requires an explicit override", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Hollow Glen",
			generalArtDirection: "Layered environments with distinct themes",
		},
		{ context }
	);
	const visualWorld = await call(
		appRouter.contextScopes.createVisualWorld,
		{ projectId: project.id, name: "Underground coast" },
		{ context }
	);
	const theme = await call(
		appRouter.contextScopes.createTheme,
		{
			projectId: project.id,
			visualWorldId: visualWorld.id,
			name: "Flooded library",
		},
		{ context }
	);
	const baseRevision: ContextRevision = {
		...project.currentContextRevision,
		id: crypto.randomUUID(),
		revisionNumber: 1,
		rules: [projectScopedRule(project.id, "palette", "forest green")],
	};
	store.addRevisionForTest(baseRevision);
	store.addRevisionForTest({
		...baseRevision,
		id: crypto.randomUUID(),
		revisionNumber: 2,
		isActive: true,
	});
	const themeScope = { kind: "theme" as const, id: theme.id };
	const themeChain = [
		themeScope,
		{ kind: "visual_world" as const, id: visualWorld.id },
		{ kind: "project" as const, id: project.id },
	];
	const change = {
		operation: "add" as const,
		ruleId: "palette",
		scope: themeScope,
		value: { type: "text_list" as const, value: ["indigo", "moss"] },
		rationale: "The cavern theme needs its own palette.",
		evidence: [
			{ kind: "user_decision" as const, statement: "Use indigo and moss." },
		],
		precedenceChain: themeChain,
	};
	const missingOverride = await call(
		appRouter.contextProposals.create,
		{
			projectId: project.id,
			baseContextRevisionId: baseRevision.id,
			summary: "Use a separate palette for the flooded library",
			changes: [change],
		},
		{ context }
	);
	const missingOverrideReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: missingOverride.id },
		{ context }
	);
	expect(missingOverride.validation.isValid).toBe(false);
	expect(
		missingOverrideReview.conflicts.map((conflict) => conflict.code)
	).toContain("missing_context_override");

	const explicitOverride = await call(
		appRouter.contextProposals.create,
		{
			projectId: project.id,
			baseContextRevisionId: baseRevision.id,
			summary: "Declare the theme palette exception",
			changes: [{ ...change, supersedesRuleId: "palette" }],
		},
		{ context }
	);
	const overrideReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: explicitOverride.id },
		{ context }
	);
	expect(overrideReview.activationAllowed).toBe(true);
	expect(overrideReview.candidateRules).toHaveLength(2);
	expect(overrideReview.candidateRules[1]?.precedenceChain).toEqual(themeChain);
	const activatedScopeRevision = await call(
		appRouter.contextProposals.activate,
		{
			projectId: project.id,
			proposalId: explicitOverride.id,
			expectedCurrentRevisionId: overrideReview.currentRevisionId,
		},
		{ context }
	);
	expect(activatedScopeRevision.rules).toContainEqual(
		expect.objectContaining({
			id: "palette",
			scope: themeScope,
			supersedesRuleId: "palette",
			precedenceChain: themeChain,
		})
	);

	const unrelatedVisualWorld = await call(
		appRouter.contextScopes.createVisualWorld,
		{ projectId: project.id, name: "Coastal ruins" },
		{ context }
	);
	const invalidChain = agentProposal(project.id, baseRevision.id, [
		{
			...change,
			precedenceChain: [
				themeScope,
				{ kind: "visual_world", id: unrelatedVisualWorld.id },
				{ kind: "project", id: project.id },
			],
			supersedesRuleId: "palette",
		},
	]);
	store.addProposalForTest(invalidChain);
	const invalidChainReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: invalidChain.id },
		{ context }
	);
	expect(
		invalidChainReview.conflicts.map((conflict) => conflict.code)
	).toContain("invalid_precedence_chain");
});

test("blocks duplicate effective rules and missing proposal references", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Stone Orchard",
			generalArtDirection: "Quiet colors and clear material shapes",
		},
		{ context }
	);
	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "palette",
				scope: { kind: "project", id: project.id },
				value: { type: "text_list", value: ["slate", "ochre"] },
				rationale: "Keep the environment colors quiet.",
				evidence: [
					{ kind: "user_decision", statement: "Use slate and ochre." },
				],
			},
		]),
		{ context }
	);
	const unresolvedReference: ContextRule = {
		...projectScopedRule(project.id, "perspective", "Readable at 24 pixels"),
		source: { kind: "context_proposal", proposalId: crypto.randomUUID() },
	};
	const unresolvedRevision: ContextRevision = {
		...project.currentContextRevision,
		id: crypto.randomUUID(),
		revisionNumber: 1,
		isActive: true,
		rules: [unresolvedReference],
	};
	store.addRevisionForTest(unresolvedRevision);

	const unresolvedReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: proposal.id },
		{ context }
	);
	expect(unresolvedReview.conflicts.map((conflict) => conflict.code)).toContain(
		"unresolved_reference"
	);

	const duplicatedRule = projectScopedRule(project.id, "outline", "one pixel");
	const duplicateRevision: ContextRevision = {
		...unresolvedRevision,
		id: crypto.randomUUID(),
		revisionNumber: 2,
		rules: [
			duplicatedRule,
			{ ...duplicatedRule, value: { type: "text", value: "two pixels" } },
		],
	};
	store.addRevisionForTest(duplicateRevision);
	const duplicateReview = await call(
		appRouter.contextProposals.review,
		{ projectId: project.id, proposalId: proposal.id },
		{ context }
	);
	expect(duplicateReview.conflicts.map((conflict) => conflict.code)).toContain(
		"same_scope_contradiction"
	);
	await expect(
		call(
			appRouter.contextProposals.activate,
			{
				projectId: project.id,
				proposalId: proposal.id,
				expectedCurrentRevisionId: duplicateReview.currentRevisionId,
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("only the project owner can review or activate a proposal", async () => {
	const store = new MemoryProjectContextStore();
	const ownerContext = makeContext(store, "owner");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Private Project",
			generalArtDirection: "Unreleased character designs",
		},
		{ context: ownerContext }
	);
	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "perspective",
				scope: { kind: "project", id: project.id },
				value: { type: "text", value: "Readable at 32 pixels" },
				rationale: "Improve clarity.",
				evidence: [
					{
						kind: "user_decision",
						statement: "Preserve readable silhouettes.",
					},
				],
			},
		]),
		{ context: ownerContext }
	);
	const input = { projectId: project.id, proposalId: proposal.id };

	await expect(
		call(appRouter.contextProposals.review, input, {
			context: makeContext(store, null),
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		call(appRouter.contextProposals.review, input, {
			context: makeContext(store, "other-user"),
		})
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(
			appRouter.contextProposals.activate,
			{
				...input,
				expectedCurrentRevisionId: project.currentContextRevision.id,
			},
			{ context: makeContext(store, "other-user") }
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("requires activation to use the revision shown by its review", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Quiet Marsh",
			generalArtDirection: "Compact sprites with clear values",
		},
		{ context }
	);
	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				operation: "add",
				ruleId: "perspective",
				scope: { kind: "project", id: project.id },
				value: { type: "text", value: "Readable at 24 pixels" },
				rationale: "The smaller export needs simpler forms.",
				evidence: [
					{
						kind: "user_decision",
						statement: "Prioritize small-scale clarity.",
					},
				],
			},
		]),
		{ context }
	);

	await expect(
		call(
			appRouter.contextProposals.activate,
			{
				projectId: project.id,
				proposalId: proposal.id,
				expectedCurrentRevisionId: crypto.randomUUID(),
			},
			{ context }
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(
		(await call(appRouter.projectContexts.list, {}, { context }))[0]
			?.currentContextRevision.revisionNumber
	).toBe(0);
});

test("records add, replace, and remove proposals with evidence against the pinned revision", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Glass Harbor",
			generalArtDirection: "Low resolution hand-painted tiles",
		},
		{ context }
	);
	const baseRevision: ContextRevision = {
		...project.currentContextRevision,
		id: crypto.randomUUID(),
		revisionNumber: 4,
		rules: [
			projectScopedRule(project.id, "outline", "one pixel"),
			projectScopedRule(project.id, "palette", "blue-violet"),
		],
	};
	store.addRevisionForTest(baseRevision);

	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, baseRevision.id, [
			{
				operation: "add",
				ruleId: "material.language",
				scope: { kind: "project", id: project.id },
				value: { type: "text", value: "Use broad, chipped stone blocks" },
				rationale:
					"The latest environment study establishes this material language.",
				evidence: [
					{
						kind: "observed_change",
						statement: "The accepted sketch uses chipped blocks.",
					},
				],
			},
			{
				operation: "replace",
				ruleId: "outline",
				scope: { kind: "project", id: project.id },
				value: { type: "text", value: "two pixels" },
				rationale: "The current sprite scale needs a heavier outline.",
				evidence: [
					{ kind: "user_decision", statement: "Use a two-pixel outline." },
				],
			},
			{
				operation: "remove",
				ruleId: "palette",
				scope: { kind: "project", id: project.id },
				rationale: "The palette decision is no longer part of the style.",
				evidence: [
					{
						kind: "user_decision",
						statement: "Do not reserve a shadow color.",
					},
				],
			},
		]),
		{ context }
	);

	expect(proposal.baseContextRevisionId).toBe(baseRevision.id);
	expect(proposal.changes.map((change) => change.operation)).toEqual([
		"add",
		"replace",
		"remove",
	]);
	expect(proposal.validation.isValid).toBe(true);
});

test("stores conflicts as validation evidence without activating the proposal", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Copper Finch",
			generalArtDirection: "Warm, simplified character sprites",
		},
		{ context }
	);
	const change = {
		operation: "add" as const,
		ruleId: "motif.allowed",
		scope: { kind: "project" as const, id: project.id },
		value: { type: "text_list" as const, value: ["Use amber"] },
		rationale: "Record the accent color decision.",
		evidence: [
			{ kind: "user_decision" as const, statement: "Use amber for accents." },
		],
	};
	const created = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			change,
			change,
			{
				operation: "replace",
				ruleId: "shading",
				scope: { kind: "project", id: project.id },
				value: { type: "text", value: "Use blue" },
				rationale: "Replace a palette rule that is not in the base revision.",
				evidence: [
					{
						kind: "user_decision",
						statement: "Use blue instead of the old palette rule.",
					},
				],
			},
			{
				operation: "remove",
				ruleId: "detail.density",
				scope: { kind: "project", id: project.id },
				rationale: "Remove a palette rule that is not in the base revision.",
				evidence: [
					{
						kind: "observed_change",
						statement: "Recent assets no longer use that palette rule.",
					},
				],
			},
		]),
		{ context }
	);

	expect(created.validation.isValid).toBe(false);
	expect(created.validation.conflicts.map((conflict) => conflict.code)).toEqual(
		["duplicate_change", "missing_base_rule", "missing_base_rule"]
	);
	expect(created.activationAllowed).toBe(false);
});

test("rejects missing sessions, foreign project data, and changes without evidence", async () => {
	const store = new MemoryProjectContextStore();
	const ownerContext = makeContext(store, "owner");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Private Project",
			generalArtDirection: "Unreleased character designs",
		},
		{ context: ownerContext }
	);
	const input = proposalInput(project.id, project.currentContextRevision.id, [
		{
			operation: "add",
			ruleId: "perspective",
			scope: { kind: "project", id: project.id },
			value: { type: "text", value: "Readable at 32 pixels" },
			rationale: "Improve clarity.",
			evidence: [
				{ kind: "user_decision", statement: "Preserve readable silhouettes." },
			],
		},
	]);

	await expect(
		call(appRouter.contextProposals.create, input, {
			context: makeContext(store, null),
		})
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	await expect(
		call(appRouter.contextProposals.create, input, {
			context: makeContext(store, "other-user"),
		})
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		call(
			appRouter.contextProposals.create,
			{
				...input,
				changes: [{ ...input.changes[0], evidence: [] }],
			} as unknown as ContextProposalInput,
			{ context: ownerContext }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		call(
			appRouter.contextProposals.create,
			{
				...input,
				source: { kind: "agent", agentId: "impostor" },
			} as unknown as ContextProposalInput,
			{ context: ownerContext }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("structured controls reject unsupported rule keys and value types", async () => {
	const store = new MemoryProjectContextStore();
	const context = makeContext(store, "user-1");
	const project = await call(
		appRouter.projectContexts.create,
		{
			name: "Juniper Station",
			generalArtDirection: "Clean silhouettes with restrained colors",
		},
		{ context }
	);
	const baseInput = {
		operation: "add" as const,
		ruleId: "custom.unbounded-rule",
		scope: { kind: "project" as const, id: project.id },
		value: { type: "text" as const, value: "Anything the user enters" },
		rationale: "Record the requested project rule.",
		evidence: [{ kind: "user_decision" as const, statement: "Use this rule." }],
	};

	await expect(
		call(
			appRouter.contextProposals.create,
			proposalInput(project.id, project.currentContextRevision.id, [baseInput]),
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	await expect(
		call(
			appRouter.contextProposals.create,
			proposalInput(project.id, project.currentContextRevision.id, [
				{
					...baseInput,
					ruleId: "outline.width",
					value: { type: "text", value: "one pixel" },
				},
			]),
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	const fractionalOutline = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.currentContextRevision.id, [
			{
				...baseInput,
				ruleId: "outline.width",
				value: { type: "number", value: 1.5 },
			},
		]),
		{ context }
	);
	expect(fractionalOutline.validation.isValid).toBe(true);
	expect(fractionalOutline.changes[0]).toMatchObject({
		ruleId: "outline.width",
		value: { type: "number", value: 1.5 },
	});

	await expect(
		call(
			appRouter.contextProposals.create,
			proposalInput(project.id, project.currentContextRevision.id, [
				{
					...baseInput,
					ruleId: "outline.width",
					value: { type: "number", value: 2 },
					scope: { kind: "project", id: crypto.randomUUID() },
				},
			]),
			{ context }
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
