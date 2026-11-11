import { expect, test } from "bun:test";
import {
	buildDeliveryChangePackage,
	deliveryChangePackageSchema,
	renderDeliveryChangePackage,
} from "./delivery-change-package";
import {
	classifyDeliveryRefreshPaths,
	type DeliveryRefreshDecision,
} from "./delivery-refresh-classification";

const digest = (letter: string) => letter.repeat(64);
const executableName = /\.(sh|bat|cmd|exe|ps1|js|ts|py|command)$/i;
const executableKeys = ["command", "exec", "install", "run", "script", "shell"];

const previousFiles = [
	{ byteSize: 10, path: "a.png", sha256: digest("a") },
	{ byteSize: 10, path: "b.png", sha256: digest("b") },
];
const bundle = {
	bundleId: "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2003",
	bundleManifestDigest: digest("5"),
	files: [
		{ byteSize: 10, path: "a.png", sha256: digest("1") },
		{ byteSize: 10, path: "b.png", sha256: digest("2") },
	],
	profileId: "profile",
	profileRevisionId: "revision",
};
const previous = {
	bundleId: "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2002",
	destinationLabel: "Test game folder",
	files: previousFiles,
	id: "9c3b4e73-4e3f-4c97-9b8d-1f7d3a1e2010",
};

function build(decisions: DeliveryRefreshDecision[]) {
	const classification = classifyDeliveryRefreshPaths({
		next: bundle.files,
		observed: [
			{ path: "a.png", sha256: digest("a") },
			{ path: "b.png", sha256: digest("f") },
			{ path: "my-notes.txt", sha256: digest("9") },
		],
		previous: previousFiles,
	});
	return buildDeliveryChangePackage({
		bundle,
		classification,
		decisions,
		previous,
	});
}

function keysOf(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap(keysOf);
	}
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).flatMap(([key, inner]) => [
			key,
			...keysOf(inner),
		]);
	}
	return [];
}

test("the change package carries the proposed lock and the divergence report", () => {
	const pkg = build([{ decision: "replace", path: "b.png" }]);

	expect(
		deliveryChangePackageSchema.parse(
			JSON.parse(renderDeliveryChangePackage(pkg))
		)
	).toEqual(pkg);
	expect(pkg.report.outcome).toBe("complete");
	expect(pkg.report.entries.map((e) => [e.path, e.class, e.decision])).toEqual([
		["a.png", "to-update", null],
		["b.png", "diverged", "replace"],
	]);
	expect(pkg.lock).toMatchObject({
		bundleId: bundle.bundleId,
		contractVersion: "1.0.0",
		destinationLabel: "Test game folder",
	});
	expect(pkg.lock?.files.map((file) => file.path)).toEqual(["a.png", "b.png"]);
	expect(pkg.changes.map((change) => change.path)).toEqual(["a.png", "b.png"]);
	expect(pkg.previousLockId).toBe(previous.id);
});

test("an undecided divergence is reported as halted and the package proposes no lock", () => {
	const pkg = build([]);

	expect(pkg.report.outcome).toBe("halted");
	expect(pkg.report.halted.map((entry) => entry.path)).toEqual(["b.png"]);
	expect(pkg.lock).toBeNull();
	expect(pkg.changes.map((change) => change.path)).toEqual(["a.png"]);
});

test("a preserved path stays out of the proposed lock and the package shows a partial refresh", () => {
	const pkg = build([{ decision: "preserve", path: "b.png" }]);

	expect(pkg.report.outcome).toBe("partial");
	expect(pkg.lock?.files.map((file) => file.path)).toEqual(["a.png"]);
	expect(pkg.report.preserved).toEqual([
		{ decision: "preserve", path: "b.png" },
	]);
});

test("the package holds data only: no executable content, no unrecognised file, no absolute path", () => {
	for (const decisions of [
		[],
		[{ decision: "replace" as const, path: "b.png" }],
	]) {
		const text = renderDeliveryChangePackage(build(decisions));

		expect(text.startsWith("{")).toBe(true);
		expect(text).not.toContain("#!");
		expect(text).not.toContain("my-notes.txt");
		for (const key of keysOf(JSON.parse(text))) {
			expect(executableKeys).not.toContain(key);
		}
		for (const change of build(decisions).changes) {
			expect(change.path).not.toMatch(executableName);
		}
	}
});

test("a package whose contract version has an unknown major is not readable", () => {
	const pkg = JSON.parse(renderDeliveryChangePackage(build([])));

	expect(
		deliveryChangePackageSchema.safeParse({ ...pkg, contractVersion: "2.0.0" })
			.success
	).toBe(false);
	expect(
		deliveryChangePackageSchema.safeParse({ ...pkg, report: undefined }).success
	).toBe(false);
});
