import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";
import {
	sourceMetadataMappingContractVersion,
	sourceMetadataMappingProposalSchema,
} from "@sprite-anvil/api/source-metadata-mapping";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import {
	assetVersions,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import { gameplayMetadataRecords } from "@sprite-anvil/db/schema/gameplay-metadata";
import { importInboxEntries } from "@sprite-anvil/db/schema/import-inbox";
import { project } from "@sprite-anvil/db/schema/project";
import {
	sourceMetadataMappingFinalizations,
	sourceMetadataMappingProposals,
} from "@sprite-anvil/db/schema/source-metadata-mapping";
import { projectSpecializedProfileContracts } from "@sprite-anvil/db/schema/specialized-profile-contracts";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { createGameplayMetadataStore } from "./features/gameplay-metadata/server/gameplay-metadata-store";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";

const databaseUrl = process.env.GAMEPLAY_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"persists exact-frame Gameplay Metadata in PostgreSQL and verifies replay, source finalization and owner isolation",
	async () => {
		if (!databaseUrl) {
			throw new Error("GAMEPLAY_TEST_DATABASE_URL is required.");
		}
		const connection = new SQL(databaseUrl);
		const secondConnection = new SQL(databaseUrl);
		const db = drizzle({ client: connection }) as unknown as Database;
		const rereadDb = drizzle({
			client: secondConnection,
		}) as unknown as Database;
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const assetRecordId = crypto.randomUUID();
		const sourceVersionId = crypto.randomUUID();
		const assetVersionId = crypto.randomUUID();
		const proposalId = crypto.randomUUID();
		const sourceEntryId = crypto.randomUUID();
		const sidecarId = crypto.randomUUID();
		const [contract] = specializedProfileContractCatalog;
		if (!contract) {
			throw new Error("Character contract is required.");
		}
		const context = {
			session: { user: { id: userId } },
			gameplayMetadataStore: createGameplayMetadataStore(db),
			specializedProfileContractStore:
				createSpecializedProfileContractStore(db),
		} as Context;
		try {
			await db.insert(user).values({
				id: userId,
				name: "Gameplay Metadata Test",
				email: `gameplay-${userId}@example.test`,
			});
			await db.insert(project).values({
				id: projectId,
				ownerUserId: userId,
				name: "Gameplay Metadata Test",
			});
			await db.insert(assetRecords).values({
				id: assetRecordId,
				projectId,
				createdByUserId: userId,
				name: "Walk cycle",
				supportLevel: "general",
				availability: "active",
			});
			await db.insert(assetVersions).values([
				{
					id: sourceVersionId,
					projectId,
					assetRecordId,
					versionNumber: 1,
					contentType: "image/png",
					byteSize: 91,
					objectKey: `test/${sourceVersionId}`,
					createdByUserId: userId,
				},
				{
					id: assetVersionId,
					projectId,
					assetRecordId,
					versionNumber: 2,
					contentType: "image/png",
					byteSize: 91,
					objectKey: `test/${assetVersionId}`,
					createdByUserId: userId,
				},
			]);
			await db.insert(unitVersions).values({
				id: crypto.randomUUID(),
				projectId,
				assetRecordId,
				assetVersionId,
				sourceAssetVersionId: sourceVersionId,
				unitType: "frame",
				unitKey: "walk-0",
				versionNumber: 1,
				createdByUserId: userId,
			});
			await context.specializedProfileContractStore?.activate(
				userId,
				projectId,
				contract.profileId,
				contract
			);
			const request = {
				id: crypto.randomUUID(),
				projectId,
				assetRecordId,
				assetVersionId,
				frameKey: "walk-0",
				useContext: "walk east",
				profileId: contract.profileId,
				contractRevisionId: `${contract.profileId}@${contract.version}`,
				fields: [
					{
						fieldId: "pivot" as const,
						source: { kind: "authored" as const, value: { x: 12, y: 24 } },
					},
				],
			};
			const saved = await call(appRouter.gameplayMetadata.write, request, {
				context,
			});
			const rereadContext = {
				...context,
				gameplayMetadataStore: createGameplayMetadataStore(rereadDb),
			};
			const reread = await call(
				appRouter.gameplayMetadata.list,
				{ projectId, assetRecordId },
				{ context: rereadContext }
			);
			expect(reread.records).toEqual([saved]);
			expect(
				await call(appRouter.gameplayMetadata.write, request, { context })
			).toEqual(saved);
			await expect(
				call(
					appRouter.gameplayMetadata.write,
					{ ...request, useContext: "attack" },
					{ context }
				)
			).rejects.toMatchObject({ code: "CONFLICT" });
			expect(
				await context.gameplayMetadataStore?.list(
					"other-owner",
					projectId,
					assetRecordId
				)
			).toBeNull();

			await db.insert(importInboxEntries).values([
				{
					id: sourceEntryId,
					projectId,
					fileName: "walk.png",
					sourceContentType: "image/png",
					contentLength: 91,
					sha256: "a".repeat(64),
					objectKey: `test/${sourceEntryId}`,
					createdByUserId: userId,
				},
				{
					id: sidecarId,
					projectId,
					fileName: "walk.json",
					sourceContentType: "application/json",
					contentLength: 91,
					sha256: "b".repeat(64),
					objectKey: `test/${sidecarId}`,
					createdByUserId: userId,
				},
			]);
			const fieldSource = {
				key: "idle-0",
				sourceEntryId: sidecarId,
				sourceFileName: "walk.json",
				sourceFormat: "aseprite",
				sourcePath: "frames[0]",
			};
			const proposal = sourceMetadataMappingProposalSchema.parse({
				id: proposalId,
				projectId,
				createdAt: new Date().toISOString(),
				contractVersion: sourceMetadataMappingContractVersion,
				diagnostics: [],
				conflicts: [],
				fields: [
					{
						...fieldSource,
						field: "frame",
						value: { x: 0, y: 0, w: 32, h: 32 },
					},
					{
						...fieldSource,
						field: "pivot",
						sourcePath: "frames[0].pivot",
						value: { x: 4, y: 18 },
					},
				],
				source: {
					entryId: sourceEntryId,
					fileName: "walk.png",
					sha256: "a".repeat(64),
				},
				sidecars: [
					{
						entryId: sidecarId,
						fileName: "walk.json",
						format: "aseprite",
						jsonLayout: "array",
						sha256: "b".repeat(64),
						version: "1.3",
					},
				],
				suggestions: {
					assetFamilyLinks: { status: "unknown", reason: "no-source-evidence" },
					requiredSetLinks: { status: "unknown", reason: "no-source-evidence" },
					gameplayMetadata: {
						status: "unknown",
						reason: "project-context-required",
					},
				},
			});
			await db.insert(sourceMetadataMappingProposals).values({
				id: proposalId,
				projectId,
				sourceEntryId,
				proposal,
				createdByUserId: userId,
			});
			await db.insert(sourceMetadataMappingFinalizations).values({
				proposalId,
				projectId,
				assetRecordId,
				assetVersionId: sourceVersionId,
				decisions: [],
				status: "pending",
				createdByUserId: userId,
			});
			const pendingCatalog = await call(
				appRouter.gameplayMetadata.list,
				{ projectId, assetRecordId },
				{ context }
			);
			expect(pendingCatalog.frames).toHaveLength(1);
			await db
				.update(sourceMetadataMappingFinalizations)
				.set({ status: "completed" })
				.where(eq(sourceMetadataMappingFinalizations.proposalId, proposalId));
			const finalizedCatalog = await call(
				appRouter.gameplayMetadata.list,
				{ projectId, assetRecordId },
				{ context }
			);
			expect(finalizedCatalog.frames).toContainEqual({
				assetVersionId: sourceVersionId,
				frameKey: "idle-0",
				sourcePivots: [
					{
						kind: "finalized_source",
						proposalId,
						sourceEntryId: sidecarId,
						sourcePath: "frames[0].pivot",
						value: { x: 4, y: 18 },
					},
				],
			});
			const imported = await call(
				appRouter.gameplayMetadata.write,
				{
					...request,
					id: crypto.randomUUID(),
					assetVersionId: sourceVersionId,
					frameKey: "idle-0",
					fields: [
						{
							fieldId: "pivot",
							source: {
								kind: "finalized_source",
								proposalId,
								sourceEntryId: sidecarId,
								sourcePath: "frames[0].pivot",
							},
						},
					],
				},
				{ context }
			);
			expect(imported.fields).toContainEqual({
				fieldId: "pivot",
				value: { x: 4, y: 18 },
				source: {
					kind: "finalized_source",
					proposalId,
					sourceEntryId: sidecarId,
					sourcePath: "frames[0].pivot",
				},
				unit: "px",
				coordinateSystem: "source_image_top_left",
			});
		} finally {
			await db
				.delete(gameplayMetadataRecords)
				.where(eq(gameplayMetadataRecords.projectId, projectId));
			await db
				.delete(sourceMetadataMappingFinalizations)
				.where(eq(sourceMetadataMappingFinalizations.projectId, projectId));
			await db
				.delete(sourceMetadataMappingProposals)
				.where(eq(sourceMetadataMappingProposals.projectId, projectId));
			await db
				.delete(importInboxEntries)
				.where(eq(importInboxEntries.projectId, projectId));
			await db
				.delete(unitVersions)
				.where(eq(unitVersions.projectId, projectId));
			await db
				.delete(assetVersions)
				.where(eq(assetVersions.projectId, projectId));
			await db
				.delete(projectSpecializedProfileContracts)
				.where(eq(projectSpecializedProfileContracts.projectId, projectId));
			await db
				.delete(assetRecords)
				.where(eq(assetRecords.projectId, projectId));
			await db.delete(project).where(eq(project.id, projectId));
			await db.delete(user).where(eq(user.id, userId));
			await Promise.all([connection.close(), secondConnection.close()]);
		}
	}
);
