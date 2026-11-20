import { expect, test } from "bun:test";
import type { Database } from "@sprite-anvil/db";
import { createInteractiveDatabase } from "@sprite-anvil/db/interactive-database";
import { user } from "@sprite-anvil/db/schema/auth";
import { project } from "@sprite-anvil/db/schema/project";
import {
	createLocalTestDb,
	isLoopbackTestDatabaseUrl,
} from "@sprite-anvil/db/testing";
import { eq } from "drizzle-orm";
import { createDatabaseExportProfileStorage } from "./features/export-profiles/server/database-export-profile-storage";
import { insertArchiveDelivery } from "./features/project-archives/server/project-archive-delivery-materialization";
import type { StoredProjectArchiveRestoreRecord } from "./features/project-archives/server/project-archive-restore-storage";
import { canonicalDatabaseVerifier } from "./project-archive-canonical-database-verifier";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"restores an Export Profile readable by its normal storage in one transaction",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const db = createInteractiveDatabase({ DATABASE_URL: databaseUrl });
		const projectId = crypto.randomUUID();
		const userId = crypto.randomUUID();
		const profileId = crypto.randomUUID();
		const at = "2026-01-01T00:00:00.000Z";
		const record: StoredProjectArchiveRestoreRecord = {
			files: [],
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
				{
					group: "delivery",
					name: "exportProfiles",
					digest: "d",
					sourceDigest: "d",
					recordCount: 1,
					records: [{ id: profileId, name: "Desktop", createdAt: at }],
				},
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
					await insertArchiveDelivery(tx, record);
					expect(
						await canonicalDatabaseVerifier(tx as unknown as Database)(record)
					).toEqual([]);
					expect(
						await createDatabaseExportProfileStorage(
							tx as unknown as Database,
							db
						).findProfile(projectId, profileId)
					).toMatchObject({ id: profileId, name: "Desktop", projectId });
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.$client.close();
		}
	}
);

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"restores Bundle, Target and excluded Runtime evidence into their normal stores",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const { deliverySource, deliveryIds } = await import(
			"./features/project-archives/server/tests/project-archive-delivery-fixtures"
		);
		const { ids } = await import(
			"./features/project-archives/server/tests/project-archive-fixtures"
		);
		const { createDatabaseExportBundleStorage } = await import(
			"./features/export-bundles/server/database-export-bundle-storage"
		);
		const { createDatabaseRuntimeValidationStorage } = await import(
			"./features/runtime-validation/server/database-runtime-validation-storage"
		);
		const { insertArchiveHistory } = await import(
			"./features/project-archives/server/project-archive-history-materialization"
		);
		const { visualWorlds } = await import(
			"@sprite-anvil/db/schema/context-scopes"
		);
		const { assetFamilies, assetRecords } = await import(
			"@sprite-anvil/db/schema/asset-records"
		);
		const { assetVersions } = await import(
			"@sprite-anvil/db/schema/asset-versions"
		);
		const { contextRevisions } = await import(
			"@sprite-anvil/db/schema/project-context"
		);
		const source = deliverySource();
		for (const validation of source.delivery.runtimeValidations) {
			for (const decision of validation.decisions) {
				decision.sequence += 10_000;
			}
		}
		const db = createInteractiveDatabase({ DATABASE_URL: databaseUrl });
		const projectId = crypto.randomUUID();
		const userId = crypto.randomUUID();
		const at = "2026-01-01T00:00:00.000Z";
		const section = (group: string, name: string, rows: unknown[]) => ({
			group,
			name,
			records: rows,
			recordCount: rows.length,
			digest: "d",
			sourceDigest: "d",
		});
		const sections = [
			section(
				"history",
				"requiredSetRevisions",
				source.history.requiredSetRevisions
			),
			...Object.entries(source.delivery).map(([name, rows]) =>
				section("delivery", name, rows)
			),
		];
		for (const marker of source.delivery.exportBundleMarkers) {
			marker.id = projectId;
		}
		const file = source.files.find(
			(item) => item.kind === "runtime_evidence_file"
		);
		if (!file) {
			throw new Error("Missing runtime file fixture");
		}
		const { objectKey: _sourceKey, ...fileEntry } = file;
		const record: StoredProjectArchiveRestoreRecord = {
			files: [
				{
					...fileEntry,
					restoredId: file.sourceId,
					presence: "excluded",
					exclusionReason: "evidence_not_archived",
					objectKey: null,
				},
			],
			ids: [],
			sections,
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
						id: ids.world,
						projectId,
						name: "World",
						createdByUserId: userId,
					});
					await tx.insert(assetFamilies).values({
						id: ids.family,
						projectId,
						visualWorldId: ids.world,
						name: "Hero",
						useContext: "game",
						createdByUserId: userId,
					});
					await tx.insert(assetRecords).values({
						id: ids.record,
						projectId,
						assetFamilyId: ids.family,
						createdByUserId: userId,
						name: "Hero",
						supportLevel: "general",
						availability: "active",
					});
					await tx.insert(assetVersions).values(
						[ids.version1, ids.version2].map((id, index) => ({
							id,
							projectId,
							assetRecordId: ids.record,
							assetFamilyId: ids.family,
							versionNumber: index + 1,
							contentType: "image/png",
							byteSize: 120,
							objectKey: `test/${id}`,
							createdByUserId: userId,
						}))
					);
					await tx.insert(contextRevisions).values({
						id: ids.contextRevision,
						projectId,
						revisionNumber: 0,
						state: "baseline",
						contractVersion: "context-rule/1.0.0",
						rules: [],
						createdByUserId: userId,
					});
					await insertArchiveHistory(tx, record);
					await insertArchiveDelivery(tx, record);
					const { readProjectArchiveDelivery } = await import(
						"./features/project-archives/server/project-archive-delivery-reader"
					);
					const actualDelivery = await readProjectArchiveDelivery(
						tx as unknown as Database,
						projectId
					);
					expect(actualDelivery.delivery.exportBundleMarkers).toEqual(
						source.delivery.exportBundleMarkers
					);
					expect(
						await canonicalDatabaseVerifier(tx as unknown as Database)(record)
					).toEqual([]);
					const dbView = tx as unknown as Database;
					const bundles = createDatabaseExportBundleStorage(dbView);
					expect(await bundles.findLatestBundleId(projectId)).toBe(
						deliveryIds.bundle2
					);
					expect(
						await bundles.findBundle(projectId, deliveryIds.bundle1)
					).toMatchObject({
						bundle: { id: deliveryIds.bundle1, projectId },
						files: expect.any(Array),
					});
					const runtime = createDatabaseRuntimeValidationStorage(dbView);
					expect(
						await runtime.findEvidence(projectId, deliveryIds.evidence)
					).toMatchObject({
						fileName: "run.mp4",
						objectKey: null,
						byteSize: 5_000_000,
					});
					expect(
						await runtime.listDecisions(projectId, [deliveryIds.validation])
					).toMatchObject([
						{ id: deliveryIds.decision, kind: "outcome", outcome: "pass" },
					]);
					throw rollback;
				})
			).rejects.toBe(rollback);
		} finally {
			await db.$client.close();
		}
	}
);

