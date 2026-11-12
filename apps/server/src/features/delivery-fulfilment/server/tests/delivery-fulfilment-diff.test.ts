import { expect, test } from "bun:test";
import {
	bundleA,
	bundleB,
	bundleC,
	conflictingBundles,
	fullBundle,
	item,
	makeRevision,
	newerRevisionId,
	otherProjectId,
	projectId,
	revisionId,
	setup,
	unknownId,
} from "./fulfilment-test-env";

const sameFulfilmentText = /two different/i;
const notRecordedKeys = [
	"qualityEvidence",
	"qualityException",
	"rights",
	"runtimeEvidence",
] as const;

/** Fulfilment 1 on revision 1, then revision 2 (new context, "run" dropped, "jump" added) fulfilled by another bundle. */
async function twoRevisionEnv() {
	const env = setup();
	const first = await env.finalize({
		draftId: (await env.prepare()).draft.id,
	});
	const revisionOne = env.state.activeRevision;
	if (!revisionOne) {
		throw new Error("setup has an active revision");
	}
	env.state.pastRevisions.push(revisionOne);
	const revisionTwo = makeRevision(newerRevisionId, 2, 2);
	env.state.activeRevision = {
		...revisionTwo,
		families: revisionTwo.families.map((family) => ({
			...family,
			requiredItems: [item("idle"), item("jump")],
		})),
	};
	env.state.bundles.push(
		fullBundle(
			bundleC,
			"2026-11-13T10:00:00.000Z",
			[
				{ assetVersionId: "v-idle-2", itemId: "idle" },
				{ assetVersionId: "v-jump", itemId: "jump" },
				{ assetVersionId: "v-ut", itemId: "ut-1" },
			],
			newerRevisionId
		)
	);
	const second = await env.finalize({
		draftId: (await env.prepare("prep-2")).draft.id,
		idempotencyKey: "fin-2",
	});
	return { env, first: first.fulfilment, second: second.fulfilment };
}

test("compares two Fulfilments into added, removed and changed Asset Versions, context and bundle mappings", async () => {
	const { env, first, second } = await twoRevisionEnv();
	const diff = await env.compare({
		fromFulfilmentId: first.id,
		toFulfilmentId: second.id,
	});

	expect([diff.from.id, diff.to.id]).toEqual([first.id, second.id]);
	expect([diff.from.revisionNumber, diff.to.revisionNumber]).toEqual([1, 2]);

	const { assetVersions } = diff;
	expect(assetVersions.added.map((entry) => entry.itemId)).toEqual(["jump"]);
	expect(assetVersions.added[0]?.assetVersionIds).toEqual(["v-jump"]);
	expect(assetVersions.removed.map((entry) => entry.itemId)).toEqual(["run"]);
	expect(assetVersions.removed[0]?.assetVersionIds).toEqual(["v-run"]);
	expect(assetVersions.changed).toEqual([
		expect.objectContaining({
			fromAssetVersionIds: ["v-idle"],
			itemId: "idle",
			toAssetVersionIds: ["v-idle-2"],
		}),
	]);
	expect(assetVersions.unchangedCount).toBe(1);

	expect(diff.context).toEqual({
		changed: true,
		from: { contextRevisionId: "ctx-1", contextRevisionNumber: 1 },
		status: "recorded",
		to: { contextRevisionId: "ctx-2", contextRevisionNumber: 2 },
	});

	// "ut-1" keeps its Asset Version but moved to another bundle: only the mapping differs.
	const byItem = new Map(
		diff.bundleMappings.changes.map((entry) => [entry.itemId, entry])
	);
	expect([...byItem.keys()].sort()).toEqual(["idle", "jump", "run", "ut-1"]);
	expect(byItem.get("ut-1")?.from?.bundleId).toBe(bundleA);
	expect(byItem.get("ut-1")?.to?.bundleId).toBe(bundleC);
	expect(byItem.get("run")?.to).toBeNull();
	expect(byItem.get("jump")?.from).toBeNull();
});

