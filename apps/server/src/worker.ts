import {
	createQueue,
	createStorage,
	queueMessageSchema,
	requireCloudflareConfig,
} from "./cloudflare";
import { ENV } from "./env.server";

const config = requireCloudflareConfig(ENV);
const queue = createQueue(config);
const storage = createStorage(config);
const pollIntervalMs = 2000;

while (true) {
	try {
		// biome-ignore lint/performance/noAwaitInLoops: The next poll must wait for the current batch.
		const messages = await queue.pull();
		const acks: string[] = [];
		const retries: string[] = [];

		for (const message of messages) {
			try {
				const body: unknown =
					typeof message.body === "string"
						? JSON.parse(message.body)
						: message.body;
				const command = queueMessageSchema.parse(body);
				// biome-ignore lint/performance/noAwaitInLoops: Verify each leased object before acknowledging it.
				await storage.exists(command.key);
				acks.push(message.lease_id);
			} catch {
				retries.push(message.lease_id);
			}
		}

		if (acks.length > 0 || retries.length > 0) {
			await queue.settle(acks, retries);
		}
	} catch (error) {
		console.error("Queue poll failed", error);
	}

	await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}
