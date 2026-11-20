import { errorCodeOf } from "@/utils/error-code";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";

/**
 * Runs one write with a stable idempotency key. A success or a server-coded
 * rejection rotates the key, since the next attempt is a new act; a transport
 * failure keeps it so a retry replays the first attempt.
 */
export function useIdempotentSubmit() {
	const pendingKey = usePendingIdempotencyKey();

	async function submit(
		input: object,
		write: (idempotencyKey: string) => Promise<unknown>
	) {
		try {
			await write(pendingKey.keyFor(JSON.stringify(input)));
			pendingKey.clear();
		} catch (error) {
			if (errorCodeOf(error) && !isWriteOutcomeUncertain(error)) {
				pendingKey.clear();
			}
		}
	}

	return submit;
}
