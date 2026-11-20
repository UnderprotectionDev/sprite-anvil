// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	render as renderInDom,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { LiveFileLinkAdapter } from "@/components/live-file-link-panel";
import { LiveFileLinkPanel } from "@/components/live-file-link-panel";
import type {
	LiveFileLinkStore,
	StoredLiveFileLink,
} from "@/features/production-provenance/lib/live-file-link-store";

const projectId = "project-ash-knight";
const assetRecordId = "record-ash-knight";
const sourcePath = "/Users/example/Art/Ash Knight.aseprite";
const exportPath = "/Users/example/Art/exports/ash-knight.webp";
const sourceBytes = new Uint8Array([1, 2, 3, 4]);
const exportBytes = new Uint8Array([5, 6, 7, 8]);
const changedStatusPattern = /The working file changed/u;

afterEach(() => {
	cleanup();
});

function render(component: ReactElement, queryClient = new QueryClient()) {
	return renderInDom(
		<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
	);
}

function createMemoryStore(initial?: StoredLiveFileLink) {
	const links = new Map<string, StoredLiveFileLink>();
	const keyOf = (project: string, record: string) => `${project}:${record}`;
	if (initial) {
		links.set(keyOf(projectId, assetRecordId), initial);
	}
	const linkStore: LiveFileLinkStore = {
		read: (project, record) =>
			Promise.resolve(links.get(keyOf(project, record)) ?? null),
		write: (project, record, link) => {
			links.set(keyOf(project, record), link);
			return Promise.resolve();
		},
	};
	return {
		linkStore,
		stored: () => links.get(keyOf(projectId, assetRecordId)),
	};
}

async function clickConnect(user: ReturnType<typeof userEvent.setup>) {
	const connect = await screen.findByRole("button", {
		name: "Link working file",
	});
	await waitFor(() => expect(connect.hasAttribute("disabled")).toBe(false));
	await user.click(connect);
}

function createAdapter(
	chooseExport: () => Promise<string | null>,
	mtime: Date | null = new Date(1000)
) {
	let notifyChange: (() => void) | undefined;
	let currentSourceSize = sourceBytes.length;
	const adapter: LiveFileLinkAdapter = {
		isAvailable: true,
		chooseWorkingFile: () => Promise.resolve(sourcePath),
		chooseExport,
		readFile: (path) =>
			Promise.resolve(
				path === sourcePath
					? new Uint8Array(currentSourceSize).fill(1)
					: exportBytes.slice()
			),
		stat: (path) =>
			Promise.resolve({
				isFile: true,
				size: path === sourcePath ? currentSourceSize : exportBytes.length,
				mtime,
			}),
		watch: (_path, callback) => {
			notifyChange = callback;
			return Promise.resolve(vi.fn());
		},
		openPath: () => Promise.resolve(),
	};
	return {
		adapter,
		notifyChange: (nextSourceSize?: number) => {
			if (nextSourceSize !== undefined) {
				currentSourceSize = nextSourceSize;
			}
			notifyChange?.();
		},
	};
}

test("a watched file change creates a Candidate Version from a selected WebP and its source snapshot", async () => {
	const user = userEvent.setup();
	const { adapter, notifyChange } = createAdapter(() =>
		Promise.resolve(exportPath)
	);
	const onImport = vi.fn().mockResolvedValue(true);
	const { linkStore, stored } = createMemoryStore();
	render(
		<LiveFileLinkPanel
			adapter={adapter}
			assetRecordId={assetRecordId}
			hasAssetFamily
			linkStore={linkStore}
			onImport={onImport}
			projectId={projectId}
		/>
	);

	await clickConnect(user);
	await waitFor(() => expect(stored()?.path).toBe(sourcePath));
	await waitFor(() => expect(notifyChange).toBeDefined());
	notifyChange();
	await screen.findByText(changedStatusPattern);
	await user.click(
		screen.getByRole("button", {
			name: "Import change as PNG/WebP",
		})
	);

	await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
	const [candidateFile, sourceFile] = onImport.mock.calls[0] as [File, File];
	expect(candidateFile.name).toBe("ash-knight.webp");
	expect(candidateFile.type).toBe("image/webp");
	expect(sourceFile.name).toBe("Ash Knight.aseprite");
	expect(sourceFile.type).toBe("application/octet-stream");
	await waitFor(() =>
		expect(
			screen.queryByRole("button", {
				name: "Import change as PNG/WebP",
			})
		).toBeNull()
	);
});

