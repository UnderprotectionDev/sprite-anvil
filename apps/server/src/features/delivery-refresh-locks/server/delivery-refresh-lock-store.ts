import { byPath, comparePaths } from "@sprite-anvil/api/delivery-path-schemas";
import {
	checkDeliveryRefreshLockContract,
	classifyDeliveryRefreshPaths,
	planDeliveryRefresh,
	requiresDeliveryRefreshDecision,
} from "@sprite-anvil/api/delivery-refresh-classification";
import type {
	DeliveryRefreshLockRejection,
	DeliveryRefreshLockStore,
} from "@sprite-anvil/api/delivery-refresh-lock-store";
import {
	type DeliveryRefreshLock,
	type DeliveryRefreshLockApplyInput,
	type DeliveryRefreshLockRefreshInput,
	deliveryRefreshLockCatalogSchema,
	deliveryRefreshLockContractVersion,
	deliveryRefreshLockSchema,
	deliveryRefreshLockSummarySchema,
} from "@sprite-anvil/api/delivery-refresh-locks";
import { exportBundleSha256 } from "@sprite-anvil/api/export-bundle-manifest";
import type { ExportBundleStore } from "@sprite-anvil/api/export-bundle-store";
import type { ExportBundle } from "@sprite-anvil/api/export-bundles";
import {
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
	replayPublishedRecord,
	verifyPublishedRecord,
} from "@sprite-anvil/api/record-publication";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	DeliveryRefreshLockStorage,
	StoredDeliveryRefreshLock,
	StoredDeliveryRefreshLockFile,
} from "./delivery-refresh-lock-storage";

export interface DeliveryRefreshLockStoreOptions {
	/** Reads the immutable Export Bundles a lock is bound to. */
	bundles: ExportBundleStore;
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	storage: DeliveryRefreshLockStorage;
}

interface StoredLock {
	files: StoredDeliveryRefreshLockFile[];
	lock: StoredDeliveryRefreshLock;
}

/** The digest a lock is checked against: its binding to the bundle and profile revision plus every owned file. */
function lockDigestOf(
	lock: Pick<
		StoredDeliveryRefreshLock,
		| "bundleId"
		| "bundleManifestDigest"
		| "contractVersion"
		| "profileId"
		| "profileRevisionId"
	>,
	files: StoredDeliveryRefreshLockFile[]
): Promise<string> {
	return exportBundleSha256(
		JSON.stringify({
			bundleId: lock.bundleId,
			bundleManifestDigest: lock.bundleManifestDigest,
			contractVersion: lock.contractVersion,
			files: [...files]
				.sort(byPath)
				.map((file) => [file.path, file.sha256, file.byteSize]),
			profileId: lock.profileId,
			profileRevisionId: lock.profileRevisionId,
		})
	);
}

function requestDigestOf(
	input: DeliveryRefreshLockApplyInput
): Promise<string> {
	return exportBundleSha256(
		JSON.stringify({
			bundleId: input.bundleId,
			destinationLabel: input.destinationLabel,
			projectId: input.projectId,
			written: [...input.written].sort(byPath).map((f) => [f.path, f.sha256]),
		})
	);
}

function refreshRequestDigestOf(
	input: DeliveryRefreshLockRefreshInput
): Promise<string> {
	return exportBundleSha256(
		JSON.stringify({
			bundleId: input.bundleId,
			decisions: [...input.decisions]
				.sort(byPath)
				.map((d) => [d.path, d.decision]),
			kind: "refresh",
			observed: [...input.observed].sort(byPath).map((o) => [o.path, o.sha256]),
			previousLockId: input.previousLockId,
			projectId: input.projectId,
			written: [...input.written].sort(byPath).map((f) => [f.path, f.sha256]),
		})
	);
}

function toSummary(lock: StoredDeliveryRefreshLock, bundle: ExportBundle) {
	return deliveryRefreshLockSummarySchema.parse({
		bundleId: lock.bundleId,
		bundleManifestDigest: lock.bundleManifestDigest,
		contractVersion: lock.contractVersion,
		createdAt: lock.createdAt.toISOString(),
		destinationLabel: lock.destinationLabel,
		id: lock.id,
		lockDigest: lock.lockDigest,
		profile: {
			contentDigest: bundle.manifest.profile.contentDigest,
			profileId: lock.profileId,
			revisionId: lock.profileRevisionId,
			revisionNumber: bundle.manifest.profile.revisionNumber,
		},
	});
}

