import { expect, test } from "bun:test";
import { createManagedObjectCleanup } from "../managed-object-cleanup";

test("retries terminal settled import cleanup without releasing ownership on delete failure", async () => {
	const owned = new Set(["archive.zip"]);
	let fail = true;
	const cleanup = createManagedObjectCleanup({
		listCandidates: () => Promise.resolve([...owned]),
		deleteObject: () =>
			fail
				? Promise.reject(new Error("storage unavailable"))
				: Promise.resolve(),
		release: (key) => {
			owned.delete(key);
			return Promise.resolve();
		},
	});
	await expect(cleanup()).rejects.toThrow("storage unavailable");
	expect(owned.has("archive.zip")).toBe(true);
	fail = false;
	await cleanup();
	expect(owned.size).toBe(0);
});
