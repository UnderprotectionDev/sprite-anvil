import { exportBundleSha256 } from "@sprite-anvil/api/export-bundle-manifest";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
} from "@sprite-anvil/api/record-publication";
import {
	type RuntimeValidationRecord,
	runtimeValidationEvidenceSchema,
	runtimeValidationRecordListSchema,
	runtimeValidationRecordSchema,
} from "@sprite-anvil/api/runtime-validation";
import type {
	RuntimeValidationEvidenceResult,
	RuntimeValidationStore,
} from "@sprite-anvil/api/runtime-validation-store";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	RuntimeValidationStorage,
	StoredRuntimeValidationEvidence,
	StoredRuntimeValidationRecord,
} from "./runtime-validation-storage";

export interface RuntimeValidationStoreOptions {
	/** The exact bundle in this project, or null. Never updates the bundle. */
	getBundle: (
		userId: string,
		projectId: string,
		bundleId: string
	) => Promise<{ manifestDigest: string } | null>;
	/** Resolves a project the user owns; defaults to the shared project access lookup. */
	getProjectForUser?: (userId: string, projectId: string) => Promise<unknown>;
	now?: () => Date;
	storage: RuntimeValidationStorage;
}

function toEvidence(row: StoredRuntimeValidationEvidence) {
	return runtimeValidationEvidenceSchema.parse({
		createdAt: row.createdAt.toISOString(),
		file:
			row.fileName === null
				? null
				: {
						byteSize: row.byteSize,
						fileName: row.fileName,
						sha256: row.sha256,
					},
		id: row.id,
		kind: row.kind,
		source: row.source,
		text: row.text,
	});
}

function byAddedOrder(
	left: StoredRuntimeValidationEvidence,
	right: StoredRuntimeValidationEvidence
) {
	return (
		left.createdAt.getTime() - right.createdAt.getTime() ||
		Number(left.id > right.id) - Number(left.id < right.id)
	);
}

function toRecord(
	row: StoredRuntimeValidationRecord,
	evidence: StoredRuntimeValidationEvidence[]
): RuntimeValidationRecord {
	return runtimeValidationRecordSchema.parse({
		adapterVersion: row.adapterVersion,
		bundleId: row.bundleId,
		createdAt: row.createdAt.toISOString(),
		engineVersion: row.engineVersion,
		evidence: evidence
			.filter((item) => item.recordId === row.id)
			.sort(byAddedOrder)
			.map(toEvidence),
		gameBuild: row.gameBuild,
		id: row.id,
		manifestDigest: row.manifestDigest,
		projectId: row.projectId,
	});
}

function digestOf(content: unknown): Promise<string> {
	return exportBundleSha256(JSON.stringify(content));
}

