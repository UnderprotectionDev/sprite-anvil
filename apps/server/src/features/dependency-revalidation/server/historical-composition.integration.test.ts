import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import { relations } from "@sprite-anvil/db/relations";
import { assetFamilyCanonicalDesigns } from "@sprite-anvil/db/schema/asset-families";
import {
	assetFamilies,
	assetRecords,
	subjectIdentities,
} from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersionReviewEvents,
	assetVersions,
	compositeVersionReviewEvents,
	compositeVersions,
	compositionMemberships,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { dependencyLinks } from "@sprite-anvil/db/schema/dependency-revalidation";
import {
	familyReadinessEvidence,
	familyRequiredSetRevisions,
} from "@sprite-anvil/db/schema/family-readiness";
import { project } from "@sprite-anvil/db/schema/project";
import { contextRevisions } from "@sprite-anvil/db/schema/project-context";
import { specializedProfileContractRevisions } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { SQL } from "bun";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createDependencyRevalidationStore } from "./dependency-revalidation-store";

const databaseUrl = process.env.DEPENDENCY_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"pins an exact historical Composite Version and rereads its blockers without clearing current Revalidation Required",
	async () => {
		if (!databaseUrl) {
			throw new Error("DEPENDENCY_TEST_DATABASE_URL is required.");
		}
		const pool = new SQL(databaseUrl);
		const database = drizzle({
			client: pool,
			relations,
		}) as unknown as Database;
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const identityId = crypto.randomUUID();
		const recordId = crypto.randomUUID();
		const canonicalId = crypto.randomUUID();
		const versionId = crypto.randomUUID();
		const unitId = crypto.randomUUID();
		const compositeId = crypto.randomUUID();
		const contextId = crypto.randomUUID();
		await database.insert(user).values({
			id: userId,
			name: "Historical User",
			email: `${userId}@example.test`,
		});
		await database.insert(project).values({
			id: projectId,
			name: "Historical Combat",
			ownerUserId: userId,
		});
		await database.insert(visualWorlds).values({
			id: worldId,
			projectId,
			name: "Gameplay",
			createdByUserId: userId,
		});
		await database.insert(subjectIdentities).values({
			id: identityId,
			projectId,
			name: "Knight",
			createdByUserId: userId,
		});
		await database.insert(assetFamilies).values({
			id: familyId,
			projectId,
			visualWorldId: worldId,
			subjectIdentityId: identityId,
			name: "Combat",
			useContext: "combat",
			createdByUserId: userId,
		});
		await database.insert(assetRecords).values({
			id: recordId,
			projectId,
			assetFamilyId: familyId,
			name: "Ash Knight idle",
			assetCategory: "character_creature_animation",
			supportLevel: "general",
			availability: "active",
			createdByUserId: userId,
		});
		await database.insert(assetVersions).values(
			[canonicalId, versionId].map((id, index) => ({
				id,
				projectId,
				assetFamilyId: familyId,
				assetRecordId: recordId,
				versionNumber: index + 1,
				sourceKind:
					index === 0 ? ("manual_import" as const) : ("derived" as const),
				contentType: "image/png" as const,
				byteSize: 1,
				objectKey: `${projectId}/${id}`,
				createdByUserId: userId,
			}))
		);
		await database.insert(assetFamilyCanonicalDesigns).values({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId: familyId,
			assetRecordId: recordId,
			assetVersionId: canonicalId,
			createdByUserId: userId,
		});
		await database.insert(contextRevisions).values({
			id: contextId,
			projectId,
			revisionNumber: 1,
			state: "active",
			contractVersion: "1",
			rules: [],
			createdByUserId: userId,
		});
		await database.insert(unitVersions).values({
			id: unitId,
			projectId,
			assetRecordId: recordId,
			assetVersionId: versionId,
			sourceAssetVersionId: canonicalId,
			unitType: "frame",
			unitKey: "idle-1",
			versionNumber: 1,
			createdByUserId: userId,
		});
		await database.insert(compositeVersions).values({
			id: compositeId,
			projectId,
			assetRecordId: recordId,
			versionNumber: 1,
			idempotencyKey: crypto.randomUUID(),
			createdByUserId: userId,
		});
		await database.insert(compositionMemberships).values({
			id: crypto.randomUUID(),
			projectId,
			assetRecordId: recordId,
			compositeVersionId: compositeId,
			unitVersionId: unitId,
			unitType: "frame",
			unitKey: "idle-1",
		});
		const context = {
			dependencyRevalidationStore: createDependencyRevalidationStore(database),
			session: { user: { id: userId } },
			verifyAssetVersionContent: async () => false,
		} as unknown as Context;
		try {
			const impact = await call(
				appRouter.dependencyRevalidation.determine,
				{
					projectId,
					source: { kind: "context_revision", id: contextId },
					facets: ["palette"],
				},
				{ context }
			);
			const input = {
				projectId,
				idempotencyKey: crypto.randomUUID(),
				compositeVersionId: compositeId,
				contextRevisionId: contextId,
				canonicalDesignVersionId: canonicalId,
				dependencyLinkIds: [],
				dependencyVersionIds: [],
				readinessEvidenceIds: [],
				profileContractRevisionIds: [],
				reviewEventIds: [],
			};
			const pin = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				input,
				{ context }
			);
			expect(pin.selection).toEqual(input);
			expect(pin.unitVersionIds).toEqual([unitId]);
			expect(pin.report.exportEligible).toBe(false);
			expect(pin.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "integrity" }),
					expect.objectContaining({ code: "dependency" }),
					expect.objectContaining({ code: "quality_contract" }),
				])
			);
			const otherPool = new SQL(databaseUrl);
			try {
				const otherDatabase = drizzle({
					client: otherPool,
					relations,
				}) as unknown as Database;
				const reopened = await call(
					appRouter.dependencyRevalidation.listHistoricalCompositions,
					{ projectId },
					{
						context: {
							...context,
							dependencyRevalidationStore:
								createDependencyRevalidationStore(otherDatabase),
						},
					}
				);
				expect(reopened.pins).toEqual([pin]);
			} finally {
				await otherPool.close();
			}
			expect(
				await call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					input,
					{ context }
				)
			).toEqual(pin);
			await expect(
				call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					{ ...input, dependencyVersionIds: [canonicalId] },
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			const catalog = await call(
				appRouter.dependencyRevalidation.list,
				{ projectId },
				{ context }
			);
			expect(catalog.changeImpacts).toEqual([impact]);
			expect(catalog.revalidationRequiredVersionIds).toContain(versionId);
			await expect(
				call(
					appRouter.dependencyRevalidation.listHistoricalCompositions,
					{ projectId },
					{ context: { ...context, session: null } }
				)
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
			await expect(
				call(
					appRouter.dependencyRevalidation.listHistoricalCompositions,
					{ projectId },
					{
						context: {
							...context,
							session: { user: { id: "other-user" } },
						} as unknown as Context,
					}
				)
			).rejects.toMatchObject({ code: "NOT_FOUND" });
			await expect(
				call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					{
						...input,
						idempotencyKey: crypto.randomUUID(),
						readinessEvidenceIds: ["foreign-evidence"],
					},
					{ context }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			const contract = getSpecializedProfileContract(
				"character_creature_animation"
			);
			if (!contract) {
				throw new Error("Missing character contract.");
			}
			const contractId = `${contract.profileId}@${contract.version}`;
			await database
				.insert(specializedProfileContractRevisions)
				.values({
					id: contractId,
					profileId: contract.profileId,
					contractSchemaVersion: contract.contractSchemaVersion,
					contractVersion: contract.version,
					definition: contract,
				})
				.onConflictDoNothing();
			const revisionId = crypto.randomUUID();
			await database.insert(familyRequiredSetRevisions).values({
				id: revisionId,
				projectId,
				assetFamilyId: familyId,
				revisionNumber: 1,
				items: [
					{
						id: "idle",
						kind: "animation",
						name: "Idle",
						disposition: "required",
						assetRecordIds: [recordId],
					},
				],
				createdByUserId: userId,
			});
			const rows: (typeof familyReadinessEvidence.$inferInsert)[] = [
				canonicalId,
				versionId,
			].flatMap((assetVersionId) => {
				const scope = {
					projectId,
					assetFamilyId: familyId,
					revisionId,
					itemId: "idle",
					assetVersionIds: [assetVersionId],
					profileContractRevisionIds: [contractId],
					contextRevisionId: contextId,
					visualWorldId: worldId,
					useContext: "combat",
					canonicalDesignVersionId: canonicalId,
					rationale: "Historical scope",
					createdByUserId: userId,
				};
				return [
					{
						...scope,
						id: crypto.randomUUID(),
						kind: "applicability",
						result: "applicable",
					},
					...contract.rules.map((rule) => ({
						...scope,
						id: crypto.randomUUID(),
						kind: "quality" as const,
						result: "passed" as const,
						ruleId: rule.id,
						ruleClass: rule.class,
						method: "Measured",
						observedValue: "0",
					})),
					...contract.humanReviews.map((review) => ({
						...scope,
						id: crypto.randomUUID(),
						kind: "quality" as const,
						result: "passed" as const,
						ruleId: review.id,
						ruleClass: "human_review" as const,
						method: "User review",
					})),
					...contract.usageTests.map((usage) => ({
						...scope,
						id: crypto.randomUUID(),
						kind: "usage_test" as const,
						result: "passed" as const,
						testId: usage.id,
						method: "Usage test",
					})),
				];
			});
			await database.insert(familyReadinessEvidence).values(rows);
			await database
				.update(assetVersions)
				.set({ integrityVerified: true, contentDigest: "a".repeat(64) })
				.where(inArray(assetVersions.id, [canonicalId, versionId]));
			const linkId = crypto.randomUUID();
			await database.insert(dependencyLinks).values({
				id: linkId,
				projectId,
				sourceAssetVersionId: canonicalId,
				targetAssetVersionId: versionId,
				facets: ["palette"],
				createdByUserId: userId,
			});
			const assetReviews = [canonicalId, versionId].map((version) => ({
				id: crypto.randomUUID(),
				projectId,
				assetRecordId: recordId,
				versionId: version,
				decision: "approved" as const,
				createdByUserId: userId,
			}));
			await database.insert(assetVersionReviewEvents).values(assetReviews);
			const compositeReviewId = crypto.randomUUID();
			await database.insert(compositeVersionReviewEvents).values({
				id: compositeReviewId,
				projectId,
				assetRecordId: recordId,
				compositeVersionId: compositeId,
				decision: "approved",
				createdByUserId: userId,
			});
			const completeInput = {
				...input,
				idempotencyKey: crypto.randomUUID(),
				dependencyLinkIds: [linkId],
				readinessEvidenceIds: rows.map((row) => row.id),
				profileContractRevisionIds: [contractId],
				reviewEventIds: [
					...assetReviews.map((review) => review.id),
					compositeReviewId,
				],
			};
			const verifiedContext = {
				...context,
				verifyAssetVersionContent: async () => true,
			};
			const ready = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				completeInput,
				{ context: verifiedContext }
			);
			expect(ready.report).toEqual({
				mode: "historical",
				exportEligible: true,
				blockers: [],
			});
			const additionalVersions = Array.from({ length: 255 }, (_, index) => ({
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId: familyId,
				assetRecordId: recordId,
				versionNumber: index + 3,
				sourceKind: "manual_import" as const,
				contentType: "image/png" as const,
				byteSize: 1,
				objectKey: `${projectId}/additional-${index}`,
				createdByUserId: userId,
			}));
			await database.insert(assetVersions).values(additionalVersions);
			await expect(
				call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					{
						...completeInput,
						idempotencyKey: crypto.randomUUID(),
						dependencyVersionIds: additionalVersions.map(
							(version) => version.id
						),
					},
					{ context: verifiedContext }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(
				(
					await call(
						appRouter.dependencyRevalidation.list,
						{ projectId },
						{ context }
					)
				).revalidationRequiredVersionIds
			).toContain(versionId);
			const missingEvidence = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...completeInput,
					idempotencyKey: crypto.randomUUID(),
					readinessEvidenceIds: [],
				},
				{ context: verifiedContext }
			);
			expect(missingEvidence.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "quality" }),
					expect.objectContaining({ code: "applicability" }),
				])
			);
			const wrongContextId = crypto.randomUUID();
			await database.insert(contextRevisions).values({
				id: wrongContextId,
				projectId,
				revisionNumber: 2,
				state: "inactive",
				contractVersion: "1",
				rules: [],
				createdByUserId: userId,
			});
			const laterContextLinkId = crypto.randomUUID();
			await database.insert(dependencyLinks).values({
				id: laterContextLinkId,
				projectId,
				sourceContextRevisionId: wrongContextId,
				targetAssetVersionId: versionId,
				facets: ["palette"],
				createdByUserId: userId,
			});
			const historicalContextOnly = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{ ...completeInput, idempotencyKey: crypto.randomUUID() },
				{ context: verifiedContext }
			);
			expect(historicalContextOnly.report.exportEligible).toBe(true);
			const selectedLaterContext = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...completeInput,
					idempotencyKey: crypto.randomUUID(),
					dependencyLinkIds: [linkId, laterContextLinkId],
				},
				{ context: verifiedContext }
			);
			expect(selectedLaterContext.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "dependency" }),
				])
			);
			const wrongScope = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...completeInput,
					idempotencyKey: crypto.randomUUID(),
					contextRevisionId: wrongContextId,
				},
				{ context: verifiedContext }
			);
			expect(wrongScope.report.exportEligible).toBe(false);
			const omittedDependency = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...completeInput,
					idempotencyKey: crypto.randomUUID(),
					dependencyLinkIds: [],
				},
				{ context: verifiedContext }
			);
			expect(omittedDependency.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "dependency" }),
				])
			);
			const scope = rows.find(
				(row) =>
					row.kind === "applicability" &&
					row.assetVersionIds.includes(versionId)
			);
			if (!scope) {
				throw new Error("Missing applicability fixture.");
			}
			const negativeId = crypto.randomUUID();
			await database.insert(familyReadinessEvidence).values({
				...scope,
				id: negativeId,
				result: "inapplicable",
				createdAt: new Date("2027-01-01T00:00:00Z"),
			});
			const conflict = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...completeInput,
					idempotencyKey: crypto.randomUUID(),
					readinessEvidenceIds: [
						...completeInput.readinessEvidenceIds,
						negativeId,
					],
				},
				{ context: verifiedContext }
			);
			expect(conflict.report.exportEligible).toBe(false);
			expect(conflict.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "applicability" }),
				])
			);
			const waivableRule = contract.rules.find(
				(rule) =>
					rule.class === "waivable_requirement" && rule.waiverEligibility
			);
			const qualityScope = rows.find(
				(row) =>
					row.ruleId === waivableRule?.id &&
					row.assetVersionIds.includes(versionId)
			);
			if (!(waivableRule && qualityScope)) {
				throw new Error("Missing waivable requirement fixture.");
			}
			const waivers = [
				{ unitVersionId: unitId },
				{ compositeVersionId: compositeId },
			].map((target) => ({
				...qualityScope,
				...target,
				id: crypto.randomUUID(),
				result: "waived" as const,
				observedValue: "Intentional offset",
			}));
			await database.insert(familyReadinessEvidence).values(waivers);
			const waiverInput = {
				...completeInput,
				idempotencyKey: crypto.randomUUID(),
				readinessEvidenceIds: [
					...rows
						.filter((row) => row.id !== qualityScope.id)
						.map((row) => row.id),
					...waivers.map((waiver) => waiver.id),
				],
			};
			const waived = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				waiverInput,
				{ context: verifiedContext }
			);
			expect(waived.report.exportEligible).toBe(true);
			const waiverWithoutApplicability = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...waiverInput,
					idempotencyKey: crypto.randomUUID(),
					readinessEvidenceIds: waiverInput.readinessEvidenceIds.filter(
						(id) => id !== scope.id
					),
				},
				{ context: verifiedContext }
			);
			expect(waiverWithoutApplicability.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "applicability" }),
				])
			);
			const failedContent = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{ ...completeInput, idempotencyKey: crypto.randomUUID() },
				{ context }
			);
			expect(failedContent.report.exportEligible).toBe(false);
			const noCompositeReview = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...completeInput,
					idempotencyKey: crypto.randomUUID(),
					reviewEventIds: assetReviews.map((review) => review.id),
				},
				{ context: verifiedContext }
			);
			expect(noCompositeReview.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: "approval", targetId: compositeId }),
				])
			);
			const repeatInput = {
				...completeInput,
				idempotencyKey: crypto.randomUUID(),
			};
			const repeated = await Promise.all([
				call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					repeatInput,
					{ context: verifiedContext }
				),
				call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					repeatInput,
					{ context: verifiedContext }
				),
			]);
			expect(repeated[0]).toEqual(repeated[1]);
			await expect(
				call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					{
						...completeInput,
						idempotencyKey: crypto.randomUUID(),
						dependencyLinkIds: [linkId, linkId],
					},
					{ context: verifiedContext }
				)
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				call(
					appRouter.dependencyRevalidation.pinHistoricalComposition,
					{ ...completeInput, idempotencyKey: crypto.randomUUID() },
					{
						context: {
							...verifiedContext,
							verifyAssetVersionContent: () =>
								Promise.reject(new Error("storage unreachable")),
						},
					}
				)
			).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
			const freshCompositeId = crypto.randomUUID();
			const replacementUnitId = crypto.randomUUID();
			const [replacementVersion] = additionalVersions;
			if (!replacementVersion) {
				throw new Error("Missing replacement version fixture.");
			}
			await database.insert(unitVersions).values({
				id: replacementUnitId,
				projectId,
				assetRecordId: recordId,
				assetVersionId: replacementVersion.id,
				sourceAssetVersionId: versionId,
				unitType: "frame",
				unitKey: "idle-1",
				versionNumber: 2,
				createdByUserId: userId,
			});
			await database.insert(compositeVersions).values({
				id: freshCompositeId,
				projectId,
				assetRecordId: recordId,
				versionNumber: 2,
				idempotencyKey: crypto.randomUUID(),
				createdByUserId: userId,
			});
			await database.insert(compositionMemberships).values({
				id: crypto.randomUUID(),
				projectId,
				assetRecordId: recordId,
				compositeVersionId: freshCompositeId,
				unitVersionId: replacementUnitId,
				unitType: "frame",
				unitKey: "idle-1",
			});
			const preserved = await call(
				appRouter.dependencyRevalidation.listHistoricalCompositions,
				{ projectId },
				{ context }
			);
			expect(preserved.pins.find((entry) => entry.id === ready.id)).toEqual(
				ready
			);
			expect(preserved.pins.find((entry) => entry.id === pin.id)).toEqual(pin);
			const [intermediateVersion, upstreamVersion] = additionalVersions;
			if (!(intermediateVersion && upstreamVersion)) {
				throw new Error("Missing transitive dependency fixtures.");
			}
			const chainLinks = [
				{ source: intermediateVersion.id, target: versionId },
				{ source: upstreamVersion.id, target: intermediateVersion.id },
				{ source: canonicalId, target: upstreamVersion.id },
			].map((link) => ({
				id: crypto.randomUUID(),
				projectId,
				sourceAssetVersionId: link.source,
				targetAssetVersionId: link.target,
				facets: ["palette"],
				createdByUserId: userId,
			}));
			await database.insert(dependencyLinks).values(chainLinks);
			const chainInput = {
				...completeInput,
				idempotencyKey: crypto.randomUUID(),
				dependencyVersionIds: [intermediateVersion.id, upstreamVersion.id],
				dependencyLinkIds: [linkId, ...chainLinks.map((link) => link.id)],
			};
			const closedChain = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				chainInput,
				{ context: verifiedContext }
			);
			expect(closedChain.assetVersionIds).toEqual(
				expect.arrayContaining([
					canonicalId,
					versionId,
					intermediateVersion.id,
					upstreamVersion.id,
				])
			);
			expect(
				closedChain.report.blockers.filter(
					(blocker) => blocker.code === "dependency"
				)
			).toEqual([]);
			const missingUpstream = await call(
				appRouter.dependencyRevalidation.pinHistoricalComposition,
				{
					...chainInput,
					idempotencyKey: crypto.randomUUID(),
					dependencyVersionIds: [intermediateVersion.id],
					dependencyLinkIds: chainLinks
						.filter((link) => link.targetAssetVersionId !== upstreamVersion.id)
						.map((link) => link.id)
						.concat(linkId),
				},
				{ context: verifiedContext }
			);
			expect(missingUpstream.report.blockers).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						code: "dependency",
						targetId: intermediateVersion.id,
					}),
				])
			);
			await expect(
				call(
					appRouter.dependencyRevalidation.historicalCompositionOptions,
					{ projectId },
					{ context: { ...context, session: null } }
				)
			).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		} finally {
			await pool.close();
		}
	}
);
