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
	reconcileManagedObjects?: () => Promise<void>;
}) {
	async function maintain() {
		await options.lifecycle.reconcile();
		await options.lifecycle.publishOutbox();
		await options.reconcileManagedObjects?.();
	}

	async function consume() {
		const messages = await options.queue.pull();
		await Promise.all(
			messages.map(async (message) => {
				let succeeded = false;
				try {
					const body: unknown =
						typeof message.body === "string"
							? JSON.parse(message.body)
							: message.body;
					const command = queueMessageSchema.parse(body);
					if (command.kind === "background-operation") {
						await options.lifecycle.deliver(command.backgroundOperationId);
					} else {
						await options.handleUpload(command.key);
					}
					succeeded = true;
				} catch {
					// Failed deliveries are returned to the queue.
				}
				await options.queue.settle(
					succeeded ? [message.lease_id] : [],
					succeeded ? [] : [message.lease_id]
				);
			})
		);
	}

	return {
		maintain,
		consume,
		async poll() {
			await maintain();
			await consume();
		},
	};
}
