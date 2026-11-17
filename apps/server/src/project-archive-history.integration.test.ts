import { expect, test } from "bun:test";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import type { Database } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { user } from "@sprite-anvil/db/schema/auth";
import { generationPackages } from "@sprite-anvil/db/schema/generation-packages";
import { project } from "@sprite-anvil/db/schema/project";
import {
	createLocalTestDb,
	isLoopbackTestDatabaseUrl,
} from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { insertArchiveHistory } from "./features/project-archives/server/project-archive-history-materialization";
import type { StoredProjectArchiveRestoreRecord } from "./features/project-archives/server/project-archive-restore-storage";
import { createSpecializedProfileContractStore } from "./features/quality-evidence/server/specialized-profile-contract-store";
import { createRightsRecordStore } from "./features/rights-evidence/server/rights-record-store";
import { canonicalDatabaseVerifier } from "./project-archive-canonical-database-verifier";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"materializes profile activation and generation snapshot in one rollback-safe transaction",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const definition = getSpecializedProfileContract("icon");
		if (!definition) {
			throw new Error("Icon profile contract missing");
		}
		const contractId = `${definition.profileId}@${definition.version}`;
		const projectId = crypto.randomUUID();
		const userId = crypto.randomUUID();
		const assetId = crypto.randomUUID();
		const packageId = crypto.randomUUID();
		const rightsId = crypto.randomUUID();
		const at = "2026-01-01T00:00:00.000Z";
		const section = (name: string, rows: unknown[]) => ({
			group: "history",
			name,
			records: rows,
			recordCount: rows.length,
			digest: "d",
			sourceDigest: "d",
		});
		const record: StoredProjectArchiveRestoreRecord = {
			files: [
				{
					kind: "rights_evidence_file",
					sourceId: rightsId,
					restoredId: rightsId,
					assetRecordId: assetId,
					assetVersionId: null,
					byteSize: 100,
					sha256: "a".repeat(64),
					contentType: "application/pdf",
					fileName: "proof.pdf",
					presence: "excluded",
					exclusionReason: "evidence_not_archived",
					objectKey: null,
				},
			],
			ids: [],
			projectName: "Restored",
			restore: {
				archiveId: "archive",
				createdAt: new Date(at),
				createdByUserId: userId,
				id: "restore",
				manifestDigest: "digest",
				requestDigest: "request",
				restoredProjectId: projectId,
				sourceProjectId: "source",
			},
			sections: [
				section("rightsRecords", [
					{
						id: rightsId,
						assetRecordId: assetId,
						referenceId: null,
						versionNumber: 1,
						state: "documented",
						assertedScope: null,
						evidence: null,
						evidenceFile: {
							byteSize: 100,
							contentType: "application/pdf",
							fileName: "proof.pdf",
							sha256: "a".repeat(64),
						},
						restrictions: null,
						rightsHolderOrProvider: null,
						source: null,
						uncertainty: null,
						createdAt: at,
					},
				]),
				section("generationPackages", [
					{
						id: packageId,
						assetRecordId: assetId,
						snapshot: { instruction: "restored" },
						createdAt: at,
					},
				]),
				section("contractRevisions", [
					{
						id: contractId,
						profileId: definition.profileId,
						contractSchemaVersion: definition.contractSchemaVersion,
						contractVersion: definition.version,
						definition,
						createdAt: at,
					},
				]),
				section("contractActivations", [
					{
						id: contractId,
						profileId: definition.profileId,
						contractRevisionId: contractId,
						activatedAt: at,
					},
				]),
			],
		};
		const rollback = new Error("deliberate rollback");
		try {
			await expect(
				db.transaction(async (tx) => {
					await tx.insert(user).values({
						id: userId,
						name: "Archive test",
						email: `${userId}@example.test`,
					});
					await tx
						.insert(project)
						.values({ id: projectId, ownerUserId: userId, name: "Restored" });
					await tx.insert(assetRecords).values({
						id: assetId,
						projectId,
						createdByUserId: userId,
						name: "Hero",
						supportLevel: "general",
						availability: "active",
					});
					await insertArchiveHistory(tx, record);
					expect(
						await canonicalDatabaseVerifier(tx as unknown as Database)(record)
					).toEqual([]);
					const [restored] = await tx
						.select()
						.from(generationPackages)
						.where(eq(generationPackages.id, packageId));
					expect(restored).toMatchObject({
						projectId,
						assetRecordId: assetId,
						snapshot: { instruction: "restored" },
					});
					expect(
						await createSpecializedProfileContractStore(
							tx as unknown as Database
						).getActive(userId, projectId, "icon")
					).toMatchObject({
						contractRevisionId: contractId,
						projectId,
						contract: definition,
					});
					expect(
						await createRightsRecordStore(tx as unknown as Database).list(
							userId,
							projectId,
							assetId,
							null
						)
					).toMatchObject([
						{
							id: rightsId,
							evidenceFile: {
								availability: "excluded",
								fileName: "proof.pdf",
								sha256: "a".repeat(64),
							},
						},
					]);
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.close();
		}
	}
);

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"keeps the latest normal Asset Version disposition when archived review timestamps tie",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const { historySource } = await import(
			"./features/project-archives/server/tests/project-archive-history-fixtures"
		);
		const { ids, projectId: sourceProjectId } = await import(
			"./features/project-archives/server/tests/project-archive-fixtures"
		);
		const { restoreSetup } = await import(
			"./features/project-archives/server/tests/project-archive-restore-fixtures"
		);
		const { visualWorlds } = await import(
			"@sprite-anvil/db/schema/context-scopes"
		);
		const { assetFamilies } = await import(
			"@sprite-anvil/db/schema/asset-records"
		);
		const { assetVersions } = await import(
			"@sprite-anvil/db/schema/asset-versions"
		);
		const { createAssetVersionStore } = await import(
			"./features/asset-versions/server/asset-version-store"
		);
		const source = historySource();
		const at = "2026-11-01T00:00:00.000Z";
		source.history.assetVersionReviews = [
			{
				id: "10000000-0000-4000-8000-000000000001",
				assetRecordId: ids.record,
				versionId: ids.version2,
				decision: "approved",
				rationale: "approved first",
				createdAt: at,
			},
			{
				id: "90000000-0000-4000-8000-000000000001",
				assetRecordId: ids.record,
				versionId: ids.version2,
				decision: "rejected",
				rationale: "rejected second",
				createdAt: at,
			},
		];
		const setup = restoreSetup({ source });
		const { archive } = await setup.createArchive();
		const { restore } = await setup.restore({
			archiveId: archive.id,
			projectId: sourceProjectId,
			idempotencyKey: "review-tie",
			name: "Restored",
		});
		const stored = setup.memory.restores.get(restore.id);
		if (!stored) {
			throw new Error("Missing restored plan");
		}
		const mapped = (id: string) => {
			const value = restore.ids.find(
				(entry) => entry.sourceId === id
			)?.restoredId;
			if (!value) {
				throw new Error(`Missing mapped ID ${id}`);
			}
			return value;
		};
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const projectId = crypto.randomUUID();
		const userId = crypto.randomUUID();
		const worldId = crypto.randomUUID();
		const familyId = crypto.randomUUID();
		const assetId = mapped(ids.record);
		const versionId = mapped(ids.version2);
		const reviews = stored.sections.find(
			(section) =>
				section.group === "history" && section.name === "assetVersionReviews"
		);
		if (!reviews) {
			throw new Error("Missing restored review events");
		}
		const record: StoredProjectArchiveRestoreRecord = {
			files: [],
			ids: [],
			sections: [reviews],
			projectName: "Restored",
			restore: {
				archiveId: "archive",
				createdAt: new Date(at),
				createdByUserId: userId,
				id: restore.id,
				manifestDigest: "digest",
				requestDigest: "request",
				restoredProjectId: projectId,
				sourceProjectId,
			},
		};
		const rollback = new Error("deliberate rollback");
		try {
			await expect(
				db.transaction(async (tx) => {
					await tx.insert(user).values({
						id: userId,
						name: "Archive test",
						email: `${userId}@example.test`,
					});
					await tx
						.insert(project)
						.values({ id: projectId, ownerUserId: userId, name: "Restored" });
					await tx.insert(visualWorlds).values({
						id: worldId,
						projectId,
						name: "World",
						createdByUserId: userId,
					});
					await tx.insert(assetFamilies).values({
						id: familyId,
						projectId,
						visualWorldId: worldId,
						name: "Family",
						useContext: "game",
						createdByUserId: userId,
					});
					await tx.insert(assetRecords).values({
						id: assetId,
						projectId,
						assetFamilyId: familyId,
						createdByUserId: userId,
						name: "Hero",
						supportLevel: "general",
						availability: "active",
					});
					await tx.insert(assetVersions).values({
						id: versionId,
						projectId,
						assetRecordId: assetId,
						assetFamilyId: familyId,
						versionNumber: 1,
						fileName: "hero.png",
						contentType: "image/png",
						byteSize: 10,
						sha256: "a".repeat(64),
						objectKey: "restored/test",
						createdByUserId: userId,
					});
					await insertArchiveHistory(tx, record);
					const catalog = await createAssetVersionStore(
						tx as unknown as Database
					).list(userId, projectId);
					expect(
						catalog?.assetVersions.find((version) => version.id === versionId)
					).toMatchObject({
						reviewDisposition: "rejected",
						reviewEvents: [{ type: "approved" }, { type: "rejected" }],
					});
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.close();
		}
	}
);
