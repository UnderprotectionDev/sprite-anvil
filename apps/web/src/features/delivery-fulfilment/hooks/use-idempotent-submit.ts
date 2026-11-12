import { useRef, useState } from "react";
import { errorCodeOf } from "@/utils/error-code";

/**
 * Runs one write with a stable idempotency key. A success or a server-coded
 * rejection rotates the key, since the next attempt is a new act; a transport
 * failure keeps it so a retry replays the first attempt.
 */
export function useIdempotentSubmit(fallbackMessage: string) {
	const [failure, setFailure] = useState<string | null>(null);
	const idempotencyKey = useRef(crypto.randomUUID());

	async function submit(write: (idempotencyKey: string) => Promise<unknown>) {
		setFailure(null);
		try {
			await write(idempotencyKey.current);
			idempotencyKey.current = crypto.randomUUID();
		} catch (error) {
			if (errorCodeOf(error)) {
				idempotencyKey.current = crypto.randomUUID();
			}
			setFailure(
				error instanceof Error && error.message
					? error.message
					: fallbackMessage
			);
		}
	}

	return { failure, submit };
}
