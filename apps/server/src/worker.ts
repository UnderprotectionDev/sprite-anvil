import {
	createQueue,
	createStorage,
	requireCloudflareConfig,
} from "./cloudflare";
import { createDatabaseManagedObjectCleanupCandidates } from "./database-managed-object-cleanup";
import { createDatabaseManagedObjectReservations } from "./database-managed-object-reservations";
import { ENV } from "./env.server";
import { createManagedObjectCleanup } from "./managed-object-cleanup";
import { createOperationWorker } from "./operation-worker";
import { createServerOperationServices, db } from "./services";

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
	reconcileManagedObjects: createManagedObjectCleanup({
		listCandidates: createDatabaseManagedObjectCleanupCandidates(db),
		deleteObject: storage.delete,
		release: createDatabaseManagedObjectReservations(db).release,
	}),
});

async function runLoop(action: () => Promise<void>, label: string) {
	while (true) {
		try {
			// biome-ignore lint/performance/noAwaitInLoops: Each loop waits for its previous iteration.
			await action();
		} catch {
			console.error(`${label} failed`);
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
}

await Promise.all([
	runLoop(worker.maintain, "Operation maintenance"),
	runLoop(worker.consume, "Queue poll"),
]);
