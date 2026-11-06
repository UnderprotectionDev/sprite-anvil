import type {
	OfflineAbandonConfirmation,
	OfflineConflictResolutionRow,
	OfflineConflictResolveInput,
	OfflineConflictResolveResponse,
} from "@sprite-anvil/api/offline-conflict";
import {
	offlineAbandonConfirmationSchema,
	offlineConflictResolveInputSchema,
	offlineConflictResolveResponseSchema,
} from "@sprite-anvil/api/offline-conflict";
import type { AbandonConfirmations } from "./abandon-confirmation";
import { storePngCandidate } from "./candidate-store";
import {
	appliedOperations,
	buildView,
	checkRequestContractVersion,
	isPendingResolution,
	type ReadableEntry,
} from "./offline-conflict-content";
import { loadEntry } from "./offline-conflict-reads";
import { renderVersion } from "./offline-conflict-render";
import {
	failure,
	newId,
	type Outcome,
	type Scope,
	success,
} from "./pixel-editor-context";

/**
 * Resolution of an Offline Conflict Record. The user's explicit choice is
 * recorded once; the cloud draft and the base Asset Version are never edited.
 * A create-candidate choice claims the record first and only the request that
 * holds the claim writes a Candidate Version, so a losing request never leaves
 * an unreferenced one behind.
 */

