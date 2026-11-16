import {
	createQueue,
	createStorage,
	requireCloudflareConfig,
} from "./cloudflare";
import { ENV } from "./env.server";
import { createOperationWorker } from "./operation-worker";
import { createServerOperationServices } from "./services";

const config = requireCloudflareConfig(ENV);
const queue = createQueue(config);
const storage = createStorage(config);
const { lifecycle } = createServerOperationServices({
	send: queue.sendOperation,
});
const worker = createOperationWorker({
	lifecycle,
	queue,
	handleUpload: storage.exists,
});

while (true) {
	try {
		// biome-ignore lint/performance/noAwaitInLoops: Polls must not overlap.
		await worker.poll();
	} catch {
		console.error("Queue poll failed");
	}
	await new Promise((resolve) => setTimeout(resolve, 2000));
}
