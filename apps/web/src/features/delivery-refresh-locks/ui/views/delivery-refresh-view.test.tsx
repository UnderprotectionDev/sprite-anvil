// @vitest-environment jsdom

import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { DeliveryRefreshView } from "./delivery-refresh-view";

const re0 = /Test game folder/;
const re1 = /Bundle created/;
const re2 = /^Unchanged/;
const re3 = /never read, changed or deleted/;
const re4 = /^Diverged/;
const re5 = /Refresh halted/;
const re6 = /^Refresh result/;
const re7 = /Partial refresh/;
const re8 = /Delivery completed/;
const re9 = /cannot refresh from/;
const re10 = /Export Bundle of/;
const re11 = /First delivery lock/;
const re12 = /not complete/;

const projectId = "11111111-1111-4111-8111-111111111111";
const lockId = "22222222-2222-4222-8222-222222222221";
const bundleId = "33333333-3333-4333-8333-333333333332";
const firstBundleId = "33333333-3333-4333-8333-333333333331";

const encoder = new TextEncoder();
const digestOf = (text: string) => sha256Hex(encoder.encode(text));

const api = vi.hoisted(() => ({
	apply: vi.fn(),
	lock: null as unknown,
	refresh: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		deliveryRefreshLocks: {
			apply: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => api.apply(input),
				}),
			},
			get: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(structuredClone(api.lock)),
					queryKey: ["lock"],
				}),
			},
			list: {
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({
							locks: [
								{
									createdAt: "2026-11-10T10:00:00.000Z",
									destinationLabel: "Test game folder",
									id: "22222222-2222-4222-8222-222222222221",
								},
							],
						}),
					queryKey: ["locks"],
				}),
			},
			refresh: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => api.refresh(input),
				}),
			},
		},
		exportBundles: {
			get: {
				queryOptions: () => ({
					queryFn: () => Promise.resolve(structuredClone(bundleState.bundle)),
					queryKey: ["bundle"],
				}),
			},
			list: {
				queryOptions: () => ({
					queryFn: () =>
						Promise.resolve({
							bundles: [
								{
									createdAt: "2026-11-11T10:00:00.000Z",
									id: "33333333-3333-4333-8333-333333333332",
								},
							],
							latestBundleId: "33333333-3333-4333-8333-333333333332",
						}),
					queryKey: ["bundles"],
				}),
			},
		},
	},
}));

const bundleState = vi.hoisted(() => ({ bundle: null as unknown }));

const contents = {
	"deleted.json": { lock: "gone", next: "gone", target: null },
	"dropped.json": { lock: "old", next: null, target: "old" },
	"edited.json": { lock: "v1", next: "v2", target: "my own edit" },
	"same.json": { lock: "same", next: "same", target: "same" },
	"update.json": { lock: "v1", next: "v2", target: "v1" },
} as const;
type Name = keyof typeof contents;
const names = Object.keys(contents) as Name[];

async function arrange(overrides: { contractVersion?: string } = {}) {
	const lockFiles = await Promise.all(
		names.map(async (path) => ({
			byteSize: contents[path].lock.length,
			path,
			sha256: await digestOf(contents[path].lock),
		}))
	);
	api.lock = {
		bundleId: firstBundleId,
		bundleManifestDigest: "a".repeat(64),
		contractVersion: overrides.contractVersion ?? "1.0.0",
		createdAt: "2026-11-10T10:00:00.000Z",
		destinationLabel: "Test game folder",
		files: lockFiles,
		id: lockId,
		lockDigest: "b".repeat(64),
		profile: {
			contentDigest: "c".repeat(64),
			profileId: "profile",
			revisionId: "revision",
			revisionNumber: 1,
		},
	};
	const nextNames = names.filter((name) => contents[name].next !== null);
	bundleState.bundle = {
		files: await Promise.all(
			nextNames.map(async (path) => {
				const text = contents[path].next as string;
				return {
					assetVersionId: null,
					byteSize: text.length,
					content: text,
					path,
					sha256: await digestOf(text),
				};
			})
		),
		id: bundleId,
		manifestDigest: "d".repeat(64),
		profileId: "profile",
		profileRevisionId: "revision",
	};
}

function folder(
	entries: Record<string, string | null>,
	extra: Record<string, string> = {}
): File[] {
	return Object.entries({ ...entries, ...extra })
		.filter((entry): entry is [string, string] => entry[1] !== null)
		.map(([path, text]) => {
			const file = new File([text], path.split("/").pop() ?? path);
			Object.defineProperty(file, "webkitRelativePath", {
				value: `game/${path}`,
			});
			return file;
		});
}

const targetFolder = () =>
	folder(
		Object.fromEntries(names.map((name) => [name, contents[name].target])),
		{ "my-notes.txt": "private" }
	);

