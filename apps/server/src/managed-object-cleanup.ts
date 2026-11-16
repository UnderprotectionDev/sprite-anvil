/** Retry only terminal import objects whose writers acknowledged completion. */
export function createManagedObjectCleanup(options: {
	listCandidates: () => Promise<string[]>;
	deleteObject: (key: string) => Promise<void>;
	release: (key: string) => Promise<void>;
}) {
	return async () => {
		for (const key of await options.listCandidates()) {
			// biome-ignore lint/performance/noAwaitInLoops: Durable ownership remains until deletion succeeds.
			await options.deleteObject(key);
			await options.release(key);
		}
	};
}