test("cancelling the export picker leaves the file change pending", async () => {
	const user = userEvent.setup();
	const { adapter, notifyChange } = createAdapter(() => Promise.resolve(null));
	const onImport = vi.fn().mockResolvedValue(true);
	const { linkStore } = createMemoryStore();
	render(
		<LiveFileLinkPanel
			adapter={adapter}
			assetRecordId={assetRecordId}
			hasAssetFamily
			linkStore={linkStore}
			onImport={onImport}
			projectId={projectId}
		/>
	);

	await clickConnect(user);
	await waitFor(() => expect(notifyChange).toBeDefined());
	notifyChange();
	await user.click(
		await screen.findByRole("button", {
			name: "Import change as PNG/WebP",
		})
	);

	expect(onImport).not.toHaveBeenCalled();
	expect(
		screen.getByRole("button", {
			name: "Import change as PNG/WebP",
		})
	).toBeTruthy();
});

test("a successful import preserves a null source mtime as the unchanged baseline", async () => {
	const user = userEvent.setup();
	const { adapter, notifyChange } = createAdapter(
		() => Promise.resolve(exportPath),
		null
	);
	const onImport = vi.fn().mockResolvedValue(true);
	const { linkStore, stored } = createMemoryStore();
	render(
		<LiveFileLinkPanel
			adapter={adapter}
			assetRecordId={assetRecordId}
			hasAssetFamily
			linkStore={linkStore}
			onImport={onImport}
			projectId={projectId}
		/>
	);

	await clickConnect(user);
	await waitFor(() => expect(notifyChange).toBeDefined());
	notifyChange(5);
	await screen.findByText(changedStatusPattern);
	await user.click(
		screen.getByRole("button", {
			name: "Import change as PNG/WebP",
		})
	);

	await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
	expect(stored()).toMatchObject({ modifiedAt: null, size: 5 });
	await waitFor(() =>
		expect(
			screen.queryByRole("button", {
				name: "Import change as PNG/WebP",
			})
		).toBeNull()
	);
});

test("a link stored earlier is restored on mount and watched without reconnecting", async () => {
	const { adapter, notifyChange } = createAdapter(() =>
		Promise.resolve(exportPath)
	);
	const { linkStore } = createMemoryStore({
		modifiedAt: 1000,
		path: sourcePath,
		size: sourceBytes.length,
	});
	const queryClient = new QueryClient();
	render(
		<LiveFileLinkPanel
			adapter={adapter}
			assetRecordId={assetRecordId}
			hasAssetFamily
			linkStore={linkStore}
			onImport={vi.fn().mockResolvedValue(true)}
			projectId={projectId}
		/>,
		queryClient
	);

	expect(await screen.findByText("Ash Knight.aseprite")).toBeTruthy();
	expect(
		queryClient.getQueryData(["live-file-link", projectId, assetRecordId])
	).toEqual({ path: sourcePath, modifiedAt: 1000, size: sourceBytes.length });
	expect(
		screen.getByRole("button", {
			name: "Refresh working file link",
		})
	).toBeTruthy();
	await waitFor(() => expect(notifyChange).toBeDefined());
	notifyChange();
	await screen.findByText(changedStatusPattern);
});

test("the connect button stays disabled until the stored link has loaded", async () => {
	const { adapter } = createAdapter(() => Promise.resolve(exportPath));
	let resolveRead: (link: StoredLiveFileLink | null) => void = () => undefined;
	const linkStore: LiveFileLinkStore = {
		read: () =>
			new Promise((resolve) => {
				resolveRead = resolve;
			}),
		write: () => Promise.resolve(),
	};
	render(
		<LiveFileLinkPanel
			adapter={adapter}
			assetRecordId={assetRecordId}
			hasAssetFamily
			linkStore={linkStore}
			onImport={vi.fn().mockResolvedValue(true)}
			projectId={projectId}
		/>
	);

	expect(
		screen
			.getByRole("button", { name: "Link working file" })
			.hasAttribute("disabled")
	).toBe(true);
	resolveRead(null);
	await waitFor(() =>
		expect(
			screen
				.getByRole("button", { name: "Link working file" })
				.hasAttribute("disabled")
		).toBe(false)
	);
});