function renderView() {
	render(
		<QueryClientProvider client={createQueryClient()}>
			<DeliveryRefreshView projectId={projectId} />
		</QueryClientProvider>
	);
}

async function review() {
	renderView();
	await screen.findByRole("option", { name: re0 });
	await screen.findByRole("option", { name: re1 });
	await userEvent.selectOptions(
		await screen.findByLabelText("Previous lock"),
		lockId
	);
	await userEvent.selectOptions(
		await screen.findByLabelText("New Export Bundle"),
		bundleId
	);
	await userEvent.upload(
		screen.getByLabelText("Destination folder"),
		targetFolder()
	);
}

const sectionOf = (name: string) =>
	screen.getByRole("region", { name: new RegExp(`^${name}`) });

let downloaded: Blob[] = [];

beforeEach(() => {
	downloaded = [];
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
		() => undefined
	);
	api.refresh.mockReset();
	api.apply.mockReset();
	vi.stubGlobal("URL", {
		...URL,
		createObjectURL: (blob: Blob) => {
			downloaded.push(blob);
			return "blob:change-package";
		},
		revokeObjectURL: () => undefined,
	});
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

test("the five path classes are listed apart and an unrecognised file is never shown or touched", async () => {
	await arrange();
	await review();

	await within(await screen.findByRole("region", { name: re2 })).findByText(
		"same.json"
	);
	expect(within(sectionOf("To update")).getByText("update.json")).toBeVisible();
	expect(within(sectionOf("Stale")).getByText("dropped.json")).toBeVisible();
	expect(within(sectionOf("Missing")).getByText("deleted.json")).toBeVisible();
	expect(within(sectionOf("Diverged")).getByText("edited.json")).toBeVisible();
	expect(screen.queryByText("my-notes.txt")).toBeNull();
	expect(screen.getByText(re3)).toBeVisible();
});

test("a diverged path halts the refresh until the user decides, and replace needs the diff first", async () => {
	await arrange();
	await review();
	const diverged = await screen.findByRole("region", { name: re4 });

	expect(screen.getByRole("status")).toHaveTextContent(re5);
	const replace = within(diverged).getByRole("radio", { name: "Replace" });
	expect(replace).toHaveAttribute("aria-disabled", "true");
	expect(
		within(diverged).getByRole("radio", { name: "Preserve" })
	).not.toHaveAttribute("aria-disabled", "true");
	expect(
		within(diverged).getByRole("radio", { name: "Pick another destination" })
	).not.toHaveAttribute("aria-disabled", "true");

	await userEvent.click(
		within(diverged).getByRole("button", { name: "Show differences" })
	);
	expect(within(diverged).getByText("my own edit")).toBeVisible();
	expect(within(diverged).getByText("v2")).toBeVisible();
	expect(replace).not.toHaveAttribute("aria-disabled", "true");

	await userEvent.click(replace);
	expect(screen.getByRole("status")).not.toHaveTextContent(re5);
});

test("the change package holds the lock and the divergence report and no unrecognised file", async () => {
	await arrange();
	await review();
	const diverged = await screen.findByRole("region", { name: re4 });

	await userEvent.click(
		screen.getByRole("button", { name: "Download change package" })
	);
	const halted = JSON.parse(await downloaded[0]?.text());
	expect(halted.report.outcome).toBe("halted");
	expect(halted.lock).toBeNull();

	await userEvent.click(
		within(diverged).getByRole("radio", { name: "Preserve" })
	);
	await userEvent.click(
		screen.getByRole("button", { name: "Download change package" })
	);
	const partial = JSON.parse(await downloaded[1]?.text());
	expect(partial.report.outcome).toBe("partial");
	expect(partial.lock.files.map((f: { path: string }) => f.path)).not.toContain(
		"edited.json"
	);
	expect(
		partial.report.entries.map((e: { path: string }) => e.path)
	).not.toContain("my-notes.txt");
	expect(JSON.stringify(partial)).not.toContain("my-notes.txt");
});

test("recording a refresh reports the folder state; a preserved path shows a partial result, not a completed delivery", async () => {
	await arrange();
	api.refresh.mockResolvedValue({
		applied: ["deleted.json", "update.json"],
		lock: { id: "22222222-2222-4222-8222-222222222229" },
		outcome: "partial",
		preserved: [{ decision: "preserve", path: "edited.json" }],
		status: "created",
	});
	await review();
	const diverged = await screen.findByRole("region", { name: re4 });
	await userEvent.click(
		within(diverged).getByRole("radio", { name: "Preserve" })
	);

	const updated = folder(
		{
			"deleted.json": "gone",
			"edited.json": "my own edit",
			"same.json": "same",
			"update.json": "v2",
		},
		{ "my-notes.txt": "private" }
	);
	await userEvent.upload(
		screen.getByLabelText("Updated destination folder"),
		updated
	);
	await userEvent.click(screen.getByRole("button", { name: "Record refresh" }));

	await waitFor(() => expect(api.refresh).toHaveBeenCalledTimes(1));
	const input = api.refresh.mock.calls[0]?.[0];
	expect(input).toMatchObject({
		bundleId,
		decisions: [{ decision: "preserve", path: "edited.json" }],
		previousLockId: lockId,
		projectId,
	});
	expect(input.written).toEqual([
		{ path: "deleted.json", sha256: await digestOf("gone") },
		{ path: "update.json", sha256: await digestOf("v2") },
	]);
	expect(input.observed.map((o: { path: string }) => o.path)).not.toContain(
		"my-notes.txt"
	);
	expect(input.idempotencyKey).toBeTruthy();

	const result = await screen.findByRole("region", { name: re6 });
	expect(result).toHaveTextContent(re7);
	expect(within(result).getByText("update.json")).toBeVisible();
	expect(within(result).getByText("edited.json")).toBeVisible();
	expect(result).not.toHaveTextContent(re8);
});

test("a halted server result lists applied paths and halted divergences apart", async () => {
	await arrange();
	api.refresh.mockResolvedValue({
		applied: ["update.json"],
		halted: [
			{
				class: "diverged",
				lockSha256: "a".repeat(64),
				nextSha256: "b".repeat(64),
				path: "edited.json",
				targetSha256: "c".repeat(64),
			},
		],
		preserved: [],
		status: "halted",
	});
	await review();
	await screen.findByRole("region", { name: re4 });
	await userEvent.upload(
		screen.getByLabelText("Updated destination folder"),
		folder({ "update.json": "v2" })
	);
	await userEvent.click(screen.getByRole("button", { name: "Record refresh" }));

	const result = await screen.findByRole("region", { name: re6 });
	expect(result).toHaveTextContent(re5);
	expect(
		within(result).getByRole("list", { name: "Applied paths" })
	).toHaveTextContent("update.json");
	expect(
		within(result).getByRole("list", { name: "Halted divergences" })
	).toHaveTextContent("edited.json");
});

test("a lock with an unknown major version stops the refresh before any review", async () => {
	await arrange({ contractVersion: "2.0.0" });
	await review();

	expect(await screen.findByRole("alert")).toHaveTextContent(re9);
	expect(screen.queryByRole("region", { name: re4 })).toBeNull();
	expect(screen.queryByRole("button", { name: "Record refresh" })).toBeNull();
});

const bundleFolder = (omit: Name[] = []) =>
	folder(
		Object.fromEntries(
			names
				.filter((name) => contents[name].next !== null && !omit.includes(name))
				.map((name) => [name, contents[name].next])
		),
		{ "my-notes.txt": "private" }
	);

async function startFirstApply(files: File[]) {
	renderView();
	await screen.findByRole("option", { name: re10 });
	await userEvent.selectOptions(
		await screen.findByLabelText("Bundle to apply"),
		bundleId
	);
	await userEvent.type(
		screen.getByLabelText("Destination label"),
		"Fresh game folder"
	);
	await userEvent.upload(
		screen.getByLabelText("Folder the bundle was written to"),
		files
	);
}

test("the first apply reads only the bundle's paths, applies it and shows the lock it made", async () => {
	await arrange();
	const bundle = bundleState.bundle as {
		files: { byteSize: number; path: string; sha256: string }[];
	};
	api.apply.mockResolvedValue({
		lock: {
			...(api.lock as object),
			destinationLabel: "Fresh game folder",
			files: bundle.files.map(({ byteSize, path, sha256 }) => ({
				byteSize,
				path,
				sha256,
			})),
			id: "22222222-2222-4222-8222-222222222229",
		},
		status: "created",
	});
	await startFirstApply(bundleFolder());
	await userEvent.click(
		screen.getByRole("button", { name: "Apply bundle and lock" })
	);

	await waitFor(() => expect(api.apply).toHaveBeenCalledTimes(1));
	const input = api.apply.mock.calls[0]?.[0];
	expect(input).toMatchObject({
		bundleId,
		destinationLabel: "Fresh game folder",
		projectId,
	});
	expect(input.idempotencyKey).toBeTruthy();
	expect(input.written).toEqual(
		bundle.files.map(({ path, sha256 }) => ({ path, sha256 }))
	);
	expect(JSON.stringify(input)).not.toContain("my-notes.txt");

	const result = await screen.findByRole("region", { name: re11 });
	expect(within(result).getByText("Fresh game folder")).toBeVisible();
	expect(within(result).getByText("update.json")).toBeVisible();
	expect(within(result).queryByText("my-notes.txt")).toBeNull();
});

test("a folder that lacks a bundle file is not applied and no lock is requested", async () => {
	await arrange();
	await startFirstApply(bundleFolder(["update.json"]));
	await userEvent.click(
		screen.getByRole("button", { name: "Apply bundle and lock" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(re12);
	expect(api.apply).not.toHaveBeenCalled();
});
