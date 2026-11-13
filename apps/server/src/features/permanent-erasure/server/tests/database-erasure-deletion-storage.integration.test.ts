import { expect, test } from "bun:test";
import {
	buildDeletionReceipt,
	deletionReceiptDigest,
} from "@sprite-anvil/api/permanent-erasure-deletion";
import {
	buildErasureImpactScope,
	type ErasureImpactSource,
} from "@sprite-anvil/api/permanent-erasure-scope";
import { createDb } from "@sprite-anvil/db";
import { assetRecords } from "@sprite-anvil/db/schema/asset-records";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { user } from "@sprite-anvil/db/schema/auth";
import {
	exportBundleFiles,
	exportBundleMarkers,
	exportBundles,
} from "@sprite-anvil/db/schema/export-bundles";
import {
	deletionReceipts,
	erasureRemovalStarts,
	erasureTombstones,
} from "@sprite-anvil/db/schema/permanent-erasure";
import { project } from "@sprite-anvil/db/schema/project";
import {
	projectArchiveFiles,
	projectArchives,
} from "@sprite-anvil/db/schema/project-archives";
import { createLocalTestDb } from "@sprite-anvil/db/testing";
import { and, eq, inArray } from "drizzle-orm";
import { createDatabaseErasureDeletionStorage } from "../database-erasure-deletion-storage";
import {
	ErasureScopeChangedError,
	type FinalizeErasureInput,
} from "../erasure-deletion-storage";

const databaseUrl = process.env.CONTEXT_TEST_DATABASE_URL;

// Neon HTTP cannot address a loopback PostgreSQL, so test runs against a
// disposable local database use the repository's TCP test adapter instead.
function createTestDb(targetUrl: string) {
	const target = new URL(targetUrl);
	return target.hostname === "127.0.0.1"
		? createLocalTestDb({ DATABASE_URL: targetUrl })
		: createDb({ DATABASE_URL: targetUrl });
}

type TestDatabase = ReturnType<typeof createDb>;

const sha256 = "c".repeat(64);

interface Seeded {
	archiveCopyKey: string;
	archiveId: string;
	assetRecordId: string;
	bundleId: string;
	objectKey: string;
	projectId: string;
	unrelatedArchiveId: string;
	unrelatedBundleId: string;
	versionId: string;
}

/**
 * One project with one Asset Record and Asset Version, an Export Bundle and a
 * Project Archive that embed the version, and a bundle and an archive that do
 * not. The unrelated containers must survive every finalize.
 */
async function seed(db: TestDatabase, userId: string): Promise<Seeded> {
	const seeded: Seeded = {
		archiveCopyKey: `archives/${crypto.randomUUID()}`,
		archiveId: crypto.randomUUID(),
		assetRecordId: crypto.randomUUID(),
		bundleId: crypto.randomUUID(),
		objectKey: `objects/${crypto.randomUUID()}`,
		projectId: crypto.randomUUID(),
		unrelatedArchiveId: crypto.randomUUID(),
		unrelatedBundleId: crypto.randomUUID(),
		versionId: crypto.randomUUID(),
	};
	const { projectId } = seeded;
	await db
		.insert(project)
		.values({ id: projectId, name: "Erasure storage", ownerUserId: userId });
	await db.insert(assetRecords).values({
		availability: "active",
		createdByUserId: userId,
		id: seeded.assetRecordId,
		name: "Hero",
		projectId,
		supportLevel: "general",
	});
	await db.insert(assetVersions).values({
		assetRecordId: seeded.assetRecordId,
		byteSize: 120,
		contentType: "image/png",
		createdByUserId: userId,
		fileName: "hero.png",
		id: seeded.versionId,
		idempotencyKey: `seed-${seeded.versionId}`,
		objectKey: seeded.objectKey,
		projectId,
		sha256,
		versionNumber: 1,
	});

	const bundles = [
		{ assetVersionId: seeded.versionId, id: seeded.bundleId },
		{ assetVersionId: null, id: seeded.unrelatedBundleId },
	];
	await db.insert(exportBundles).values(
		bundles.map((bundle) => ({
			contextRevisionId: "context-revision",
			contractVersion: "1.1.0",
			createdByUserId: userId,
			id: bundle.id,
			manifestDigest: "b".repeat(64),
			profileId: "profile",
			profileRevisionId: "profile-revision",
			projectId,
			requestDigest: `request-${bundle.id}`,
		}))
	);
	await db.insert(exportBundleFiles).values(
		bundles.flatMap((bundle) => [
			{
				assetVersionId: bundle.assetVersionId,
				bundleId: bundle.id,
				byteSize: 120,
				path: "sprites/hero.png",
				sha256,
			},
			{
				assetVersionId: null,
				bundleId: bundle.id,
				byteSize: 2,
				content: "{}",
				path: "manifest.json",
				sha256,
			},
		])
	);
	await db
		.insert(exportBundleMarkers)
		.values({ bundleId: seeded.bundleId, projectId });

	await db.insert(projectArchives).values(
		[seeded.archiveId, seeded.unrelatedArchiveId].map((archiveId) => ({
			createdByUserId: userId,
			id: archiveId,
			manifestDigest: "a".repeat(64),
			projectId,
			requestDigest: `request-${archiveId}`,
			schemaVersion: "project-archive/1.0.0",
		}))
	);
	await db.insert(projectArchiveFiles).values([
		{
			archiveId: seeded.archiveId,
			assetVersionId: seeded.versionId,
			byteSize: 120,
			kind: "asset_version",
			presence: "included",
			sha256,
			sourceId: seeded.versionId,
			sourceObjectKey: seeded.archiveCopyKey,
		},
		{
			// Another file of the same archive: an object the project still uses.
			archiveId: seeded.archiveId,
			assetVersionId: null,
			byteSize: 4,
			kind: "working_file",
			presence: "included",
			sha256,
			sourceId: "other-file",
			sourceObjectKey: "archives/still-used",
		},
		{
			archiveId: seeded.unrelatedArchiveId,
			assetVersionId: null,
			byteSize: 4,
			kind: "working_file",
			presence: "included",
			sha256,
			sourceId: "unrelated-file",
			sourceObjectKey: "archives/unrelated",
		},
	]);
	return seeded;
}

