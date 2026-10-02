import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { eq, sql } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createFamilyReadinessStore } from "./features/family-readiness/server/family-readiness-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

function reviewContext(db: ReturnType<typeof createDb>, userId: string) {
	return {
		assetFamilyStore: createAssetFamilyStore(db),
		assetVersionStore: createAssetVersionStore(db),
		familyReadinessStore: createFamilyReadinessStore(db),
		projectContextStore: createProjectContextStore(db),
		projectContextScopeStore: createProjectContextScopeStore(db),
		specializedProfileContractStore: createSpecializedProfileContractStore(db),
		session: { user: { id: userId } } as Context["session"],
		verifyAssetVersionContent: async () => true,
	};
}

test.skipIf(!databaseUrl)(
	"records exact-version Review Events without treating approval as applicability or export readiness",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		let projectId: string | undefined;
		await db.insert(user).values({
			id: userId,
			name: "Version Reviewer",
			email: `${userId}@example.test`,
		});
		try {
			const context = reviewContext(db, userId);
			const options = { context: context as never };
			const project = await call(
				appRouter.projectContexts.create,
				{
					name: "Review Event Integration",
					generalArtDirection: "Clear silhouettes",
				},
				options
			);
			projectId = project.id;
			const world = await call(
				appRouter.contextScopes.createVisualWorld,
				{
					projectId,
					name: "Gameplay",
					description: "In-game art",
				},
				options
			);
			const identity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId, name: "Review Icon" },
				options
			);
			const family = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId,
					subjectIdentityId: identity.id,
					name: "Review Family",
					visualWorldId: world.id,
					useContext: "combat",
				},
				options
			);
			const record = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId,
					assetFamilyId: family.id,
					name: "Review Result",
					identityCriteria: ["delivery_identity"],
				},
				options
			);
			await db
				.update(assetRecords)
				.set({ assetCategory: "icon" })
				.where(eq(assetRecords.id, record.id));
			await call(
				appRouter.specializedProfileContracts.activate,
				{ projectId, profileId: "icon" },
				options
			);
			const profiles = await call(
				appRouter.specializedProfileContracts.list,
				{ projectId },
				options
			);
			const contract = profiles.profiles.find(
				(profile) => profile.definition.profileId === "icon"
			)?.definition;
			if (!contract) {
				throw new Error("The icon profile contract is required.");
			}
			const assetVersionId = crypto.randomUUID();
			const versionInput = {
				id: assetVersionId,
				projectId,
				assetRecordId: record.id,
				assetFamilyId: family.id,
				versionNumber: 2,
				contentType: "image/png" as const,
				byteSize: 68,
				sha256: "a".repeat(64),
				contentDigest: "a".repeat(64),
				integrityVerified: true,
				idempotencyKey: crypto.randomUUID(),
				objectKey: `review/${assetVersionId}.png`,
				createdByUserId: userId,
			};
			await db.insert(assetVersions).values(versionInput);
			const sourceAssetVersionId = crypto.randomUUID();
			await db.insert(assetVersions).values({
				...versionInput,
				id: sourceAssetVersionId,
				versionNumber: 1,
				idempotencyKey: crypto.randomUUID(),
				objectKey: `review/${sourceAssetVersionId}.png`,
			});
			const unitVersionId = crypto.randomUUID();
			const unitInput = {
				id: unitVersionId,
				projectId,
				assetRecordId: record.id,
				assetVersionId,
				sourceAssetVersionId,
				unitType: "state" as const,
				unitKey: "combat",
				versionNumber: 1,
				createdByUserId: userId,
			};
			await db.insert(unitVersions).values(unitInput);
			const reviewInput = {
				projectId,
				assetVersionId,
				decision: "approved" as const,
				rationale: "Accept this exact result.",
			};
			await expect(
				call(appRouter.assetVersions.review, reviewInput, options)
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: expect.stringContaining("Gerekli Öğeler Listesi"),
			});
			await call(
				appRouter.assetVersions.review,
				{
					...reviewInput,
					assetVersionId: sourceAssetVersionId,
					decision: "rejected",
				},
				options
			);
			await call(
				appRouter.assetVersions.review,
				{
					...reviewInput,
					assetVersionId: sourceAssetVersionId,
					decision: "candidate",
				},
				options
			);
			const revision = await call(
				appRouter.familyReadiness.saveDraft,
				{
					projectId,
					assetFamilyId: family.id,
					items: [
						{
							id: "result",
							kind: "usage_test",
							name: "Review Result",
							disposition: "required",
							assetRecordIds: [record.id],
							testId: "icon.light_dark_target_size",
						},
					],
				},
				options
			);
			await call(
				appRouter.familyReadiness.activate,
				{ projectId, assetFamilyId: family.id, revisionId: revision.id },
				options
			);
			await expect(
				call(appRouter.assetVersions.review, reviewInput, options)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(
				(
					await call(appRouter.assetVersions.list, { projectId }, options)
				).assetVersions.find((version) => version.id === assetVersionId)
					?.reviewEvents
			).toEqual([]);
			const evidenceScope = {
				projectId,
				assetFamilyId: family.id,
				revisionId: revision.id,
				itemId: "result",
				method: "Reviewed the declared use.",
				rationale: "Recorded evidence, not a Review Event.",
			};
			await Promise.all(
				contract.rules
					.filter((rule) => rule.class !== "quality_advisory")
					.map((rule) =>
						call(
							appRouter.familyReadiness.recordEvidence,
							{
								...evidenceScope,
								kind: "quality",
								ruleId: rule.id,
								result:
									rule.class === "waivable_requirement" ? "failed" : "passed",
								observedValue: "96%",
								versionTarget: { kind: "unit", id: unitVersionId },
							},
							options
						)
					)
			);
			await expect(
				call(appRouter.assetVersions.review, reviewInput, options)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await Promise.all(
				contract.humanReviews.map((review) =>
					call(
						appRouter.familyReadiness.recordEvidence,
						{
							...evidenceScope,
							kind: "quality",
							ruleId: review.id,
							result: "passed",
						},
						options
					)
				)
			);
			await expect(
				call(appRouter.assetVersions.review, reviewInput, options)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await Promise.all(
				contract.usageTests.map((usageTest) =>
					call(
						appRouter.familyReadiness.recordEvidence,
						{
							...evidenceScope,
							kind: "usage_test",
							testId: usageTest.id,
							result: "failed",
						},
						options
					)
				)
			);
			const integrityGate = contract.rules.find(
				(rule) => rule.class === "integrity_gate"
			);
			if (!integrityGate) {
				throw new Error("The icon Integrity Gate is required.");
			}
			await call(
				appRouter.familyReadiness.recordEvidence,
				{
					...evidenceScope,
					kind: "quality",
					ruleId: integrityGate.id,
					result: "failed",
					versionTarget: { kind: "unit", id: unitVersionId },
				},
				options
			);
			await expect(
				call(appRouter.assetVersions.review, reviewInput, options)
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: expect.stringContaining(integrityGate.id),
			});
			await call(
				appRouter.familyReadiness.recordEvidence,
				{
					...evidenceScope,
					kind: "quality",
					ruleId: integrityGate.id,
					result: "passed",
					versionTarget: { kind: "unit", id: unitVersionId },
				},
				options
			);
			await expect(
				call(appRouter.assetVersions.review, reviewInput, options)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const beforeWaivers = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				options
			);
			await Promise.all(
				contract.rules
					.filter((rule) => rule.class === "waivable_requirement")
					.map((rule) => {
						const measurement = beforeWaivers.items[0]?.latestEvidence.find(
							(evidence) => evidence.ruleId === rule.id
						);
						if (!measurement) {
							throw new Error(
								"The failed exact-version measurement is required."
							);
						}
						return call(
							appRouter.familyReadiness.recordEvidence,
							{
								...evidenceScope,
								kind: "quality",
								ruleId: rule.id,
								result: "waived",
								waiverEvidenceId: measurement.id,
								observedValue: "96%",
								versionTarget: { kind: "unit", id: unitVersionId },
							},
							options
						);
					})
			);
			await expect(
				call(
					appRouter.assetVersions.review,
					{ ...reviewInput, rationale: "   " },
					options
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await call(appRouter.assetVersions.review, reviewInput, options);
			const readiness = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				options
			);
			expect(readiness.status).toBe("incomplete");
			expect(readiness.items[0]?.qualityReadiness).toBe("blocked");
			expect(readiness.items[0]?.blockers).toContain("applicability");
			await (["rejected", "candidate", "approved"] as const).reduce(
				async (previous, decision) => {
					await previous;
					await call(
						appRouter.assetVersions.review,
						{
							...reviewInput,
							decision,
							rationale: `User decision: ${decision}`,
						},
						options
					);
				},
				Promise.resolve()
			);
			const freshContext = reviewContext(
				createDb({ DATABASE_URL: databaseUrl }),
				userId
			);
			const reread = await call(
				appRouter.assetVersions.list,
				{ projectId },
				{ context: freshContext as never }
			);
			const reviewedVersion = reread.assetVersions.find(
				(version) => version.id === assetVersionId
			);
			expect(reviewedVersion?.reviewDisposition).toBe("approved");
			expect(reviewedVersion?.reviewEvents.map((event) => event.type)).toEqual([
				"approved",
				"rejected",
				"candidate",
				"approved",
			]);
			expect(
				reviewedVersion?.reviewEvents.every(
					(event) =>
						event.assetVersionId === assetVersionId &&
						Boolean(event.createdAt) &&
						Boolean(event.rationale)
				)
			).toBe(true);
			const replacementId = crypto.randomUUID();
			await db.insert(assetVersions).values({
				...versionInput,
				id: replacementId,
				versionNumber: 3,
				idempotencyKey: crypto.randomUUID(),
				objectKey: `review/${replacementId}.png`,
			});
			await db.insert(unitVersions).values({
				...unitInput,
				id: crypto.randomUUID(),
				assetVersionId: replacementId,
				sourceAssetVersionId: assetVersionId,
				versionNumber: 2,
			});
			await expect(
				call(
					appRouter.assetVersions.review,
					{ ...reviewInput, assetVersionId: replacementId },
					options
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await call(
				appRouter.assetVersions.review,
				{ ...reviewInput, decision: "rejected" },
				options
			);
			await call(appRouter.assetVersions.review, reviewInput, options);
			const afterReplacement = await call(
				appRouter.assetVersions.list,
				{ projectId },
				options
			);
			expect(
				afterReplacement.assetVersions.find(
					(version) => version.id === assetVersionId
				)?.reviewDisposition
			).toBe("approved");
			expect(
				afterReplacement.assetVersions.find(
					(version) => version.id === replacementId
				)?.reviewEvents
			).toEqual([]);
			const proposal = await call(
				appRouter.contextProposals.create,
				{
					projectId,
					baseContextRevisionId: project.currentContextRevision.id,
					summary: "Change the outline style.",
					changes: [
						{
							operation: "add",
							ruleId: "outline",
							scope: { kind: "project", id: projectId },
							value: { type: "text", value: "Selective outline" },
							rationale: "Use the updated art direction.",
							evidence: [
								{
									kind: "user_decision",
									statement: "The user changed the outline.",
								},
							],
						},
					],
				},
				options
			);
			await call(
				appRouter.contextProposals.activate,
				{
					projectId,
					proposalId: proposal.id,
					expectedCurrentRevisionId: project.currentContextRevision.id,
				},
				options
			);
			const afterContextChange = await call(
				appRouter.assetVersions.list,
				{ projectId },
				{ context: freshContext as never }
			);
			expect(
				afterContextChange.assetVersions.find(
					(version) => version.id === assetVersionId
				)?.reviewEvents
			).toEqual(
				afterReplacement.assetVersions.find(
					(version) => version.id === assetVersionId
				)?.reviewEvents
			);
			expect(
				afterContextChange.assetVersions.find(
					(version) => version.id === assetVersionId
				)?.reviewDisposition
			).toBe("approved");
			await call(
				appRouter.assetVersions.review,
				{ ...reviewInput, decision: "rejected" },
				options
			);
			await expect(
				call(appRouter.assetVersions.review, reviewInput, options)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(appRouter.assetVersions.review, reviewInput, {
					context: { ...context, session: null } as never,
				})
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await expect(
				call(appRouter.assetVersions.review, reviewInput, {
					context: reviewContext(db, "another-user") as never,
				})
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		} finally {
			if (projectId) {
				await [
					"asset_version_review_events",
					"family_readiness_evidence",
					"family_required_set_activations",
					"family_required_set_heads",
					"family_required_set_revisions",
					"unit_versions",
					"asset_versions",
					"asset_records",
					"asset_families",
					"subject_identities",
					"visual_worlds",
					"project_specialized_profile_contracts",
					"context_proposals",
					"context_revisions",
				].reduce(async (previous, table) => {
					await previous;
					await db.execute(
						sql`DELETE FROM ${sql.identifier(table)} WHERE project_id = ${projectId}`
					);
				}, Promise.resolve());
				await db.execute(sql`DELETE FROM project WHERE id = ${projectId}`);
			}
			await db.execute(sql`DELETE FROM "user" WHERE id = ${userId}`);
		}
	}
);