export function createRuntimeValidationStore(
	db: Database,
	options: RuntimeValidationStoreOptions
): RuntimeValidationStore {
	const { getBundle, storage } = options;
	const lookupProject =
		options.getProjectForUser ??
		((userId: string, projectId: string) =>
			getProjectForUser(db, userId, projectId));
	const now = options.now ?? (() => new Date());

	async function readRecord(projectId: string, recordId: string) {
		const row = await storage.findRecord(projectId, recordId);
		if (!row) {
			return null;
		}
		return toRecord(row, await storage.listEvidence(projectId, [recordId]));
	}

	async function addEvidence(
		userId: string,
		input: { idempotencyKey: string; projectId: string; recordId: string },
		content: Pick<
			StoredRuntimeValidationEvidence,
			| "byteSize"
			| "fileName"
			| "kind"
			| "objectKey"
			| "sha256"
			| "source"
			| "text"
		>
	): Promise<RuntimeValidationEvidenceResult | null> {
		if ((await lookupProject(userId, input.projectId)) === null) {
			return null;
		}
		if (!(await storage.findRecord(input.projectId, input.recordId))) {
			return null;
		}
		const id = await idempotentRecordId(
			{
				kind: "runtime-validation-evidence",
				projectId: input.projectId,
				targetId: input.recordId,
				userId,
			},
			input.idempotencyKey
		);
		// The object key is storage placement, not request content: a retry may place it differently.
		const requestDigest = await digestOf({
			byteSize: content.byteSize,
			fileName: content.fileName,
			kind: content.kind,
			sha256: content.sha256,
			source: content.source,
			text: content.text,
		});
		const replay = async () => {
			const existing = await storage.findEvidence(input.projectId, id);
			if (!existing) {
				return null;
			}
			if (existing.requestDigest !== requestDigest) {
				throw new IdempotencyConflictError("Runtime Validation evidence");
			}
			return { evidence: toEvidence(existing), status: "replayed" as const };
		};
		const replayed = await replay();
		if (replayed) {
			return replayed;
		}
		const row: StoredRuntimeValidationEvidence = {
			...content,
			createdAt: now(),
			createdByUserId: userId,
			id,
			projectId: input.projectId,
			recordId: input.recordId,
			requestDigest,
		};
		const inserted = await storage.insertEvidence(row);
		if (inserted.status === "conflict") {
			const winner = await replay();
			if (!winner) {
				throw new RetryablePublicationError("Runtime Validation evidence");
			}
			return winner;
		}
		const stored = await storage.findEvidence(input.projectId, id);
		if (!stored) {
			throw new RecordIntegrityError(
				"The Runtime Validation evidence could not be re-read from the persisted record."
			);
		}
		return { evidence: toEvidence(stored), status: "created" };
	}

	return {
		addFileEvidence: (userId, input) =>
			addEvidence(userId, input, {
				byteSize: input.file.byteSize,
				fileName: input.file.fileName,
				kind: input.kind,
				objectKey: input.file.objectKey,
				sha256: input.file.sha256,
				source: input.source,
				text: null,
			}),

		addTextEvidence: (userId, input) =>
			addEvidence(userId, input, {
				byteSize: null,
				fileName: null,
				kind: input.kind,
				objectKey: null,
				sha256: null,
				source: input.source,
				text: input.text,
			}),

		async create(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const bundle = await getBundle(userId, input.projectId, input.bundleId);
			if (!bundle) {
				return { reason: "bundle_not_found", status: "rejected" };
			}
			const id = await idempotentRecordId(
				{
					kind: "runtime-validation-record",
					projectId: input.projectId,
					userId,
				},
				input.idempotencyKey
			);
			const requestDigest = await digestOf({
				adapterVersion: input.adapterVersion,
				bundleId: input.bundleId,
				engineVersion: input.engineVersion,
				gameBuild: input.gameBuild,
			});
			const replay = async () => {
				const existing = await storage.findRecord(input.projectId, id);
				if (!existing) {
					return null;
				}
				if (existing.requestDigest !== requestDigest) {
					throw new IdempotencyConflictError("Runtime Validation Record");
				}
				const reread = await readRecord(input.projectId, id);
				return reread ? { record: reread, status: "replayed" as const } : null;
			};
			const replayed = await replay();
			if (replayed) {
				return replayed;
			}
			const inserted = await storage.insertRecord({
				adapterVersion: input.adapterVersion,
				bundleId: input.bundleId,
				createdAt: now(),
				createdByUserId: userId,
				engineVersion: input.engineVersion,
				gameBuild: input.gameBuild,
				id,
				// Copied now, so the record keeps the exact bundle content it was tested against.
				manifestDigest: bundle.manifestDigest,
				projectId: input.projectId,
				requestDigest,
			});
			if (inserted.status === "conflict") {
				const winner = await replay();
				if (!winner) {
					throw new RetryablePublicationError("Runtime Validation Record");
				}
				return winner;
			}
			const record = await readRecord(input.projectId, id);
			if (!record) {
				throw new RecordIntegrityError(
					"The Runtime Validation Record could not be re-read from the persisted record."
				);
			}
			return { record, status: "created" };
		},

		async get(userId, projectId, recordId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			return await readRecord(projectId, recordId);
		},

		async getEvidenceFile(userId, projectId, recordId, evidenceId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const row = await storage.findEvidence(projectId, evidenceId);
			if (
				!row ||
				row.recordId !== recordId ||
				row.fileName === null ||
				row.byteSize === null ||
				row.sha256 === null ||
				row.objectKey === null
			) {
				return null;
			}
			return {
				byteSize: row.byteSize,
				fileName: row.fileName,
				objectKey: row.objectKey,
				sha256: row.sha256,
			};
		},

		async list(userId, projectId, bundleId) {
			if ((await lookupProject(userId, projectId)) === null) {
				return null;
			}
			const rows = await storage.listRecords(projectId, bundleId);
			const evidence = await storage.listEvidence(
				projectId,
				rows.map((row) => row.id)
			);
			return runtimeValidationRecordListSchema.parse({
				records: rows.map((row) => toRecord(row, evidence)),
			});
		},
	};
}