/** Runs `body` with a test user, then removes what it seeded: version and record rows first, since projects restrict them, then the user with its projects. */
async function withSeededProject(
	body: (setup: {
		db: TestDatabase;
		seeded: Seeded;
		userId: string;
	}) => Promise<void>
) {
	if (!databaseUrl) {
		throw new Error("CONTEXT_TEST_DATABASE_URL is required for this test.");
	}
	const db = createTestDb(databaseUrl);
	const userId = crypto.randomUUID();
	let seeded: Seeded | null = null;
	try {
		await db.insert(user).values({
			email: `erasure-deletion-${userId}@example.test`,
			id: userId,
			name: "Erasure Deletion Integration Test",
		});
		seeded = await seed(db, userId);
		await body({ db, seeded, userId });
	} finally {
		if (seeded) {
			await db
				.delete(assetVersions)
				.where(eq(assetVersions.projectId, seeded.projectId));
			await db
				.delete(assetRecords)
				.where(eq(assetRecords.projectId, seeded.projectId));
		}
		await db.delete(user).where(eq(user.id, userId));
	}
}

function sourceOf(seeded: Seeded): ErasureImpactSource {
	return {
		archives: [
			{
				files: [{ assetVersionId: seeded.versionId, presence: "included" }],
				id: seeded.archiveId,
				manifestDigest: "a".repeat(64),
			},
		],
		assetRecord: { availability: "active", id: seeded.assetRecordId },
		bundles: [
			{
				files: [{ assetVersionId: seeded.versionId }, { assetVersionId: null }],
				id: seeded.bundleId,
				manifestDigest: "b".repeat(64),
			},
		],
		fulfilments: [],
		versions: [{ byteSize: 120, id: seeded.versionId, sha256 }],
	};
}

/** The finalize input an approved Deletion Job would build, selecting every container of the scope. */
async function finalizeInputOf(
	seeded: Seeded,
	userId: string,
	overrides: Partial<FinalizeErasureInput> = {}
): Promise<FinalizeErasureInput> {
	const built = buildErasureImpactScope(sourceOf(seeded), {
		projectId: seeded.projectId,
		retention: null,
	});
	if (!built.ok) {
		throw new Error("expected a scope");
	}
	const { scope } = built;
	const approvalId = crypto.randomUUID();
	const receipt = buildDeletionReceipt({
		approval: {
			approvedAt: new Date("2026-11-13T09:00:00.000Z"),
			approvedByUserId: userId,
			id: approvalId,
			reportId: crypto.randomUUID(),
			selectedContainerIds: scope.containers.map((container) => container.id),
		},
		completedAt: new Date("2026-11-13T10:00:00.000Z"),
		operationId: crypto.randomUUID(),
		reportDigest: "d".repeat(64),
		scope,
	});
	const containers = scope.containers.map((container) => ({
		id: container.id,
		kind: container.kind,
	}));
	return {
		assetRecordId: seeded.assetRecordId,
		expected: { assetVersionIds: [seeded.versionId], containers },
		projectId: seeded.projectId,
		receipt: {
			id: approvalId,
			projectId: seeded.projectId,
			receipt,
			receiptDigest: await deletionReceiptDigest(receipt),
		},
		removeContainers: containers,
		tombstones: [
			{
				assetRecordId: seeded.assetRecordId,
				assetVersionId: seeded.versionId,
				erasedAt: new Date("2026-11-13T10:00:00.000Z"),
				projectId: seeded.projectId,
				receiptId: approvalId,
			},
		],
		...overrides,
	};
}

