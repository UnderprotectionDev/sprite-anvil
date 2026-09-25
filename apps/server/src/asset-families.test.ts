import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";

const projectId = "project-ash-knight";
const userId = "user-ash-knight";
const firstVisualWorldId = "world-gameplay";
const secondVisualWorldId = "world-illustration";

class MemoryAssetFamilyStore {
	private readonly ownerId = userId;
	private readonly subjectIdentities: Record<string, unknown>[] = [];
	private readonly assetFamilies: Record<string, unknown>[] = [];
	private readonly assetRecords: Record<string, unknown>[] = [];
	private readonly relationships: Record<string, unknown>[] = [];

	list(requestedUserId: string, requestedProjectId: string) {
		if (requestedUserId !== this.ownerId || requestedProjectId !== projectId) {
			return Promise.resolve(null);
		}
		return Promise.resolve({
			subjectIdentities: this.subjectIdentities,
			assetFamilies: this.assetFamilies,
			assetRecords: this.assetRecords,
			relationships: this.relationships,
		});
	}

	createSubjectIdentity(_userId: string, input: Record<string, string>) {
		const record = {
			id: `identity-${this.subjectIdentities.length + 1}`,
			projectId: input.projectId,
			name: input.name,
			createdAt: new Date().toISOString(),
		};
		this.subjectIdentities.push(record);
		return Promise.resolve(record);
	}

	createAssetFamily(_userId: string, input: Record<string, string>) {
		if (
			this.assetFamilies.some(
				(existing) =>
					existing.subjectIdentityId === input.subjectIdentityId &&
					String(existing.name).toLowerCase() ===
						String(input.name ?? "").toLowerCase()
			)
		) {
			return Promise.resolve(null);
		}
		const record = {
			id: `family-${this.assetFamilies.length + 1}`,
			projectId: input.projectId,
			subjectIdentityId: input.subjectIdentityId,
			name: input.name,
			visualWorldId: input.visualWorldId,
			useContext: input.useContext,
			createdAt: new Date().toISOString(),
		};
		this.assetFamilies.push(record);
		return Promise.resolve(record);
	}

	createAssetRecord(_userId: string, input: Record<string, string>) {
		const record = {
			id: `asset-${this.assetRecords.length + 1}`,
			projectId: input.projectId,
			assetFamilyId: input.assetFamilyId,
			name: input.name,
			createdAt: new Date().toISOString(),
		};
		this.assetRecords.push(record);
		return Promise.resolve(record);
	}

	createRelationship(_userId: string, input: Record<string, string>) {
		const record = {
			id: `relationship-${this.relationships.length + 1}`,
			projectId: input.projectId,
			assetFamilyId: input.assetFamilyId,
			sourceAssetRecordId: input.sourceAssetRecordId,
			sourceAssetVersionId: input.sourceAssetVersionId ?? null,
			targetAssetRecordId: input.targetAssetRecordId,
			type: input.type,
			createdAt: new Date().toISOString(),
		};
		this.relationships.push(record);
		return Promise.resolve(record);
	}
}

const routes = appRouter as unknown as {
	assetFamilies: Record<string, unknown>;
};

function invoke(
	operation: string,
	input: Record<string, string>,
	context: Record<string, unknown>
) {
	return call(routes.assetFamilies[operation] as never, input as never, {
		context: context as never,
	});
}

