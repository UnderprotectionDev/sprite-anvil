import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
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
		const id = crypto.randomUUID();
		const initialContextRevision: ContextRevision = {
			id: crypto.randomUUID(),
			projectId: id,
			revisionNumber: 0,
			ruleContractVersion: "context-rule/1.0.0",
			isActive: false,
			rules: [],
			createdAt: new Date().toISOString(),
		};
		const project = {
			id,
			name: input.name,
			generalArtDirection: input.generalArtDirection,
			initialContextRevision,
			createdAt: new Date().toISOString(),
		};
		this.projects.set(id, { ownerId: userId, value: project });
		this.revisions.set(initialContextRevision.id, initialContextRevision);
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

	createProposal(_userId: string, proposal: ContextProposal) {
		this.proposals.set(proposal.id, proposal);
		return Promise.resolve();
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
	}
}

function makeContext(
	store: ProjectContextStore,
	userId: string | null
): Context {
	return {
		db: {} as Database,
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

	expect(project.initialContextRevision.revisionNumber).toBe(0);
	expect(project.initialContextRevision.isActive).toBe(false);

	const created = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.initialContextRevision.id, [
			{
				operation: "add",
				ruleId: "palette.restriction",
				scope: { kind: "project", id: project.id },
				value: { type: "text", value: "Keep character palettes to 12 colors" },
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
	expect(created.baseContextRevisionId).toBe(project.initialContextRevision.id);
	expect(created.ruleContractVersion).toBe("context-rule/1.0.0");
	expect(created.validation).toMatchObject({ isValid: true, conflicts: [] });
	expect(created.activationAllowed).toBe(false);
	expect(reread).toEqual([created]);
	await expect(
		call(appRouter.projectContexts.list, {}, { context })
	).resolves.toEqual([project]);
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
		...project.initialContextRevision,
		id: crypto.randomUUID(),
		revisionNumber: 4,
		rules: [
			projectScopedRule(project.id, "outline.width", "one pixel"),
			projectScopedRule(project.id, "palette.shadow", "blue-violet"),
		],
	};
	store.addRevisionForTest(baseRevision);

	const proposal = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, baseRevision.id, [
			{
				operation: "add",
				ruleId: "material.stone",
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
				ruleId: "outline.width",
				scope: { kind: "project", id: project.id },
				value: { type: "number", value: 2 },
				rationale: "The current sprite scale needs a heavier outline.",
				evidence: [
					{ kind: "user_decision", statement: "Use a two-pixel outline." },
				],
			},
			{
				operation: "remove",
				ruleId: "palette.shadow",
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
		ruleId: "palette.accent",
		scope: { kind: "project" as const, id: project.id },
		value: { type: "text" as const, value: "Use amber" },
		rationale: "Record the accent color decision.",
		evidence: [
			{ kind: "user_decision" as const, statement: "Use amber for accents." },
		],
	};
	const created = await call(
		appRouter.contextProposals.create,
		proposalInput(project.id, project.initialContextRevision.id, [
			change,
			change,
			{
				operation: "replace",
				ruleId: "palette.missing.replace",
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
				ruleId: "palette.missing.remove",
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
	const input = proposalInput(project.id, project.initialContextRevision.id, [
		{
			operation: "add",
			ruleId: "shape.silhouette",
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