async function bundleIdsOf(db: TestDatabase, projectId: string) {
	const rows = await db
		.select({ id: exportBundles.id })
		.from(exportBundles)
		.where(eq(exportBundles.projectId, projectId));
	return rows.map((row) => row.id).sort();
}

async function archiveIdsOf(db: TestDatabase, projectId: string) {
	const rows = await db
		.select({ id: projectArchives.id })
		.from(projectArchives)
		.where(eq(projectArchives.projectId, projectId));
	return rows.map((row) => row.id).sort();
}

async function nothingWasWritten(db: TestDatabase, seeded: Seeded) {
	const [record] = await db
		.select({ availability: assetRecords.availability })
		.from(assetRecords)
		.where(eq(assetRecords.id, seeded.assetRecordId));
	expect(record?.availability).toBe("active");
	expect(
		await db
			.select()
			.from(deletionReceipts)
			.where(eq(deletionReceipts.projectId, seeded.projectId))
	).toHaveLength(0);
	expect(
		await db
			.select()
			.from(erasureTombstones)
			.where(eq(erasureTombstones.projectId, seeded.projectId))
	).toHaveLength(0);
	expect(await bundleIdsOf(db, seeded.projectId)).toEqual(
		[seeded.bundleId, seeded.unrelatedBundleId].sort()
	);
	expect(await archiveIdsOf(db, seeded.projectId)).toEqual(
		[seeded.archiveId, seeded.unrelatedArchiveId].sort()
	);
}

test.skipIf(!databaseUrl)(
	"finalize writes the receipt, tombstones, erased availability and redacted name, and removes the selected whole containers with their files",
	async () => {
		await withSeededProject(async ({ db, seeded, userId }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const input = await finalizeInputOf(seeded, userId);

			expect(await storage.finalize(input)).toEqual({ status: "finalized" });

			const [record] = await db
				.select({ availability: assetRecords.availability })
				.from(assetRecords)
				.where(eq(assetRecords.id, seeded.assetRecordId));
			expect(record?.availability).toBe("erased");
			// The version row stays as the tombstone anchor; its file name and nothing else is redacted.
			const [version] = await db
				.select({
					fileName: assetVersions.fileName,
					objectKey: assetVersions.objectKey,
				})
				.from(assetVersions)
				.where(eq(assetVersions.id, seeded.versionId));
			expect(version).toEqual({ fileName: null, objectKey: seeded.objectKey });
			expect(
				await db
					.select()
					.from(erasureTombstones)
					.where(eq(erasureTombstones.projectId, seeded.projectId))
			).toEqual([
				expect.objectContaining({
					assetRecordId: seeded.assetRecordId,
					id: seeded.versionId,
					receiptId: input.receipt.id,
				}),
			]);
			expect(
				await storage.findReceipt(seeded.projectId, input.receipt.id)
			).toEqual(input.receipt);

			// Whole containers go with their file rows and marker; the unrelated ones stay untouched.
			expect(await bundleIdsOf(db, seeded.projectId)).toEqual([
				seeded.unrelatedBundleId,
			]);
			expect(await archiveIdsOf(db, seeded.projectId)).toEqual([
				seeded.unrelatedArchiveId,
			]);
			expect(
				await db
					.select()
					.from(exportBundleFiles)
					.where(eq(exportBundleFiles.bundleId, seeded.bundleId))
			).toHaveLength(0);
			expect(
				await db
					.select()
					.from(projectArchiveFiles)
					.where(eq(projectArchiveFiles.archiveId, seeded.archiveId))
			).toHaveLength(0);
			expect(
				await db
					.select()
					.from(exportBundleMarkers)
					.where(eq(exportBundleMarkers.projectId, seeded.projectId))
			).toHaveLength(0);
			expect(
				await db
					.select()
					.from(exportBundleFiles)
					.where(eq(exportBundleFiles.bundleId, seeded.unrelatedBundleId))
			).toHaveLength(2);
		});
	}
);

