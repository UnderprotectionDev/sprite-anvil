import { expect, test } from "bun:test";
import { setup } from "./fulfilment-test-env";

test("a Fulfilment stays verifiable until a pinned Asset Version is erased, then reads as unverifiable without any stored change", async () => {
	const env = setup();
	const { draft } = await env.prepare();
	const created = await env.finalize({ draftId: draft.id });
	expect(created.fulfilment.verifiable).toBe(true);
	const stored = env.storage.snapshot();

	// YAS-04: an Erasure Tombstone now stands where the pinned version was.
	env.storage.markErased(["v-idle"]);

	expect((await env.get(created.fulfilment.id)).verifiable).toBe(false);
	expect(
		(await env.list()).fulfilments.map((entry) => entry.verifiable)
	).toEqual([false]);
	// The state is derived on read: the immutable rows are untouched and keep their pins.
	expect(env.storage.snapshot()).toBe(stored);
	expect(
		(await env.get(created.fulfilment.id)).requirements.map((row) => [
			row.itemId,
			row.assetVersionIds,
		])
	).toContainEqual(["idle", ["v-idle"]]);
});

test("an erased version that no Fulfilment pins changes none of them", async () => {
	const env = setup();
	const { draft } = await env.prepare();
	const created = await env.finalize({ draftId: draft.id });

	env.storage.markErased(["v-unrelated"]);

	expect((await env.get(created.fulfilment.id)).verifiable).toBe(true);
});