test("sections whose source data a Fulfilment does not record are explicit, not invented", async () => {
	const { env, first, second } = await twoRevisionEnv();
	const diff = await env.compare({
		fromFulfilmentId: first.id,
		toFulfilmentId: second.id,
	});
	for (const key of notRecordedKeys) {
		expect(diff[key]).toEqual({
			reason: expect.any(String),
			status: "not_recorded",
		});
	}
});

test("two Fulfilments of one revision show no context change but the picked bundle's versions", async () => {
	const env = setup({ bundles: conflictingBundles() });
	const { draft } = await env.prepare();
	const first = await env.finalize({
		draftId: draft.id,
		selections: [{ assetFamilyId: "fam-a", bundleId: bundleA, itemId: "idle" }],
	});
	const second = await env.finalize({
		draftId: draft.id,
		idempotencyKey: "fin-2",
		selections: [{ assetFamilyId: "fam-a", bundleId: bundleB, itemId: "idle" }],
	});
	const diff = await env.compare({
		fromFulfilmentId: first.fulfilment.id,
		toFulfilmentId: second.fulfilment.id,
	});
	expect(diff.context.status).toBe("recorded");
	expect(diff.context).toMatchObject({ changed: false });
	expect(diff.assetVersions.changed.map((entry) => entry.itemId)).toEqual([
		"idle",
	]);
	expect(diff.assetVersions.added).toEqual([]);
	expect(diff.assetVersions.removed).toEqual([]);
	expect(diff.bundleMappings.changes.map((entry) => entry.itemId)).toEqual([
		"idle",
	]);
	// Reversing the sides mirrors the diff.
	const reverse = await env.compare({
		fromFulfilmentId: second.fulfilment.id,
		toFulfilmentId: first.fulfilment.id,
	});
	expect(reverse.assetVersions.changed[0]).toMatchObject({
		fromAssetVersionIds: ["v-idle-2"],
		toAssetVersionIds: ["v-idle"],
	});
});

test("comparing writes nothing and leaves the Delivered status and current Fulfilment unchanged", async () => {
	const { env, first, second } = await twoRevisionEnv();
	const rowsBefore = env.storage.snapshot();
	const listBefore = await env.list();
	const deliveredBefore = await Promise.all([
		env.storage.hasFulfilment(projectId, revisionId),
		env.storage.hasFulfilment(projectId, newerRevisionId),
	]);

	await env.compare({ fromFulfilmentId: first.id, toFulfilmentId: second.id });
	await env.compare({ fromFulfilmentId: second.id, toFulfilmentId: first.id });

	expect(env.storage.snapshot()).toBe(rowsBefore);
	expect(await env.list()).toEqual(listBefore);
	expect(deliveredBefore).toEqual([true, true]);
	expect(
		await Promise.all([
			env.storage.hasFulfilment(projectId, revisionId),
			env.storage.hasFulfilment(projectId, newerRevisionId),
		])
	).toEqual(deliveredBefore);
	expect(await env.get(first.id)).toEqual(first);
});

test("refuses the same Fulfilment twice, a missing one, another project and a user without access", async () => {
	const { env, first, second } = await twoRevisionEnv();
	await expect(
		env.compare({ fromFulfilmentId: first.id, toFulfilmentId: first.id })
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: expect.stringMatching(sameFulfilmentText),
	});
	await expect(
		env.compare({ fromFulfilmentId: first.id, toFulfilmentId: unknownId })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		env.compare({ fromFulfilmentId: unknownId, toFulfilmentId: second.id })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	await expect(
		env.compare({
			fromFulfilmentId: first.id,
			projectId: otherProjectId,
			toFulfilmentId: second.id,
		})
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	env.state.hasAccess = false;
	await expect(
		env.compare({ fromFulfilmentId: first.id, toFulfilmentId: second.id })
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("a Fulfilment whose revision left the catalog still compares, with context shown as not recorded", async () => {
	const { env, first, second } = await twoRevisionEnv();
	env.state.pastRevisions.length = 0;
	const diff = await env.compare({
		fromFulfilmentId: first.id,
		toFulfilmentId: second.id,
	});
	expect(diff.context.status).toBe("not_recorded");
	expect(diff.assetVersions.added).toHaveLength(1);
});