test.skipIf(!databaseUrl)(
	"a container left out of the selection keeps all its rows",
	async () => {
		await withSeededProject(async ({ db, seeded, userId }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const input = await finalizeInputOf(seeded, userId);

			await storage.finalize({
				...input,
				removeContainers: input.removeContainers.filter(
					(container) => container.kind === "project_archive"
				),
			});

			expect(await bundleIdsOf(db, seeded.projectId)).toEqual(
				[seeded.bundleId, seeded.unrelatedBundleId].sort()
			);
			expect(await archiveIdsOf(db, seeded.projectId)).toEqual([
				seeded.unrelatedArchiveId,
			]);
		});
	}
);

test.skipIf(!databaseUrl)(
	"finalizing the same approval again reports the existing receipt and writes nothing twice",
	async () => {
		await withSeededProject(async ({ db, seeded, userId }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const input = await finalizeInputOf(seeded, userId);
			await storage.finalize(input);

			expect(await storage.finalize(input)).toEqual({ status: "existing" });

			expect(
				await db
					.select()
					.from(deletionReceipts)
					.where(eq(deletionReceipts.projectId, seeded.projectId))
			).toHaveLength(1);
			expect(
				await db
					.select()
					.from(erasureTombstones)
					.where(eq(erasureTombstones.projectId, seeded.projectId))
			).toHaveLength(1);
		});
	}
);

test.skipIf(!databaseUrl)(
	"a unique violation that is not an existing receipt is thrown, not reported as existing, and rolls everything back",
	async () => {
		await withSeededProject(async ({ db, seeded, userId }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const input = await finalizeInputOf(seeded, userId);
			// A tombstone already stands for the version, but no receipt exists for this approval.
			await db.insert(erasureTombstones).values({
				assetRecordId: seeded.assetRecordId,
				erasedAt: new Date("2026-11-12T10:00:00.000Z"),
				id: seeded.versionId,
				projectId: seeded.projectId,
				receiptId: "an-earlier-receipt",
			});

			await expect(storage.finalize(input)).rejects.toBeDefined();

			const [record] = await db
				.select({ availability: assetRecords.availability })
				.from(assetRecords)
				.where(eq(assetRecords.id, seeded.assetRecordId));
			expect(record?.availability).toBe("active");
			expect(
				await storage.findReceipt(seeded.projectId, input.receipt.id)
			).toBeNull();
			expect(await bundleIdsOf(db, seeded.projectId)).toHaveLength(2);
			expect(await archiveIdsOf(db, seeded.projectId)).toHaveLength(2);
		});
	}
);

test.skipIf(!databaseUrl)(
	"a container that embeds the asset after the scope was proven fails the finalize and writes nothing",
	async () => {
		await withSeededProject(async ({ db, seeded, userId }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const input = await finalizeInputOf(seeded, userId);
			// A bundle made after the proof, while objects were being removed.
			await db.insert(exportBundleFiles).values({
				assetVersionId: seeded.versionId,
				bundleId: seeded.unrelatedBundleId,
				byteSize: 120,
				path: "late/hero.png",
				sha256,
			});

			await expect(storage.finalize(input)).rejects.toBeInstanceOf(
				ErasureScopeChangedError
			);

			await nothingWasWritten(db, seeded);
		});
	}
);

test.skipIf(!databaseUrl)(
	"a version that appears after the scope was proven fails the finalize and writes nothing",
	async () => {
		await withSeededProject(async ({ db, seeded, userId }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const input = await finalizeInputOf(seeded, userId);
			await db.insert(assetVersions).values({
				assetRecordId: seeded.assetRecordId,
				byteSize: 50,
				contentType: "image/png",
				createdByUserId: userId,
				id: crypto.randomUUID(),
				idempotencyKey: `late-${crypto.randomUUID()}`,
				objectKey: `objects/${crypto.randomUUID()}`,
				projectId: seeded.projectId,
				sha256,
				versionNumber: 2,
			});

			await expect(storage.finalize(input)).rejects.toBeInstanceOf(
				ErasureScopeChangedError
			);

			await nothingWasWritten(db, seeded);
		});
	}
);