test.skipIf(!isLoopbackTestDatabaseUrl(databaseUrl))(
	"an Export Profile retains its revision after a duplicate insert conflicts",
	async () => {
		if (!databaseUrl) {
			throw new Error("CONTEXT_TEST_DATABASE_URL required");
		}
		const db = createLocalTestDb({ DATABASE_URL: databaseUrl });
		const interactiveDb = createInteractiveDatabase({
			DATABASE_URL: databaseUrl,
		});
		const userId = crypto.randomUUID();
		const projectId = crypto.randomUUID();
		const profile = {
			createdByUserId: userId,
			id: crypto.randomUUID(),
			name: "Desktop",
			projectId,
		};
		const revision = {
			contentDigest: "digest",
			contractVersion: "1.0.0",
			createdAt: new Date(),
			createdByUserId: userId,
			definition: {},
			id: crypto.randomUUID(),
			profileId: profile.id,
			projectId,
		};
		try {
			await db.insert(user).values({
				email: `${userId}@example.test`,
				id: userId,
				name: "Export Profile owner",
			});
			await db.insert(project).values({
				id: projectId,
				name: "Export Profile project",
				ownerUserId: userId,
			});
			const storage = createDatabaseExportProfileStorage(db, interactiveDb);
			expect(await storage.insertRevision(profile, revision)).toMatchObject({
				revision: { id: revision.id, revisionNumber: 1 },
				status: "inserted",
			});
			expect(await storage.insertRevision(profile, revision)).toEqual({
				status: "conflict",
			});
			expect(await storage.listRevisions(projectId)).toMatchObject([
				{ id: revision.id, revisionNumber: 1 },
			]);
		} finally {
			await interactiveDb.$client.close();
			try {
				await db.delete(project).where(eq(project.id, projectId));
				await db.delete(user).where(eq(user.id, userId));
			} finally {
				await db.close();
			}
		}
	}
);
