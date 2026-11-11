import { expect, test } from "bun:test";
import {
	checkDeliveryRefreshLockContract,
	classifyDeliveryRefreshPaths,
	deliveryRefreshDecisionSchema,
	planDeliveryRefresh,
} from "./delivery-refresh-classification";

const digest = (letter: string) => letter.repeat(64);

const previous = [
	{ path: "unchanged.png", sha256: digest("a") },
	{ path: "update.png", sha256: digest("b") },
	{ path: "dropped.png", sha256: digest("c") },
	{ path: "deleted.png", sha256: digest("d") },
	{ path: "edited.png", sha256: digest("e") },
];
const next = [
	{ path: "unchanged.png", sha256: digest("a") },
	{ path: "update.png", sha256: digest("1") },
	{ path: "deleted.png", sha256: digest("d") },
	{ path: "edited.png", sha256: digest("2") },
	{ path: "brand-new.png", sha256: digest("3") },
];
const observed = [
	{ path: "unchanged.png", sha256: digest("a") },
	{ path: "update.png", sha256: digest("b") },
	{ path: "dropped.png", sha256: digest("c") },
	{ path: "deleted.png", sha256: null },
	{ path: "edited.png", sha256: digest("f") },
	// A file Sprite Anvil never wrote: it is not in the lock or the bundle.
	{ path: "my-notes.txt", sha256: digest("9") },
];

function classes(entries: { class: string; path: string }[]) {
	return Object.fromEntries(entries.map((e) => [e.path, e.class]));
}

test("every lock-owned path lands in exactly one of the five classes", () => {
	const { entries } = classifyDeliveryRefreshPaths({
		next,
		observed,
		previous,
	});

	expect(classes(entries)).toEqual({
		"brand-new.png": "to-update",
		"deleted.png": "missing",
		"dropped.png": "stale",
		"edited.png": "diverged",
		"unchanged.png": "unchanged",
		"update.png": "to-update",
	});
});

test("an unrecognised target file is never classified, written or deleted", () => {
	const { entries } = classifyDeliveryRefreshPaths({
		next,
		observed,
		previous,
	});

	expect(entries.map((entry) => entry.path)).not.toContain("my-notes.txt");
});

test("a modified owned path carries the three digests the review shows", () => {
	const { entries } = classifyDeliveryRefreshPaths({
		next,
		observed,
		previous,
	});

	expect(entries.find((entry) => entry.path === "edited.png")).toMatchObject({
		lockSha256: digest("e"),
		nextSha256: digest("2"),
		targetSha256: digest("f"),
	});
});

test("a target that already holds the new bundle's bytes is unchanged, not diverged", () => {
	const { entries } = classifyDeliveryRefreshPaths({
		next,
		observed: observed.map((entry) =>
			entry.path === "edited.png" ? { ...entry, sha256: digest("2") } : entry
		),
		previous,
	});

	expect(classes(entries)["edited.png"]).toBe("unchanged");
});

test("a bundle path the lock never owned, but the target already holds with other bytes, waits for a decision", () => {
	const { entries } = classifyDeliveryRefreshPaths({
		next,
		observed: [...observed, { path: "brand-new.png", sha256: digest("8") }],
		previous,
	});

	expect(classes(entries)["brand-new.png"]).toBe("diverged");
});

test("an unreported path is an absent target path", () => {
	const { entries } = classifyDeliveryRefreshPaths({
		next,
		observed: [],
		previous,
	});

	expect(classes(entries)["unchanged.png"]).toBe("missing");
	expect(classes(entries)["brand-new.png"]).toBe("to-update");
});

test("the plan halts on a diverged path until it has a decision", () => {
	const classification = classifyDeliveryRefreshPaths({
		next,
		observed,
		previous,
	});

	const undecided = planDeliveryRefresh(classification, []);
	expect(undecided.outcome).toBe("halted");
	expect(undecided.halted.map((entry) => entry.path)).toEqual(["edited.png"]);
	expect(undecided.applied).toEqual([
		"brand-new.png",
		"deleted.png",
		"update.png",
	]);
	expect(undecided.applied).not.toContain("edited.png");
});

test("replace writes the diverged path, preserve keeps it back and shows the refresh as partial", () => {
	const classification = classifyDeliveryRefreshPaths({
		next,
		observed,
		previous,
	});

	const replaced = planDeliveryRefresh(classification, [
		{ decision: "replace", path: "edited.png" },
	]);
	expect(replaced.outcome).toBe("complete");
	expect(replaced.applied).toContain("edited.png");

	for (const decision of ["preserve", "other_destination"] as const) {
		const held = planDeliveryRefresh(classification, [
			{ decision, path: "edited.png" },
		]);
		expect(held.outcome).toBe("partial");
		expect(held.applied).not.toContain("edited.png");
		expect(held.held).toEqual([{ decision, path: "edited.png" }]);
		expect(held.halted).toEqual([]);
	}
});

test("a diverged path the new bundle no longer ships needs no decision", () => {
	const classification = classifyDeliveryRefreshPaths({
		next,
		observed: observed.map((entry) =>
			entry.path === "dropped.png" ? { ...entry, sha256: digest("f") } : entry
		),
		previous,
	});

	expect(classes(classification.entries)["dropped.png"]).toBe("diverged");
	expect(
		planDeliveryRefresh(classification, [
			{ decision: "preserve", path: "edited.png" },
		]).halted
	).toEqual([]);
});

const validLock = {
	bundleId: "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2002",
	bundleManifestDigest: digest("a"),
	contractVersion: "1.0.0",
	destinationLabel: "Game folder",
	files: [{ byteSize: 3, path: "a.png", sha256: digest("b") }],
	lockDigest: digest("c"),
	profileId: "p",
	profileRevisionId: "r",
};

test("a lock with a known major version and every required field can be refreshed", () => {
	expect(checkDeliveryRefreshLockContract(validLock)).toEqual({ ok: true });
	expect(
		checkDeliveryRefreshLockContract({
			...validLock,
			contractVersion: "1.7.2",
		})
	).toEqual({ ok: true });
});

test("an unknown major version or a missing required field stops the refresh", () => {
	expect(
		checkDeliveryRefreshLockContract({
			...validLock,
			contractVersion: "2.0.0",
		})
	).toEqual({ ok: false, reason: "unsupported_major" });
	expect(
		checkDeliveryRefreshLockContract({ ...validLock, contractVersion: "" })
	).toEqual({ ok: false, reason: "malformed" });

	for (const field of Object.keys(validLock)) {
		const { [field]: _removed, ...rest } = validLock as Record<string, unknown>;
		expect(checkDeliveryRefreshLockContract(rest)).toMatchObject({
			ok: false,
		});
	}
	expect(checkDeliveryRefreshLockContract({ ...validLock, files: [] })).toEqual(
		{ ok: false, reason: "malformed" }
	);
	expect(checkDeliveryRefreshLockContract(null)).toEqual({
		ok: false,
		reason: "malformed",
	});
});

test("a decision naming a path outside the destination is refused at the boundary", () => {
	for (const path of ["/etc/passwd", "../outside.png", "a\\b.png", "C:/x"]) {
		expect(
			deliveryRefreshDecisionSchema.safeParse({ decision: "replace", path })
				.success
		).toBe(false);
	}
	expect(
		deliveryRefreshDecisionSchema.safeParse({
			decision: "replace",
			path: "images/a.png",
		}).success
	).toBe(true);
});