test("groups representations by Subject Identity while keeping relationships inside one Asset Family", async () => {
	const store = new MemoryAssetFamilyStore();
	const context = {
		assetFamilyStore: store,
		projectContextScopeStore: {
			list: () =>
				Promise.resolve({
					visualWorlds: [
						{ id: firstVisualWorldId },
						{ id: secondVisualWorldId },
					],
					themes: [],
				}),
		},
		session: { user: { id: userId } },
	};
	const identity = await invoke(
		"createSubjectIdentity",
		{ projectId, name: "Ash Knight" },
		context
	);
	const gameplayFamily = await invoke(
		"createAssetFamily",
		{
			projectId,
			subjectIdentityId: (identity as { id: string }).id,
			name: "Game Sprite",
			visualWorldId: firstVisualWorldId,
			useContext: "gameplay",
		},
		context
	);
	const marketingFamily = await invoke(
		"createAssetFamily",
		{
			projectId,
			subjectIdentityId: (identity as { id: string }).id,
			name: "Marketing Art",
			visualWorldId: firstVisualWorldId,
			useContext: "marketing",
		},
		context
	);
	const portraitFamily = await invoke(
		"createAssetFamily",
		{
			projectId,
			subjectIdentityId: (identity as { id: string }).id,
			name: "Painted Portrait",
			visualWorldId: secondVisualWorldId,
			useContext: "gameplay",
		},
		context
	);
	await expect(
		invoke(
			"createAssetFamily",
			{
				projectId,
				subjectIdentityId: (identity as { id: string }).id,
				name: "Game Sprite",
				visualWorldId: firstVisualWorldId,
				useContext: "another purpose",
			},
			context
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
	const alternateFamily = await invoke(
		"createAssetFamily",
		{
			projectId,
			subjectIdentityId: (identity as { id: string }).id,
			name: "Separate Gameplay Design",
			visualWorldId: firstVisualWorldId,
			useContext: "gameplay",
		},
		context
	);
	const gameplayFamilyId = (gameplayFamily as { id: string }).id;
	const firstAsset = await invoke(
		"createAssetRecord",
		{ projectId, assetFamilyId: gameplayFamilyId, name: "Ash Knight base" },
		context
	);
	const secondAsset = await invoke(
		"createAssetRecord",
		{ projectId, assetFamilyId: gameplayFamilyId, name: "Ash Knight east" },
		context
	);
	const portraitAsset = await invoke(
		"createAssetRecord",
		{
			projectId,
			assetFamilyId: (portraitFamily as { id: string }).id,
			name: "Ash Knight portrait",
		},
		context
	);
	const canonicalVersionId = "version-gameplay-base-v1";

	await Promise.all(
		["direction", "animation", "state"].map((type) =>
			invoke(
				"createRelationship",
				{
					projectId,
					assetFamilyId: gameplayFamilyId,
					sourceAssetRecordId: (firstAsset as { id: string }).id,
					targetAssetRecordId: (secondAsset as { id: string }).id,
					type,
				},
				context
			)
		)
	);
	await invoke(
		"createRelationship",
		{
			projectId,
			assetFamilyId: gameplayFamilyId,
			sourceAssetRecordId: (firstAsset as { id: string }).id,
			targetAssetRecordId: (secondAsset as { id: string }).id,
			type: "derivative",
			sourceAssetVersionId: canonicalVersionId,
		},
		{
			...context,
			verifyAssetVersionContent: () => Promise.resolve(true),
			assetVersionStore: {
				list: () =>
					Promise.resolve({
						assetVersions: [
							{
								id: canonicalVersionId,
								projectId,
								assetFamilyId: gameplayFamilyId,
								assetRecordId: (firstAsset as { id: string }).id,
								versionNumber: 1,
								contentType: "image/png",
								contentLength: 68,
								contentDigest: "a".repeat(64),
								integrityVerified: true,
								previewUrl: `/api/projects/${projectId}/asset-versions/${canonicalVersionId}/preview`,
								reviewDisposition: "approved",
								reviewEvents: [
									{
										id: "event-candidate",
										assetVersionId: canonicalVersionId,
										type: "candidate",
										rationale: null,
										createdAt: "2026-09-25T12:00:00.000Z",
									},
									{
										id: "event-approved",
										assetVersionId: canonicalVersionId,
										type: "approved",
										rationale: null,
										createdAt: "2026-09-25T12:00:01.000Z",
									},
								],
								createdAt: "2026-09-25T12:00:00.000Z",
							},
						],
						canonicalDesigns: [
							{
								id: "canonical-selection",
								projectId,
								assetFamilyId: gameplayFamilyId,
								assetRecordId: (firstAsset as { id: string }).id,
								assetVersionId: canonicalVersionId,
								createdAt: "2026-09-25T12:00:02.000Z",
							},
						],
					}),
			},
		}
	);

	await expect(
		invoke(
			"createRelationship",
			{
				projectId,
				assetFamilyId: gameplayFamilyId,
				sourceAssetRecordId: (firstAsset as { id: string }).id,
				targetAssetRecordId: (portraitAsset as { id: string }).id,
				type: "derivative",
				sourceAssetVersionId: canonicalVersionId,
			},
			context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });

	const reread = await invoke("list", { projectId }, context);
	expect(reread).toMatchObject({
		subjectIdentities: [
			{ id: (identity as { id: string }).id, name: "Ash Knight" },
		],
		assetFamilies: [
			{
				id: gameplayFamilyId,
				subjectIdentityId: (identity as { id: string }).id,
				name: "Game Sprite",
				visualWorldId: firstVisualWorldId,
				useContext: "gameplay",
			},
			{
				id: (marketingFamily as { id: string }).id,
				subjectIdentityId: (identity as { id: string }).id,
				name: "Marketing Art",
				visualWorldId: firstVisualWorldId,
				useContext: "marketing",
			},
			{
				id: (portraitFamily as { id: string }).id,
				subjectIdentityId: (identity as { id: string }).id,
				name: "Painted Portrait",
				visualWorldId: secondVisualWorldId,
				useContext: "gameplay",
			},
			{
				id: (alternateFamily as { id: string }).id,
				subjectIdentityId: (identity as { id: string }).id,
				name: "Separate Gameplay Design",
				visualWorldId: firstVisualWorldId,
				useContext: "gameplay",
			},
		],
		assetRecords: [
			{
				id: (firstAsset as { id: string }).id,
				assetFamilyId: gameplayFamilyId,
			},
			{
				id: (secondAsset as { id: string }).id,
				assetFamilyId: gameplayFamilyId,
			},
			{
				id: (portraitAsset as { id: string }).id,
				assetFamilyId: (portraitFamily as { id: string }).id,
			},
		],
		relationships: [
			{ assetFamilyId: gameplayFamilyId, type: "direction" },
			{ assetFamilyId: gameplayFamilyId, type: "animation" },
			{ assetFamilyId: gameplayFamilyId, type: "state" },
			{ assetFamilyId: gameplayFamilyId, type: "derivative" },
		],
	});
});

test("rejects family association operations without an authenticated user", async () => {
	await expect(
		invoke(
			"list",
			{ projectId },
			{
				assetFamilyStore: new MemoryAssetFamilyStore(),
				session: null,
			}
		)
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("does not expose a private project's catalog to a different signed-in user", async () => {
	await expect(
		invoke(
			"list",
			{ projectId },
			{
				assetFamilyStore: new MemoryAssetFamilyStore(),
				session: { user: { id: "different-user" } },
			}
		)
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});
