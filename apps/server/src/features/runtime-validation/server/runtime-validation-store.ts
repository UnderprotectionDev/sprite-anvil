import { exportBundleSha256 } from "@sprite-anvil/api/export-bundle-manifest";
import {
	IdempotencyConflictError,
	idempotentRecordId,
	RecordIntegrityError,
	RetryablePublicationError,
} from "@sprite-anvil/api/record-publication";
import {
	type RuntimeValidationRecord,
	type RuntimeValidationRecordCreateInput,
	runtimeValidationEvidenceSchema,
	runtimeValidationRecordListSchema,
	runtimeValidationRecordSchema,
} from "@sprite-anvil/api/runtime-validation";
import {
	deriveRuntimeValidationState,
	runtimeValidationDecisionSchema,
} from "@sprite-anvil/api/runtime-validation-decisions";
import type {
	RuntimeValidationDecisionResult,
	RuntimeValidationEvidenceResult,
	RuntimeValidationStore,
} from "@sprite-anvil/api/runtime-validation-store";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import type {
	RuntimeValidationStorage,
	StoredRuntimeValidationDecision,
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
	left: { createdAt: Date; id: string },
	right: { createdAt: Date; id: string }
) {
	return (
		left.createdAt.getTime() - right.createdAt.getTime() ||
		Number(left.id > right.id) - Number(left.id < right.id)
	);
}

function toDecision(row: StoredRuntimeValidationDecision) {
	return runtimeValidationDecisionSchema.parse({
		createdAt: row.createdAt.toISOString(),
		failureSource: row.failureSource,
		id: row.id,
		kind: row.kind,
		outcome: row.outcome,
	});
}

function toRecord(
	row: StoredRuntimeValidationRecord,
	evidence: StoredRuntimeValidationEvidence[],
	storedDecisions: StoredRuntimeValidationDecision[]
): RuntimeValidationRecord {
	const decisions = storedDecisions
		.filter((item) => item.recordId === row.id)
		// Timestamps can tie, so decisions are ordered by the storage's insert sequence.
		.sort((left, right) => left.sequence - right.sequence)
		.map(toDecision);
	return runtimeValidationRecordSchema.parse({
		adapterVersion: row.adapterVersion,
		bundleId: row.bundleId,
		createdAt: row.createdAt.toISOString(),
		decisions,
		engineVersion: row.engineVersion,
		evidence: evidence
			.filter((item) => item.recordId === row.id)
			.sort(byAddedOrder)
			.map(toEvidence),
		gameBuild: row.gameBuild,
		id: row.id,
		manifestDigest: row.manifestDigest,
		projectId: row.projectId,
		supersedesRecordId: row.supersedesRecordId,
		...deriveRuntimeValidationState(decisions),
	});
}

