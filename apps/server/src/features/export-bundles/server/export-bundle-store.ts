import {
	buildExportBundle,
	checkExportBundleFiles,
	exportBundleManifestSchema,
	exportBundleRequestDigest,
} from "@sprite-anvil/api/export-bundle-manifest";
import type {
	ExportBundleCreateResult,
	ExportBundleSourceReader,
	ExportBundleStore,
} from "@sprite-anvil/api/export-bundle-store";
import {
	type ExportBundle,
	exportBundleCatalogSchema,
	exportBundleSchema,
	exportBundleSummarySchema,
} from "@sprite-anvil/api/export-bundles";
import type { ExportProfileStore } from "@sprite-anvil/api/export-profile-store";
import {
	contractMajorOf,
	supportedExportProfileContractMajor,
} from "@sprite-anvil/api/export-profiles";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	ExportBundleStorage,
	StoredExportBundle,
	StoredExportBundleFile,
} from "./export-bundle-storage";

export interface ExportBundleStoreOptions {
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	profiles: ExportProfileStore;
	sourceReader: ExportBundleSourceReader;
	storage: ExportBundleStorage;
}

interface StoredBundle {
	bundle: StoredExportBundle;
	files: StoredExportBundleFile[];
}

function toSummary(bundle: StoredExportBundle, latestBundleId: string | null) {
	return exportBundleSummarySchema.parse({
		adapterVersion: bundle.adapterVersion,
		contextRevisionId: bundle.contextRevisionId,
		contractVersion: bundle.contractVersion,
		createdAt: bundle.createdAt.toISOString(),
		deliveryTargetRevisionId: bundle.deliveryTargetRevisionId,
		id: bundle.id,
		isLatest: bundle.id === latestBundleId,
		manifestDigest: bundle.manifestDigest,
		profileId: bundle.profileId,
		profileRevisionId: bundle.profileRevisionId,
	});
}

function toBundle(
	stored: StoredBundle,
	latestBundleId: string | null
): ExportBundle {
	const manifestFile = stored.files.find(
		(file) => file.path === "manifest.json"
	);
	return exportBundleSchema.parse({
		...toSummary(stored.bundle, latestBundleId),
		files: stored.files
			.map((file) => ({ ...file }))
			.sort(
				(left, right) =>
					Number(left.path > right.path) - Number(left.path < right.path)
			),
		manifest: exportBundleManifestSchema.parse(
			JSON.parse(manifestFile?.content ?? "null")
		),
	});
}

/** Failure text when the stored bundle no longer matches its own manifest and checksums, else null. */
async function integrityFailure(stored: StoredBundle): Promise<string | null> {
	const failure = await checkExportBundleFiles(stored.files);
	if (failure) {
		return `The Export Bundle failed verification: ${failure}`;
	}
	const manifest = stored.files.find((file) => file.path === "manifest.json");
	if (manifest?.sha256 !== stored.bundle.manifestDigest) {
		return "The Export Bundle failed verification: its manifest digest does not match the record.";
	}
	return null;
}

export function createExportBundleStore(
	db: Database,
	options: ExportBundleStoreOptions
): ExportBundleStore {
	const { profiles, sourceReader, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	return {
		async create(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const catalog = await profiles.list(userId, input.projectId);
			const profile = catalog?.profiles.find((candidate) =>
				candidate.revisions.some(
					(existing) => existing.id === input.profileRevisionId
				)
			);
			const revision = profile?.revisions.find(
				(candidate) => candidate.id === input.profileRevisionId
			);
			if (!(profile && revision)) {
				return {
					reason: "profile_revision_unavailable",
					status: "rejected",
				};
			}
			if (
				contractMajorOf(revision.contractVersion) !==
				supportedExportProfileContractMajor
			) {
				return {
					reason: "unsupported_profile_contract_version",
					status: "rejected",
				};
			}

			const bundleId = await idempotentRecordId(
				{ kind: "export-bundle", projectId: input.projectId, userId },
				input.idempotencyKey
			);
			const requestDigest = await exportBundleRequestDigest(input);
			const replay = () =>
				replayPublishedRecord({
					differs: (row) => row.bundle.requestDigest !== requestDigest,
					integrityFailure,
					label: "Export Bundle",
					read: () => storage.findBundle(input.projectId, bundleId),
					toResult: (row) => row,
				});
			const replayed = await replay();
			if (replayed) {
				return {
					bundle: toBundle(
						replayed,
						await storage.findLatestBundleId(input.projectId)
					),
					status: "replayed",
				};
			}

			const resolved = await sourceReader.read(userId, {
				assetFamilyIds: input.assetFamilyIds,
				projectId: input.projectId,
			});
			if (!resolved) {
				return null;
			}
			if (resolved.status === "family_unavailable") {
				return {
					assetFamilyIds: resolved.assetFamilyIds,
					reason: "family_unavailable",
					status: "rejected",
				};
			}
			const built = await buildExportBundle(resolved.source, {
				adapterVersion: input.adapterVersion,
				deliveryTargetRevisionId: input.deliveryTargetRevisionId,
				profile: {
					contentDigest: revision.contentDigest,
					contractVersion: revision.contractVersion,
					definition: revision.definition,
					profileId: profile.id,
					revisionId: revision.id,
					revisionNumber: revision.revisionNumber,
				},
			});
			if (!built.ok) {
				const { ok: _ok, ...rejection } = built;
				return { ...rejection, status: "rejected" } as ExportBundleCreateResult;
			}

			const inserted = await storage.insertBundle(
				{
					adapterVersion: input.adapterVersion,
					contextRevisionId: built.bundle.manifest.context.revisionId,
					contractVersion: built.bundle.manifest.contractVersion,
					createdAt: now(),
					createdByUserId: userId,
					deliveryTargetRevisionId: input.deliveryTargetRevisionId,
					id: bundleId,
					manifestDigest: built.bundle.manifestDigest,
					profileId: profile.id,
					profileRevisionId: revision.id,
					projectId: input.projectId,
					requestDigest,
				},
				built.bundle.files
			);
			if (inserted.status === "conflict") {
				// A concurrent request with the same key won; its record is the answer.
				const winner = await replay();
				if (!winner) {
					throw new RetryablePublicationError("Export Bundle");
				}
				return {
					bundle: toBundle(
						winner,
						await storage.findLatestBundleId(input.projectId)
					),
					status: "replayed",
				};
			}
			const stored = await verifyPublishedRecord({
				integrityFailure,
				label: "Export Bundle",
				read: () => storage.findBundle(input.projectId, bundleId),
				toResult: (row) => row,
			});
			return {
				bundle: toBundle(
					stored,
					await storage.findLatestBundleId(input.projectId)
				),
				status: "created",
			};
		},

		async get(userId, projectId, bundleId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const stored = await storage.findBundle(projectId, bundleId);
			if (!stored) {
				return null;
			}
			const failure = await integrityFailure(stored);
			if (failure) {
				throw new RecordIntegrityError(failure);
			}
			return toBundle(stored, await storage.findLatestBundleId(projectId));
		},

		async list(userId, projectId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const [bundles, latestBundleId] = await Promise.all([
				storage.listBundles(projectId),
				storage.findLatestBundleId(projectId),
			]);
			return exportBundleCatalogSchema.parse({
				bundles: bundles.map((bundle) => toSummary(bundle, latestBundleId)),
				latestBundleId,
			});
		},
	};
}
