// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import {
	type LiveFileLinkAdapter,
	LiveFileLinkPanel,
} from "./live-file-link-panel";

const projectId = "project-ash-knight";
const assetRecordId = "record-ash-knight";
const sourcePath = "/Users/example/Art/Ash Knight.aseprite";
const exportPath = "/Users/example/Art/exports/ash-knight.webp";
const sourceBytes = new Uint8Array([1, 2, 3, 4]);
const exportBytes = new Uint8Array([5, 6, 7, 8]);
const changedStatusPattern = /Çalışma dosyası değişti/;

afterEach(() => {
	cleanup();
	window.localStorage.clear();
});

function createAdapter(chooseExport: () => Promise<string | null>) {
	let notifyChange: (() => void) | undefined;
	const adapter: LiveFileLinkAdapter = {
		isAvailable: true,
		chooseWorkingFile: () => Promise.resolve(sourcePath),
		chooseExport,
		readFile: (path) =>
			Promise.resolve(
				(path === sourcePath ? sourceBytes : exportBytes).slice()
			),
		stat: () =>
			Promise.resolve({
				isFile: true,
				size: sourceBytes.length,
				mtime: new Date(1000),
			}),
		watch: (_path, callback) => {
			notifyChange = callback;
			return Promise.resolve(vi.fn());
		},
		openPath: () => Promise.resolve(),
	};
	return { adapter, notifyChange: () => notifyChange?.() };
}

test("a watched file change creates a Candidate Version from a selected WebP and its source snapshot", async () => {
	const user = userEvent.setup();
	const { adapter, notifyChange } = createAdapter(() =>
		Promise.resolve(exportPath)
	);
	const onImport = vi.fn().mockResolvedValue(true);
	render(
		<LiveFileLinkPanel
			adapter={adapter}
			assetRecordId={assetRecordId}
			hasAssetFamily
			onImport={onImport}
			projectId={projectId}
		/>
	);

	await user.click(
		screen.getByRole("button", { name: "Çalışma dosyasını bağla" })
	);
	await waitFor(() =>
		expect(
			window.localStorage.getItem(
				`sprite-anvil.live-file-link:${projectId}:${assetRecordId}`
			)
		).toContain(sourcePath)
	);
	await waitFor(() => expect(notifyChange).toBeDefined());
	notifyChange();
	await screen.findByText(changedStatusPattern);
	await user.click(
		screen.getByRole("button", {
			name: "Değişikliği PNG/WebP olarak içe aktar",
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
				name: "Değişikliği PNG/WebP olarak içe aktar",
			})
		).toBeNull()
	);
});

test("cancelling the export picker leaves the file change pending", async () => {
	const user = userEvent.setup();
	const { adapter, notifyChange } = createAdapter(() => Promise.resolve(null));
	const onImport = vi.fn().mockResolvedValue(true);
	render(
		<LiveFileLinkPanel
			adapter={adapter}
			assetRecordId={assetRecordId}
			hasAssetFamily
			onImport={onImport}
			projectId={projectId}
		/>
	);

	await user.click(
		screen.getByRole("button", { name: "Çalışma dosyasını bağla" })
	);
	await waitFor(() => expect(notifyChange).toBeDefined());
	notifyChange();
	await user.click(
		await screen.findByRole("button", {
			name: "Değişikliği PNG/WebP olarak içe aktar",
		})
	);

	expect(onImport).not.toHaveBeenCalled();
	expect(
		screen.getByRole("button", {
			name: "Değişikliği PNG/WebP olarak içe aktar",
		})
	).toBeTruthy();
});