function operationSummary(operations: { type: string }[]) {
	const counts = new Map<string, number>();
	for (const { type } of operations) {
		counts.set(type, (counts.get(type) ?? 0) + 1);
	}
	return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

function binding(scope: Scope, readable: ReadableEntry) {
	return {
		userId: scope.access.userId,
		projectId: scope.access.projectId,
		conflictId: readable.entry.record.id,
		localDigest: readable.entry.record.localDigest,
	};
}

/**
 * Serves the local content an abandon would discard, with the token the
 * abandon request must present. Only an open record can be abandoned.
 */
export async function serveAbandonConfirmation(
	scope: Scope,
	confirmations: AbandonConfirmations,
	conflictId: string
): Promise<Outcome<OfflineAbandonConfirmation>> {
	const loaded = await loadEntry(scope, conflictId);
	if (!loaded.ok) {
		return loaded;
	}
	const { content, entry } = loaded.value;
	if (entry.resolution) {
		return failure(
			"Offline Conflict Record already resolved",
			409,
			`Resolved as ${entry.resolution.choice}.`
		);
	}
	const issued = confirmations.issue(binding(scope, loaded.value));
	return success(
		offlineAbandonConfirmationSchema.parse({
			conflictId: entry.record.id,
			localDigest: entry.record.localDigest,
			operationCount: content.local.operations.length,
			appliedOperationCount: content.local.appliedOperationCount,
			operations: operationSummary(appliedOperations(content.local)),
			confirmationToken: issued.token,
			expiresAt: issued.expiresAt,
		})
	);
}

function abandonRefusal(
	scope: Scope,
	confirmations: AbandonConfirmations,
	readable: ReadableEntry,
	input: OfflineConflictResolveInput
) {
	const check =
		input.confirmAbandon === true
			? confirmations.check(binding(scope, readable), input.confirmationToken)
			: "invalid";
	if (check === "valid") {
		return null;
	}
	return failure(
		"Abandoning a local Working Draft needs confirmation",
		400,
		check === "expired"
			? "The confirmation expired; request the affected local content again."
			: "Request the affected local content, then send confirmAbandon: true with the confirmationToken it returned."
	);
}

function resolveResponse(
	readable: ReadableEntry,
	resolution: OfflineConflictResolutionRow,
	created: boolean
): Outcome<OfflineConflictResolveResponse> {
	return success(
		offlineConflictResolveResponseSchema.parse({
			conflict: buildView({
				...readable,
				entry: { ...readable.entry, resolution },
			}),
			created,
		}),
		created ? 201 : 200
	);
}

async function prepareCandidate(scope: Scope, readable: ReadableEntry) {
	const { content } = readable;
	const operations = appliedOperations(content.local);
	if (operations.length === 0) {
		return failure(
			"Invalid Offline Conflict request",
			400,
			"The local Working Draft has no changes to turn into a Candidate Version."
		);
	}
	return await renderVersion(
		scope,
		content.base.sourceAssetVersionId,
		operations
	);
}

type PreparedCandidate = Awaited<ReturnType<typeof prepareCandidate>>;

/**
 * Stores the one Candidate Version of a claimed record and completes the claim.
 * `release` drops a claim this request created when the write fails, so the
 * record stays open; a continued claim stays for its own key to retry.
 */
async function finishCandidate(
	scope: Scope,
	readable: ReadableEntry,
	claim: OfflineConflictResolutionRow,
	prepared: PreparedCandidate,
	release: boolean
): Promise<Outcome<OfflineConflictResolveResponse>> {
	const { access, dependencies } = scope;
	const { record } = readable.entry;
	const releaseClaim = async () => {
		if (release) {
			await dependencies.offlineConflictStore.releaseResolution(
				access.userId,
				record.id,
				claim.idempotencyKey
			);
		}
	};
	if (!prepared.ok) {
		await releaseClaim();
		return prepared;
	}
	const { png, sourceFile } = prepared.value;
	let stored: Awaited<ReturnType<typeof storePngCandidate>>;
	try {
		stored = await storePngCandidate(scope, {
			assetFamilyId: sourceFile.assetFamilyId,
			assetRecordId: sourceFile.assetRecordId,
			baseFileName: sourceFile.fileName ?? null,
			fallbackName: "pixel-edit",
			// One Candidate Version per record, whatever resolution key retries use.
			idempotencyKey: `offline-conflict:${record.id}`,
			png,
			suffix: sourceFile.fileName ? "-offline-draft" : "",
		});
	} catch (error) {
		await releaseClaim();
		throw error;
	}
	if (!stored.ok) {
		await releaseClaim();
		return failure(
			stored.error === "Not found"
				? "Not found"
				: "Working Draft commit failed",
			stored.status
		);
	}
	const completed = await dependencies.offlineConflictStore.completeResolution(
		access.userId,
		record.id,
		stored.assetVersionId
	);
	return completed
		? resolveResponse(readable, completed, true)
		: failure("Not found", 404);
}

/** Continues a claim whose Candidate Version is missing, replays a settled one, or refuses. */
async function continueResolution(
	scope: Scope,
	readable: ReadableEntry,
	resolution: OfflineConflictResolutionRow,
	input: OfflineConflictResolveInput,
	prepared: PreparedCandidate | null
): Promise<Outcome<OfflineConflictResolveResponse>> {
	if (resolution.idempotencyKey !== input.idempotencyKey) {
		return failure(
			"Offline Conflict Record already resolved",
			409,
			isPendingResolution(resolution)
				? "Another resolution is in progress."
				: `Resolved as ${resolution.choice}.`
		);
	}
	if (resolution.choice !== input.choice) {
		return failure(
			"Offline Conflict resolution key reused",
			409,
			`This key already resolved the record as ${resolution.choice}.`
		);
	}
	if (isPendingResolution(resolution)) {
		return await finishCandidate(
			scope,
			readable,
			resolution,
			prepared ?? (await prepareCandidate(scope, readable)),
			false
		);
	}
	return resolveResponse(readable, resolution, false);
}

export async function resolveOfflineConflict(
	scope: Scope,
	confirmations: AbandonConfirmations,
	conflictId: string,
	body: unknown
): Promise<Outcome<OfflineConflictResolveResponse>> {
	const { access, dependencies } = scope;
	const versionFailure = checkRequestContractVersion(body);
	if (versionFailure) {
		return versionFailure;
	}
	const parsed = offlineConflictResolveInputSchema.safeParse(body);
	if (!parsed.success) {
		return failure("Invalid Offline Conflict request", 400);
	}
	const input = parsed.data;
	const loaded = await loadEntry(scope, conflictId);
	if (!loaded.ok) {
		return loaded;
	}
	const readable = loaded.value;
	const { record, resolution } = readable.entry;
	if (resolution) {
		return await continueResolution(scope, readable, resolution, input, null);
	}
	if (input.choice === "abandon") {
		const refusal = abandonRefusal(scope, confirmations, readable, input);
		if (refusal) {
			return refusal;
		}
	}
	const prepared =
		input.choice === "create-candidate"
			? await prepareCandidate(scope, readable)
			: null;
	if (prepared && !prepared.ok) {
		return prepared;
	}
	// Claim the record before any Candidate Version exists.
	const claim = await dependencies.offlineConflictStore.createResolution(
		access.userId,
		{
			id: newId(dependencies),
			conflictId: record.id,
			projectId: access.projectId,
			choice: input.choice,
			idempotencyKey: input.idempotencyKey,
			resultAssetVersionId: null,
		}
	);
	if (!claim) {
		return failure("Not found", 404);
	}
	// A concurrent resolution may have won; the stored one is authoritative.
	if (claim.kind === "existing") {
		return await continueResolution(
			scope,
			readable,
			claim.resolution,
			input,
			prepared
		);
	}
	return prepared
		? await finishCandidate(scope, readable, claim.resolution, prepared, true)
		: resolveResponse(readable, claim.resolution, true);
}