export function createDeliveryRefreshLockStore(
	db: Database,
	options: DeliveryRefreshLockStoreOptions
): DeliveryRefreshLockStore {
	const { bundles, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	/** The lock's bundle, read through the Export Bundle store so its own verification applies. */
	const readBundle = (userId: string, projectId: string, bundleId: string) =>
		bundles.get(userId, projectId, bundleId);

	/** Failure text when the stored lock no longer matches its digest or its bundle, else null. */
	async function integrityFailure(
		stored: StoredLock,
		bundle: ExportBundle | null
	): Promise<string | null> {
		const { files, lock } = stored;
		if ((await lockDigestOf(lock, files)) !== lock.lockDigest) {
			return "The Delivery Refresh Lock failed verification: its files no longer match its digest.";
		}
		if (!bundle) {
			return "The Delivery Refresh Lock failed verification: its Export Bundle is missing.";
		}
		const owned = new Map(bundle.files.map((file) => [file.path, file]));
		const bound =
			bundle.manifestDigest === lock.bundleManifestDigest &&
			bundle.profileId === lock.profileId &&
			bundle.profileRevisionId === lock.profileRevisionId;
		const matches =
			bound &&
			files.length > 0 &&
			files.every((file) => {
				const source = owned.get(file.path);
				return (
					source?.sha256 === file.sha256 && source.byteSize === file.byteSize
				);
			});
		return matches
			? null
			: "The Delivery Refresh Lock failed verification: it no longer matches its Export Bundle.";
	}

	function toLock(
		stored: StoredLock,
		bundle: ExportBundle
	): DeliveryRefreshLock {
		return deliveryRefreshLockSchema.parse({
			...toSummary(stored.lock, bundle),
			files: [...stored.files].sort(byPath),
		});
	}

	/** Reads a lock and its bundle together; a lock whose check fails is an integrity error. */
	async function readVerified(
		userId: string,
		projectId: string,
		stored: StoredLock
	): Promise<DeliveryRefreshLock> {
		const bundle = await readBundle(userId, projectId, stored.lock.bundleId);
		const failure = await integrityFailure(stored, bundle);
		if (failure || !bundle) {
			throw new RecordIntegrityError(failure ?? "Missing Export Bundle.");
		}
		return toLock(stored, bundle);
	}

	/** Inserts a lock for the bundle's files (or a subset) and re-reads it; a lost race replays the winner. */
	async function publishLock(params: {
		bundle: ExportBundle;
		destinationLabel: string;
		files: { byteSize: number; path: string; sha256: string }[];
		lockId: string;
		projectId: string;
		replay: () => Promise<DeliveryRefreshLock | null>;
		requestDigest: string;
		userId: string;
	}): Promise<{ lock: DeliveryRefreshLock; status: "created" | "replayed" }> {
		const { bundle, lockId, projectId } = params;
		const files = params.files.map(({ byteSize, path, sha256 }) => ({
			byteSize,
			path,
			sha256,
		}));
		const binding = {
			bundleId: bundle.id,
			bundleManifestDigest: bundle.manifestDigest,
			contractVersion: deliveryRefreshLockContractVersion,
			profileId: bundle.profileId,
			profileRevisionId: bundle.profileRevisionId,
		};
		const inserted = await storage.insertLock(
			{
				...binding,
				createdAt: now(),
				createdByUserId: params.userId,
				destinationLabel: params.destinationLabel,
				id: lockId,
				lockDigest: await lockDigestOf(binding, files),
				projectId,
				requestDigest: params.requestDigest,
			},
			files
		);
		if (inserted.status === "conflict") {
			// A concurrent request with the same key won; its record is the answer.
			const winner = await params.replay();
			if (!winner) {
				throw new RetryablePublicationError("Delivery Refresh Lock");
			}
			return { lock: winner, status: "replayed" };
		}
		const created = await verifyPublishedRecord<
			StoredLock,
			DeliveryRefreshLock
		>({
			integrityFailure: (row) => integrityFailure(row, bundle),
			label: "Delivery Refresh Lock",
			read: () => storage.findLock(projectId, lockId),
			toResult: (row) => toLock(row, bundle),
		});
		return { lock: created, status: "created" };
	}

	/**
	 * The lock a refresh starts from. Its own contract version and required fields are checked
	 * before anything else about it is trusted; an unknown major or a missing field stops the refresh.
	 */
	async function loadPreviousLock(
		userId: string,
		projectId: string,
		previousLockId: string
	): Promise<
		| { previous: DeliveryRefreshLock }
		| { rejection: DeliveryRefreshLockRejection }
	> {
		const stored = await storage.findLock(projectId, previousLockId);
		if (!stored) {
			return { rejection: { reason: "previous_lock_unavailable" } };
		}
		const contract = checkDeliveryRefreshLockContract({
			...stored.lock,
			files: stored.files,
		});
		if (!contract.ok) {
			return {
				rejection:
					contract.reason === "unsupported_major"
						? {
								reason: "lock_version_unsupported",
								version: stored.lock.contractVersion,
							}
						: { reason: "lock_malformed" },
			};
		}
		return { previous: await readVerified(userId, projectId, stored) };
	}

	return {
		async apply(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const bundle = await readBundle(userId, input.projectId, input.bundleId);
			if (!bundle) {
				return { reason: "bundle_unavailable", status: "rejected" };
			}

			const lockId = await idempotentRecordId(
				{
					kind: "delivery-refresh-lock",
					projectId: input.projectId,
					targetId: input.bundleId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await requestDigestOf(input);
			const replay = () =>
				replayPublishedRecord<StoredLock, DeliveryRefreshLock>({
					differs: (row) => row.lock.requestDigest !== requestDigest,
					integrityFailure: (row) => integrityFailure(row, bundle),
					label: "Delivery Refresh Lock",
					read: () => storage.findLock(input.projectId, lockId),
					toResult: (row) => toLock(row, bundle),
				});
			const replayed = await replay();
			if (replayed) {
				return { lock: replayed, status: "replayed" };
			}

			const rejection = classifyWrittenFiles(bundle, input.written);
			if (rejection) {
				return { ...rejection, status: "rejected" };
			}

			return await publishLock({
				bundle,
				destinationLabel: input.destinationLabel,
				files: bundle.files,
				lockId,
				projectId: input.projectId,
				replay,
				requestDigest,
				userId,
			});
		},

		async refresh(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const bundle = await readBundle(userId, input.projectId, input.bundleId);
			if (!bundle) {
				return { reason: "bundle_unavailable", status: "rejected" };
			}
			const loaded = await loadPreviousLock(
				userId,
				input.projectId,
				input.previousLockId
			);
			if ("rejection" in loaded) {
				return { ...loaded.rejection, status: "rejected" };
			}
			const { previous } = loaded;

			const unobserved = classifyObservation(
				previous.files,
				bundle.files,
				input.observed
			);
			if (unobserved) {
				return { ...unobserved, status: "rejected" };
			}
			const classification = classifyDeliveryRefreshPaths({
				next: bundle.files,
				observed: input.observed,
				previous: previous.files,
			});
			const plan = planDeliveryRefresh(classification, input.decisions);
			const lockId = await idempotentRecordId(
				{
					kind: "delivery-refresh-lock",
					projectId: input.projectId,
					targetId: input.bundleId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await refreshRequestDigestOf(input);
			const preserved = plan.held;
			const heldPaths = new Set(plan.held.map((held) => held.path));
			const lockFiles = bundle.files.filter(
				(file) => !heldPaths.has(file.path)
			);
			const replay = () =>
				replayPublishedRecord<StoredLock, DeliveryRefreshLock>({
					differs: (row) => row.lock.requestDigest !== requestDigest,
					integrityFailure: (row) => integrityFailure(row, bundle),
					label: "Delivery Refresh Lock",
					read: () => storage.findLock(input.projectId, lockId),
					toResult: (row) => toLock(row, bundle),
				});
			const outcome = plan.held.length > 0 ? "partial" : "complete";
			const replayed = await replay();
			if (replayed) {
				return {
					applied: plan.applied,
					lock: replayed,
					outcome,
					preserved,
					status: "replayed",
				};
			}

			const rejection = classifyRefreshReport(
				bundle,
				classification,
				plan,
				input
			);
			if (rejection) {
				return { ...rejection, status: "rejected" };
			}
			if (plan.halted.length > 0) {
				return {
					applied: [...input.written.map((file) => file.path)].sort(
						comparePaths
					),
					halted: plan.halted,
					preserved,
					status: "halted",
				};
			}
			if (lockFiles.length === 0) {
				return { reason: "no_files_applied", status: "rejected" };
			}
			const published = await publishLock({
				bundle,
				destinationLabel: previous.destinationLabel,
				files: lockFiles,
				lockId,
				projectId: input.projectId,
				replay,
				requestDigest,
				userId,
			});
			return {
				applied: plan.applied,
				lock: published.lock,
				outcome,
				preserved,
				status: published.status,
			};
		},

		async get(userId, projectId, lockId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const stored = await storage.findLock(projectId, lockId);
			return stored ? await readVerified(userId, projectId, stored) : null;
		},

		async list(userId, projectId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const locks = await storage.listLocks(projectId);
			const summaries = await Promise.all(
				locks.map(async (lock) => {
					const bundle = await readBundle(userId, projectId, lock.bundleId);
					if (!bundle) {
						throw new RecordIntegrityError(
							"The Delivery Refresh Lock failed verification: its Export Bundle is missing."
						);
					}
					return toSummary(lock, bundle);
				})
			);
			return deliveryRefreshLockCatalogSchema.parse({ locks: summaries });
		},
	};
}

/**
 * A lock is only made when the surface wrote exactly the bundle's files with
 * the bundle's digests: nothing missing (partial), nothing extra (unowned),
 * nothing different (not the exact bundle).
 */
function classifyWrittenFiles(
	bundle: ExportBundle,
	written: DeliveryRefreshLockApplyInput["written"]
): DeliveryRefreshLockRejection | null {
	const owned = new Map(bundle.files.map((file) => [file.path, file.sha256]));
	const reported = new Map(written.map((file) => [file.path, file.sha256]));
	const outside = [...reported.keys()].filter((path) => !owned.has(path));
	if (outside.length > 0) {
		return {
			paths: outside.sort(comparePaths),
			reason: "written_path_not_in_bundle",
		};
	}
	const missing = [...owned.keys()].filter((path) => !reported.has(path));
	if (missing.length > 0) {
		return {
			paths: missing.sort(comparePaths),
			reason: "written_files_incomplete",
		};
	}
	const differing = [...owned].filter(
		([path, sha256]) => reported.get(path) !== sha256
	);
	if (differing.length > 0) {
		return {
			paths: differing.map(([path]) => path).sort(comparePaths),
			reason: "written_digest_mismatch",
		};
	}
	return null;
}

/**
 * The observation must cover exactly the previous lock's paths and the new bundle's paths.
 * An omitted path would read as absent and be released for overwrite without a decision;
 * an extra path would carry an unrecognised file into the report.
 */
function classifyObservation(
	previous: { path: string }[],
	next: { path: string }[],
	observed: { path: string }[]
): DeliveryRefreshLockRejection | null {
	const expected = new Set([...previous, ...next].map((file) => file.path));
	const seen = new Set<string>();
	const duplicated: string[] = [];
	for (const { path } of observed) {
		if (seen.has(path)) {
			duplicated.push(path);
		}
		seen.add(path);
	}
	const unexpected = [
		...new Set([
			...[...seen].filter((path) => !expected.has(path)),
			...duplicated,
		]),
	];
	if (unexpected.length > 0) {
		return {
			paths: unexpected.sort(comparePaths),
			reason: "observation_not_expected",
		};
	}
	const omitted = [...expected].filter((path) => !seen.has(path));
	if (omitted.length > 0) {
		return {
			paths: omitted.sort(comparePaths),
			reason: "observation_incomplete",
		};
	}
	return null;
}

/**
 * A refresh report is only trusted when it matches what the shared classification allows:
 * nothing outside the bundle, no diverged path without a replace decision, no path the plan
 * did not release, the bundle's own digests, and (unless halted) every released path written.
 */
function classifyRefreshReport(
	bundle: ExportBundle,
	classification: ReturnType<typeof classifyDeliveryRefreshPaths>,
	plan: ReturnType<typeof planDeliveryRefresh>,
	input: DeliveryRefreshLockRefreshInput
): DeliveryRefreshLockRejection | null {
	const ownedDigest = new Map(bundle.files.map((f) => [f.path, f.sha256]));
	const decidable = new Set(
		classification.entries
			.filter(requiresDeliveryRefreshDecision)
			.map((entry) => entry.path)
	);
	const decisionPaths = input.decisions.map((decision) => decision.path);
	const notApplicable = decisionPaths.filter(
		(path, index) =>
			!decidable.has(path) || decisionPaths.indexOf(path) !== index
	);
	if (notApplicable.length > 0) {
		return {
			paths: [...new Set(notApplicable)].sort(comparePaths),
			reason: "decision_not_applicable",
		};
	}

	const reported = new Map(input.written.map((f) => [f.path, f.sha256]));
	const released = new Set(plan.applied);
	const outside = [...reported.keys()].filter((p) => !ownedDigest.has(p));
	if (outside.length > 0) {
		return {
			paths: outside.sort(comparePaths),
			reason: "written_path_not_in_bundle",
		};
	}
	const unreleased = [...reported.keys()].filter(
		(path) => decidable.has(path) && !released.has(path)
	);
	if (unreleased.length > 0) {
		return {
			paths: unreleased.sort(comparePaths),
			reason: "diverged_path_not_released",
		};
	}
	const unexpected = [...reported.keys()].filter((p) => !released.has(p));
	if (unexpected.length > 0) {
		return {
			paths: unexpected.sort(comparePaths),
			reason: "written_path_not_expected",
		};
	}
	const differing = [...reported]
		.filter(([path, sha256]) => ownedDigest.get(path) !== sha256)
		.map(([path]) => path);
	if (differing.length > 0) {
		return {
			paths: differing.sort(comparePaths),
			reason: "written_digest_mismatch",
		};
	}
	const missing = plan.applied.filter((path) => !reported.has(path));
	if (plan.halted.length === 0 && missing.length > 0) {
		return {
			paths: missing.sort(comparePaths),
			reason: "written_files_incomplete",
		};
	}
	return null;
}
