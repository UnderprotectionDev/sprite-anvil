import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { createDb } from "@sprite-anvil/db";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	compositeVersionReviewEvents,
	compositeVersions,
	compositionMemberships,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import {
	familyReadinessEvidence,
	familyRequiredSetActivations,
	familyRequiredSetHeads,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import { project } from "@sprite-anvil/db/schema/project";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { projectSpecializedProfileContracts } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { and, eq } from "drizzle-orm";
import { createAssetFamilyStore } from "./features/asset-families/server/asset-family-store";
import { createAssetRecordStore } from "./features/asset-records/server/asset-record-store";
import { createAssetRecordTrackingStore } from "./features/asset-records/server/asset-record-tracking-store";
import { createAssetVersionStore } from "./features/asset-versions/server/asset-version-store";
import { createCollectionStore } from "./features/collections/server/collection-store";
import { createFamilyReadinessStore } from "./features/family-readiness/server/family-readiness-store";
import { createProjectContextStore } from "./features/project-context/server/project-context-store";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";
import { createProjectContextScopeStore } from "./features/visual-worlds/server/project-context-scope-store";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

function createContext(database: ReturnType<typeof createDb>, userId: string) {
	const projectContextStore = createProjectContextStore(database);
	return {
		assetFamilyStore: createAssetFamilyStore(database),
		familyReadinessStore: createFamilyReadinessStore(database),
		assetRecordStore: createAssetRecordStore(database),
		assetRecordTrackingStore: createAssetRecordTrackingStore(database, null),
		assetVersionStore: createAssetVersionStore(database),
		collectionStore: createCollectionStore(database),
		db: database,
		projectAccess: createProjectAccessStore(database, projectContextStore),
		projectContextScopeStore: createProjectContextScopeStore(database),
		projectContextStore,
		specializedProfileContractStore:
			createSpecializedProfileContractStore(database),
		session: { user: { id: userId } } as Context["session"],
	} satisfies Context;
}

test.skipIf(!databaseUrl)(
	"persists an active Required Set and its pinned failure evidence through a fresh connection",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
		}
		const db = createDb({ DATABASE_URL: databaseUrl });
		const userId = crypto.randomUUID();
		let insertedUser = false;
		let projectId: string | undefined;
		let familyId: string | undefined;
		let assetVersionId: string | undefined;

		try {
			await db.insert(user).values({
				id: userId,
				name: "Family Readiness Integration Test",
				email: `family-readiness-${userId}@example.test`,
			});
			insertedUser = true;

			const context = createContext(db, userId);
			const createdProject = await call(
				appRouter.projectContexts.create,
				{
					name: "Family Readiness Integration Project",
					generalArtDirection: "Clear silhouettes and a limited palette",
				},
				{ context }
			);
			projectId = createdProject.id;
			const initialContracts = await call(
				appRouter.specializedProfileContracts.list,
				{ projectId },
				{ context }
			);
			expect(
				initialContracts.profiles.find(
					(profile) => profile.definition.profileId === "icon"
				)?.activeContract
			).toBeNull();
			await call(
				appRouter.specializedProfileContracts.activate,
				{ projectId, profileId: "icon" },
				{ context }
			);
			const activatedContracts = await call(
				appRouter.specializedProfileContracts.list,
				{ projectId },
				{ context }
			);
			const activeIconContractRevision = activatedContracts.profiles.find(
				(profile) => profile.definition.profileId === "icon"
			)?.activeContract;
			if (!activeIconContractRevision) {
				throw new Error("The active icon contract revision is required.");
			}
			const [humanReview] = activeIconContractRevision.contract.humanReviews;
			if (!humanReview) {
				throw new Error("The active icon human review is required.");
			}
			const contractRereadContext = createContext(
				createDb({ DATABASE_URL: databaseUrl }),
				userId
			);
			const persistedContracts = await call(
				appRouter.specializedProfileContracts.list,
				{ projectId },
				{ context: contractRereadContext }
			);
			expect(
				persistedContracts.profiles.find(
					(profile) => profile.definition.profileId === "icon"
				)?.activeContract?.contractRevisionId
			).toBe(
				activatedContracts.profiles.find(
					(profile) => profile.definition.profileId === "icon"
				)?.activeContract?.contractRevisionId
			);
			const visualWorld = await call(
				appRouter.contextScopes.createVisualWorld,
				{
					projectId,
					name: "Gameplay",
					description: "In-game assets",
				},
				{ context }
			);
			const identity = await call(
				appRouter.assetFamilies.createSubjectIdentity,
				{ projectId, name: "Ash Knight" },
				{ context }
			);
			const family = await call(
				appRouter.assetFamilies.createAssetFamily,
				{
					projectId,
					subjectIdentityId: identity.id,
					name: "Combat Sprite",
					visualWorldId: visualWorld.id,
					useContext: "combat",
				},
				{ context }
			);
			familyId = family.id;
			const assetRecord = await call(
				appRouter.assetFamilies.createAssetRecord,
				{
					projectId,
					assetFamilyId: family.id,
					name: "East-facing sprite",
					identityCriteria: ["delivery_identity"],
				},
				{ context }
			);
			const firstRevision = await call(
				appRouter.familyReadiness.saveDraft,
				{
					projectId,
					assetFamilyId: family.id,
					items: [
						{
							id: "target-size-backgrounds",
							kind: "usage_test",
							name: "Target sizes and backgrounds",
							disposition: "required",
							assetRecordIds: [assetRecord.id],
							testId: "icon.light_dark_target_size",
						},
					],
				},
				{ context }
			);

			const beforeActivation = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context }
			);
			expect(beforeActivation.status).toBe("not_configured");
			const activated = await call(
				appRouter.familyReadiness.activate,
				{
					projectId,
					assetFamilyId: family.id,
					revisionId: firstRevision.id,
				},
				{ context }
			);
			expect(activated.activeRevision?.id).toBe(firstRevision.id);
			expect(activated.status).toBe("incomplete");
			expect(activated.items[0]?.blockers).toContain("asset_version");

			const secondRevision = await call(
				appRouter.familyReadiness.saveDraft,
				{
					projectId,
					assetFamilyId: family.id,
					items: [],
				},
				{ context }
			);
			const afterDraft = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context }
			);
			expect(afterDraft.activeRevision?.id).toBe(firstRevision.id);
			expect(afterDraft.revisions.at(-1)?.id).toBe(secondRevision.id);
			expect(afterDraft.status).toBe("incomplete");

			await db
				.update(assetRecords)
				.set({ assetCategory: "icon" })
				.where(
					and(
						eq(assetRecords.projectId, projectId),
						eq(assetRecords.id, assetRecord.id)
					)
				);
			assetVersionId = crypto.randomUUID();
			await db.insert(assetVersions).values({
				id: assetVersionId,
				projectId,
				assetRecordId: assetRecord.id,
				assetFamilyId: family.id,
				versionNumber: 2,
				fileName: "east-facing-icon.png",
				contentType: "image/png",
				sourceImageWidth: 1,
				sourceImageHeight: 1,
				sha256: "b".repeat(64),
				byteSize: 1,
				contentDigest: "b".repeat(64),
				integrityVerified: true,
				sourceKind: "manual_import",
				idempotencyKey: crypto.randomUUID(),
				objectKey: `family-readiness/${assetVersionId}.png`,
				createdByUserId: userId,
			});
			const [versionFile] = await db
				.select()
				.from(assetVersions)
				.where(eq(assetVersions.id, assetVersionId));
			if (!versionFile) {
				throw new Error("The measured version file is required.");
			}
			const sourceAssetVersionId = crypto.randomUUID();
			await db.insert(assetVersions).values({
				...versionFile,
				id: sourceAssetVersionId,
				versionNumber: 1,
				idempotencyKey: crypto.randomUUID(),
				objectKey: `family-readiness/${sourceAssetVersionId}.png`,
			});
			const unitVersionId = crypto.randomUUID();
			await db.insert(unitVersions).values({
				id: unitVersionId,
				projectId,
				assetRecordId: assetRecord.id,
				assetVersionId,
				sourceAssetVersionId,
				unitType: "state",
				unitKey: "combat",
				versionNumber: 1,
				createdByUserId: userId,
			});
			const composite = await call(
				appRouter.assetVersions.createCompositeVersion,
				{
					projectId,
					assetRecordId: assetRecord.id,
					unitVersionIds: [unitVersionId],
					idempotencyKey: crypto.randomUUID(),
				},
				{ context }
			);
			const afterFailedEvidence = await call(
				appRouter.familyReadiness.recordEvidence,
				{
					projectId,
					assetFamilyId: family.id,
					revisionId: firstRevision.id,
					itemId: "target-size-backgrounds",
					kind: "usage_test",
					result: "failed",
					testId: "icon.light_dark_target_size",
					method: "Reviewed the icon on light and dark backgrounds.",
					rationale: "The icon is not readable at the smallest target size.",
				},
				{ context }
			);
			expect(afterFailedEvidence.status).toBe("incomplete");
			expect(afterFailedEvidence.items[0]?.blockers).toContain("usage_test");
			await call(
				appRouter.familyReadiness.recordEvidence,
				{
					projectId,
					assetFamilyId: family.id,
					revisionId: firstRevision.id,
					itemId: "target-size-backgrounds",
					kind: "quality",
					result: "passed",
					ruleId: humanReview.id,
					method: "Inspected the icon at its target dimensions.",
					rationale: "The silhouette remains distinct at the smallest size.",
				},
				{ context }
			);
			await expect(
				call(
					appRouter.familyReadiness.recordEvidence,
					{
						projectId,
						assetFamilyId: family.id,
						revisionId: firstRevision.id,
						itemId: "target-size-backgrounds",
						kind: "quality",
						result: "waived",
						ruleId: humanReview.id,
						method: "Tried to waive the required human review.",
						rationale: "Human reviews cannot be waived.",
						observedValue: "waive",
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });

			const rereadDb = createDb({ DATABASE_URL: databaseUrl });
			const rereadContext = createContext(rereadDb, userId);
			const reread = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context: rereadContext }
			);
			expect(reread.activeRevision?.id).toBe(firstRevision.id);
			expect(reread.items[0]?.item.id).toBe("target-size-backgrounds");
			expect(reread.items[0]?.blockers).toContain("usage_test");
			const persistedUsageEvidence = reread.items[0]?.latestEvidence.find(
				(evidence) => evidence.kind === "usage_test"
			);
			expect(persistedUsageEvidence).toMatchObject({
				result: "failed",
				testId: "icon.light_dark_target_size",
				assetVersionIds: [assetVersionId],
				profileContractRevisionIds: [
					activeIconContractRevision.contractRevisionId,
				],
				contextRevisionId: createdProject.currentContextRevision.id,
				isCurrent: true,
			});
			expect(reread.items[0]?.humanReviewRequirements).toContainEqual({
				id: humanReview.id,
				name: humanReview.label,
				required: true,
				result: "passed",
				isCurrent: true,
			});
			const persistedHumanReview = reread.items[0]?.latestEvidence.find(
				(evidence) => evidence.ruleId === humanReview.id
			);
			expect(persistedHumanReview).toMatchObject({
				kind: "quality",
				result: "passed",
				ruleClass: "human_review",
				assetVersionIds: [assetVersionId],
				profileContractRevisionIds: [
					activeIconContractRevision.contractRevisionId,
				],
				contextRevisionId: createdProject.currentContextRevision.id,
				isCurrent: true,
			});
			expect(reread.status).toBe("incomplete");
			const measuredRule = activeIconContractRevision.contract.rules.find(
				(rule) => rule.class === "waivable_requirement"
			);
			if (!measuredRule) {
				throw new Error("The icon contract must contain a measurable rule.");
			}
			const measurementInput = {
				projectId,
				assetFamilyId: family.id,
				revisionId: firstRevision.id,
				itemId: "target-size-backgrounds",
				kind: "quality" as const,
				result: "failed" as const,
				ruleId: measuredRule.id,
				method: "Measured at native scale.",
				rationale: "The measured dimensions exceed the profile tolerance.",
				observedValue: "96%",
				versionTarget: { kind: "unit" as const, id: unitVersionId },
			};
			const measured = await call(
				appRouter.familyReadiness.recordEvidence,
				measurementInput,
				{ context }
			);
			const source = measured.items[0]?.latestEvidence.find(
				(evidence) => evidence.ruleId === measuredRule.id
			);
			if (!source) {
				throw new Error("The failed measurement must be readable.");
			}
			const waiverInput = {
				...measurementInput,
				result: "waived" as const,
				waiverEvidenceId: source.id,
				rationale: "The intentional overflow is accepted for this exact use.",
			};
			await Promise.all(
				[
					{ ...waiverInput, waiverEvidenceId: "unrelated-evidence" },
					{ ...waiverInput, observedValue: "97%" },
					{ ...waiverInput, method: "A different measurement method." },
					{ ...waiverInput, ruleId: humanReview.id },
					{ ...waiverInput, ruleId: "icon.metadata_roundtrip" },
					{ ...waiverInput, ruleId: "icon.readability_advisory" },
					{
						...waiverInput,
						versionTarget: { kind: "unit" as const, id: "foreign-unit" },
					},
					{
						...waiverInput,
						versionTarget: { kind: "composite" as const, id: composite.id },
					},
				].map((invalidInput) =>
					expect(
						call(appRouter.familyReadiness.recordEvidence, invalidInput, {
							context,
						})
					).rejects.toMatchObject({ code: "BAD_REQUEST" })
				)
			);
			await call(appRouter.familyReadiness.recordEvidence, waiverInput, {
				context,
			});
			const waiverReadback = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context: rereadContext }
			);
			expect(waiverReadback.items[0]?.latestEvidence).toContainEqual(
				expect.objectContaining({
					ruleId: source.ruleId,
					ruleClass: "waivable_requirement",
					result: "waived",
					observedValue: source.observedValue,
					method: source.method,
					versionTarget: source.versionTarget,
					assetVersionIds: source.assetVersionIds,
					profileContractRevisionIds: source.profileContractRevisionIds,
					contextRevisionId: source.contextRevisionId,
					canonicalDesignVersionId: source.canonicalDesignVersionId,
					visualWorldId: source.visualWorldId,
					useContext: source.useContext,
					createdByUserId: userId,
					rationale: waiverInput.rationale,
					isCurrent: true,
				})
			);
			expect(waiverReadback.items[0]?.qualityReadiness).toBe("blocked");
			await expect(
				call(appRouter.familyReadiness.recordEvidence, waiverInput, { context })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await Promise.all(
				activeIconContractRevision.contract.rules
					.filter((rule) => rule.id !== measuredRule.id)
					.map((rule) =>
						call(
							appRouter.familyReadiness.recordEvidence,
							{
								...measurementInput,
								ruleId: rule.id,
								result: rule.class === "quality_advisory" ? "failed" : "passed",
							},
							{ context }
						)
					)
			);
			const exceptionsReady = await call(
				appRouter.familyReadiness.recordEvidence,
				{
					projectId,
					assetFamilyId: family.id,
					revisionId: firstRevision.id,
					itemId: "target-size-backgrounds",
					kind: "usage_test",
					result: "passed",
					testId: "icon.light_dark_target_size",
					method: "Inspected on all required backgrounds and target sizes.",
					rationale: "All required usage tests now pass.",
				},
				{ context }
			);
			expect(exceptionsReady.items[0]?.qualityReadiness).toBe(
				"exceptions_ready"
			);
			await db
				.update(familyReadinessEvidence)
				.set({ unitVersionId: null })
				.where(
					and(
						eq(familyReadinessEvidence.assetFamilyId, family.id),
						eq(familyReadinessEvidence.ruleId, measuredRule.id),
						eq(familyReadinessEvidence.result, "waived")
					)
				);
			const legacyWaiver = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context: rereadContext }
			);
			expect(legacyWaiver.items[0]?.qualityReadiness).toBe("blocked");
			expect(legacyWaiver.items[0]?.latestEvidence).toContainEqual(
				expect.objectContaining({
					result: "waived",
					versionTarget: null,
					isCurrent: false,
				})
			);
			const exportReady = await call(
				appRouter.familyReadiness.recordEvidence,
				{
					...measurementInput,
					result: "passed",
				},
				{ context }
			);
			expect(exportReady.items[0]?.qualityReadiness).toBe("export_ready");
			await expect(
				call(appRouter.familyReadiness.recordEvidence, waiverInput, { context })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await Promise.all(
				[{ ...context, session: null }, createContext(db, "foreign-user")].map(
					(deniedContext) =>
						expect(
							call(appRouter.familyReadiness.recordEvidence, waiverInput, {
								context: deniedContext,
							})
						).rejects.toMatchObject({
							code: deniedContext.session ? "BAD_REQUEST" : "UNAUTHORIZED",
						})
				)
			);
			const compositeMeasurement = await call(
				appRouter.familyReadiness.recordEvidence,
				{
					...measurementInput,
					versionTarget: { kind: "composite", id: composite.id },
				},
				{ context }
			);
			const compositeSource =
				compositeMeasurement.items[0]?.latestEvidence.find(
					(evidence) => evidence.ruleId === measuredRule.id
				);
			if (!compositeSource) {
				throw new Error("The composite measurement is required.");
			}
			const compositeWaiver = {
				...waiverInput,
				waiverEvidenceId: compositeSource.id,
				versionTarget: { kind: "composite" as const, id: composite.id },
			};
			await db
				.update(assetFamilies)
				.set({ useContext: "inventory" })
				.where(eq(assetFamilies.id, family.id));
			await expect(
				call(appRouter.familyReadiness.recordEvidence, compositeWaiver, {
					context,
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await db
				.update(assetFamilies)
				.set({ useContext: "combat" })
				.where(eq(assetFamilies.id, family.id));
			const compositeResult = await call(
				appRouter.familyReadiness.recordEvidence,
				compositeWaiver,
				{ context }
			);
			expect(compositeResult.items[0]?.qualityReadiness).toBe("blocked");
			await Promise.all(
				activeIconContractRevision.contract.rules
					.filter((rule) => rule.id !== measuredRule.id)
					.map((rule) =>
						call(
							appRouter.familyReadiness.recordEvidence,
							{
								...measurementInput,
								versionTarget: compositeWaiver.versionTarget,
								ruleId: rule.id,
								result: rule.class === "quality_advisory" ? "failed" : "passed",
							},
							{ context }
						)
					)
			);
			const compositeReady = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context: rereadContext }
			);
			expect(compositeReady.items[0]?.qualityReadiness).toBe(
				"exceptions_ready"
			);
			await call(
				appRouter.assetVersions.createCompositeVersion,
				{
					projectId,
					assetRecordId: assetRecord.id,
					unitVersionIds: [unitVersionId],
					idempotencyKey: crypto.randomUUID(),
				},
				{ context }
			);
			const replacedComposite = await call(
				appRouter.familyReadiness.list,
				{ projectId, assetFamilyId: family.id },
				{ context: rereadContext }
			);
			expect(replacedComposite.items[0]?.qualityReadiness).toBe("blocked");
			expect(replacedComposite.items[0]?.latestEvidence).toContainEqual(
				expect.objectContaining({
					result: "waived",
					versionTarget: { kind: "composite", id: composite.id },
					isCurrent: false,
				})
			);
		} finally {
			if (insertedUser && projectId) {
				if (familyId) {
					await db
						.delete(familyReadinessEvidence)
						.where(
							and(
								eq(familyReadinessEvidence.projectId, projectId),
								eq(familyReadinessEvidence.assetFamilyId, familyId)
							)
						);
					await db
						.delete(familyRequiredSetActivations)
						.where(
							and(
								eq(familyRequiredSetActivations.projectId, projectId),
								eq(familyRequiredSetActivations.assetFamilyId, familyId)
							)
						);
					await db
						.delete(familyRequiredSetHeads)
						.where(eq(familyRequiredSetHeads.projectId, projectId));
					await db
						.delete(familyRequiredSetRevisions)
						.where(
							and(
								eq(familyRequiredSetRevisions.projectId, projectId),
								eq(familyRequiredSetRevisions.assetFamilyId, familyId)
							)
						);
					if (assetVersionId) {
						await db
							.delete(compositeVersionReviewEvents)
							.where(eq(compositeVersionReviewEvents.projectId, projectId));
						await db
							.delete(compositionMemberships)
							.where(eq(compositionMemberships.projectId, projectId));
						await db
							.delete(compositeVersions)
							.where(eq(compositeVersions.projectId, projectId));
						await db
							.delete(unitVersions)
							.where(eq(unitVersions.projectId, projectId));
						await db
							.delete(assetVersions)
							.where(eq(assetVersions.projectId, projectId));
					}
					await db
						.delete(assetRecords)
						.where(
							and(
								eq(assetRecords.projectId, projectId),
								eq(assetRecords.assetFamilyId, familyId)
							)
						);
					await db
						.delete(assetFamilies)
						.where(
							and(
								eq(assetFamilies.projectId, projectId),
								eq(assetFamilies.id, familyId)
							)
						);
				}
				await db
					.delete(projectSpecializedProfileContracts)
					.where(eq(projectSpecializedProfileContracts.projectId, projectId));
				await db
					.delete(subjectIdentities)
					.where(eq(subjectIdentities.projectId, projectId));
				await db
					.delete(visualWorlds)
					.where(eq(visualWorlds.projectId, projectId));
				await db
					.delete(contextRevisions)
					.where(eq(contextRevisions.projectId, projectId));
				await db.delete(project).where(eq(project.id, projectId));
				await db.delete(user).where(eq(user.id, userId));
			} else if (insertedUser) {
				await db.delete(user).where(eq(user.id, userId));
			}
		}
	}
);
