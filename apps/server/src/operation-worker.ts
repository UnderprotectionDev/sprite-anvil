import { queueMessageSchema } from "./cloudflare";

/** Runs maintenance and consumes transport leases; records remain authoritative. */
export function createOperationWorker(options: {
	lifecycle: {
		reconcile: () => Promise<unknown>;
		publishOutbox: () => Promise<unknown>;
		deliver: (id: string) => Promise<unknown>;
	};
	queue: {
		pull: () => Promise<{ lease_id: string; body: unknown }[]>;
		settle: (acks: string[], retries: string[]) => Promise<void>;
	};
	handleUpload: (key: string) => Promise<void>;
}) {
	return {
		async poll() {
			await options.lifecycle.reconcile();
			await options.lifecycle.publishOutbox();
			const messages = await options.queue.pull();
			const acks: string[] = [];
			const retries: string[] = [];
			for (const message of messages) {
				try {
					const body: unknown =
						typeof message.body === "string"
							? JSON.parse(message.body)
							: message.body;
					const command = queueMessageSchema.parse(body);
					if (command.kind === "background-operation") {
						// biome-ignore lint/performance/noAwaitInLoops: Settle each leased delivery before processing the next.
						await options.lifecycle.deliver(command.backgroundOperationId);
					} else {
						await options.handleUpload(command.key);
					}
					acks.push(message.lease_id);
				} catch {
					retries.push(message.lease_id);
				}
			}
			if (acks.length || retries.length) {
				await options.queue.settle(acks, retries);
			}
		},
	};
}