/** Why a decision cannot be appended to a record with this outcome: the outcome is final, and a source needs a Fail. */
function decisionRefusal(
	kind: StoredRuntimeValidationDecision["kind"],
	outcome: RuntimeValidationRecord["outcome"]
) {
	if (kind === "outcome") {
		return outcome === null ? null : "outcome_already_decided";
	}
	if (outcome === null) {
		return "outcome_not_decided";
	}
	return outcome === "fail" ? null : "outcome_not_fail";
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
		const [evidence, decisions] = await Promise.all([
			storage.listEvidence(projectId, [recordId]),
			storage.listDecisions(projectId, [recordId]),
		]);
		return toRecord(row, evidence, decisions);
	}

	/** The one place a decision row is appended; a repeated key replays and a taken outcome slot is reported. */
	async function decide(
		userId: string,
		input: { idempotencyKey: string; projectId: string; recordId: string },
		content: Pick<
			StoredRuntimeValidationDecision,
			"failureSource" | "kind" | "outcome"
		>
	): Promise<RuntimeValidationDecisionResult | null> {
		if ((await lookupProject(userId, input.projectId)) === null) {
			return null;
		}
		const record = await readRecord(input.projectId, input.recordId);
		if (!record) {
			return null;
		}
		const id = await idempotentRecordId(
			{
				kind: "runtime-validation-decision",
				projectId: input.projectId,
				targetId: input.recordId,
				userId,
			},
			input.idempotencyKey
		);
		const requestDigest = await digestOf(content);
		const replay =
			async (): Promise<RuntimeValidationDecisionResult | null> => {
				const existing = await storage.findDecision(input.projectId, id);
				if (!existing) {
					return null;
				}
				if (existing.requestDigest !== requestDigest) {
					throw new IdempotencyConflictError("Runtime Validation decision");
				}
				return { decision: toDecision(existing), status: "replayed" };
			};
		const replayed = await replay();
		if (replayed) {
			return replayed;
		}
		const refusal = decisionRefusal(content.kind, record.outcome);
		if (refusal) {
			return { reason: refusal, status: "rejected" };
		}
		const inserted = await storage.insertDecision({
			...content,
			createdAt: now(),
			decidedByUserId: userId,
			id,
			projectId: input.projectId,
			recordId: input.recordId,
			requestDigest,
		});
		if (inserted.status === "conflict") {
			const winner = await replay();
			if (winner) {
				return winner;
			}
			// The outcome slot was taken concurrently by another decision.
			return { reason: "outcome_already_decided", status: "rejected" };
		}
		const stored = await storage.findDecision(input.projectId, id);
		if (!stored) {
			throw new RecordIntegrityError(
				"The Runtime Validation decision could not be re-read from the persisted record."
			);
		}
		return { decision: toDecision(stored), status: "created" };
	}

	/**
	 * Why a retest cannot supersede its record: it is unknown to the project, is
	 * another bundle or environment, or is not a result that needs a retest. Only
	 * a Fail with a confirmed failure source or an Inconclusive record may be
	 * superseded; a pending, Pass or Source Unknown record stays current, so a
	 * newer record cannot hide it from readiness.
	 */
	async function refuseSupersession(
		input: RuntimeValidationRecordCreateInput
	): Promise<
		| "superseded_record_mismatch"
		| "superseded_record_not_eligible"
		| "superseded_record_not_found"
		| null
	> {
		if (input.supersedesRecordId === null) {
			return null;
		}
		const superseded = await readRecord(
			input.projectId,
			input.supersedesRecordId
		);
		if (!superseded) {
			return "superseded_record_not_found";
		}
		const sameEnvironment =
			superseded.bundleId === input.bundleId &&
			superseded.gameBuild === input.gameBuild &&
			superseded.engineVersion === input.engineVersion &&
			superseded.adapterVersion === input.adapterVersion;
		if (!sameEnvironment) {
			return "superseded_record_mismatch";
		}
		const needsRetest =
			superseded.outcome === "inconclusive" ||
			(superseded.outcome === "fail" &&
				superseded.failureSource !== "source_unknown");
		return needsRetest ? null : "superseded_record_not_eligible";
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
		const record = await readRecord(input.projectId, input.recordId);
		if (!record) {
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
		// Evidence closes with the outcome; a retry of earlier evidence has already replayed above.
		if (record.outcome !== null) {
			return { reason: "outcome_already_decided", status: "rejected" };
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
		if (inserted.status === "closed") {
			// The outcome landed after the check above.
			return { reason: "outcome_already_decided", status: "rejected" };
		}
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

		confirmFailureSource: (userId, input) =>
			decide(userId, input, {
				failureSource: input.failureSource,
				kind: "failure_source",
				outcome: null,
			}),

		finalizeOutcome: (userId, input) =>
			decide(userId, input, {
				failureSource: null,
				kind: "outcome",
				outcome: input.outcome,
			}),

		async create(userId, input) {
			if ((await lookupProject(userId, input.projectId)) === null) {
				return null;
			}
			const bundle = await getBundle(userId, input.projectId, input.bundleId);
			if (!bundle) {
				return { reason: "bundle_not_found", status: "rejected" };
			}
			const supersessionRefusal = await refuseSupersession(input);
			if (supersessionRefusal) {
				return { reason: supersessionRefusal, status: "rejected" };
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
				// Left out when absent, so a key used before retests existed keeps its digest.
				...(input.supersedesRecordId === null
					? {}
					: { supersedesRecordId: input.supersedesRecordId }),
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
				supersedesRecordId: input.supersedesRecordId,
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
			const ids = rows.map((row) => row.id);
			const [evidence, decisions] = await Promise.all([
				storage.listEvidence(projectId, ids),
				storage.listDecisions(projectId, ids),
			]);
			return runtimeValidationRecordListSchema.parse({
				records: rows.map((row) => toRecord(row, evidence, decisions)),
			});
		},
	};
}
