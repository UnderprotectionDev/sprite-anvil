import {
	type CancelRequestResult,
	canRequestCancel,
} from "@sprite-anvil/api/background-operations";
import type { OperationStorage } from "./operation-storage";

/** Thrown by a checkpoint when the user asked to cancel and the executor may stop safely. */
export class OperationCancelledSignal extends Error {
	constructor() {
		super("The operation was asked to cancel.");
		this.name = "OperationCancelledSignal";
	}
}

const maxCompareAndSetRounds = 5;

/**
 * Records a cancel request. Pending becomes Cancelled directly; Running
 * becomes Cancel Requested and the executor stops it at its next checkpoint.
 * Every change is a compare-and-set, so a request that races a state change
 * re-reads and decides again; a repeated request changes nothing.
 */
export async function requestOperationCancel(
	storage: OperationStorage,
	backgroundOperationId: string,
	now: Date
): Promise<CancelRequestResult> {
	for (let round = 0; round < maxCompareAndSetRounds; round += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: Each round re-reads the record the previous change raced with.
		const current = await storage.get(backgroundOperationId);
		if (!current) {
			return { outcome: "not_found" };
		}
		if (!canRequestCancel(current.status)) {
			return current.status === "completed" || current.status === "failed"
				? { operation: current, outcome: "finished" }
				: { operation: current, outcome: "accepted" };
		}
		if (current.status === "pending") {
			if (await storage.cancelPending(backgroundOperationId, now)) {
				return await cancelAccepted(storage, backgroundOperationId);
			}
		} else if (await storage.requestCancelRunning(backgroundOperationId, now)) {
			return await cancelAccepted(storage, backgroundOperationId);
		}
	}
	throw new Error("The cancel request could not be recorded; try again.");
}

async function cancelAccepted(
	storage: OperationStorage,
	backgroundOperationId: string
): Promise<CancelRequestResult> {
	const operation = await storage.get(backgroundOperationId);
	if (!operation) {
		return { outcome: "not_found" };
	}
	return { operation, outcome: "accepted" };
}