test.skipIf(!databaseUrl)(
	"an Asset Record erased or missing at finalize time gets no receipt",
	async () => {
		await withSeededProject(async ({ db, seeded, userId }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const input = await finalizeInputOf(seeded, userId);
			await db
				.update(assetRecords)
				.set({ availability: "erased" })
				.where(eq(assetRecords.id, seeded.assetRecordId));

			await expect(storage.finalize(input)).rejects.toBeInstanceOf(
				ErasureScopeChangedError
			);
			await expect(
				storage.finalize({ ...input, assetRecordId: crypto.randomUUID() })
			).rejects.toBeInstanceOf(ErasureScopeChangedError);

			expect(
				await storage.findReceipt(seeded.projectId, input.receipt.id)
			).toBeNull();
			expect(await bundleIdsOf(db, seeded.projectId)).toHaveLength(2);
		});
	}
);

test.skipIf(!databaseUrl)(
	"the removal start is recorded once, per approval, and read back",
	async () => {
		await withSeededProject(async ({ db, seeded }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const approvalId = crypto.randomUUID();
			expect(await storage.removalStarted(seeded.projectId, approvalId)).toBe(
				false
			);

			await storage.markRemovalStarted({
				approvalId,
				projectId: seeded.projectId,
				startedAt: new Date("2026-11-13T10:00:00.000Z"),
			});
			// Recording it again changes nothing.
			await storage.markRemovalStarted({
				approvalId,
				projectId: seeded.projectId,
				startedAt: new Date("2026-11-13T11:00:00.000Z"),
			});

			expect(await storage.removalStarted(seeded.projectId, approvalId)).toBe(
				true
			);
			expect(
				await storage.removalStarted(seeded.projectId, crypto.randomUUID())
			).toBe(false);
			const rows = await db
				.select()
				.from(erasureRemovalStarts)
				.where(eq(erasureRemovalStarts.id, approvalId));
			expect(rows).toHaveLength(1);
			expect(rows[0]?.startedAt.toISOString()).toBe("2026-11-13T10:00:00.000Z");
		});
	}
);

test.skipIf(!databaseUrl)(
	"approvals are inserted once: a repeated id returns the first row",
	async () => {
		await withSeededProject(async ({ seeded, userId, db }) => {
			const storage = createDatabaseErasureDeletionStorage(db);
			const row = {
				approvedByUserId: userId,
				confirmed: {
					archives: 1,
					bundles: 1,
					containerFiles: 2,
					fulfilments: 0,
					managedCopies: 1,
				},
				createdAt: new Date("2026-11-13T09:00:00.000Z"),
				id: crypto.randomUUID(),
				idempotencyKey: "approve-1",
				projectId: seeded.projectId,
				reportDigest: "d".repeat(64),
				reportId: crypto.randomUUID(),
				requestDigest: "e".repeat(64),
				selectedContainerIds: [seeded.bundleId],
			};

			expect(await storage.insertApproval(row)).toEqual({ status: "inserted" });
			const again = await storage.insertApproval({
				...row,
				requestDigest: "f".repeat(64),
			});

			expect(again).toEqual({ existing: row, status: "existing" });
			expect(await storage.findApproval(seeded.projectId, row.id)).toEqual(row);
			expect(await storage.findApproval(seeded.projectId, "other")).toBeNull();
		});
	}
);

test.skipIf(!databaseUrl)(
	"object keys: the managed copies, and only the included archive files that hold the erased versions",
	async () => {
		await withSeededProject(async ({ db, seeded }) => {
			const storage = createDatabaseErasureDeletionStorage(db);

			expect(
				await storage.objectKeys(seeded.projectId, [seeded.versionId])
			).toEqual(new Map([[seeded.versionId, seeded.objectKey]]));
			expect(
				await storage.archiveObjectKeys(
					seeded.projectId,
					[seeded.archiveId],
					[seeded.versionId]
				)
			).toEqual([seeded.archiveCopyKey]);
			// An archive that was not selected contributes nothing.
			expect(
				await storage.archiveObjectKeys(
					seeded.projectId,
					[seeded.unrelatedArchiveId],
					[seeded.versionId]
				)
			).toEqual([]);
			const stillThere = await db
				.select({ key: projectArchiveFiles.sourceObjectKey })
				.from(projectArchiveFiles)
				.where(
					and(
						eq(projectArchiveFiles.archiveId, seeded.archiveId),
						inArray(projectArchiveFiles.sourceId, ["other-file"])
					)
				);
			expect(stillThere).toHaveLength(1);
		});
	}
);
