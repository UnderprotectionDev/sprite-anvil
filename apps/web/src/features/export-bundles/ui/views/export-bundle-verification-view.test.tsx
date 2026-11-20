// @vitest-environment jsdom

import type { ExportBundleVerificationFile } from "@sprite-anvil/api/export-bundle-verification";
import {
	buildFixtureBundleFiles,
	replaceFile,
} from "@sprite-anvil/api/test-support/export-bundle-verification-fixture";
import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ExportBundleVerificationView } from "./export-bundle-verification-view";

afterEach(cleanup);
afterEach(() => onlineManager.setOnline(true));

const verifiedText = /Bundle verified/u;
const failedText = /Integrity check failed/u;
const manifestErrorText = /The manifest could not be summarized: .*JSON/u;

function renderVerifier() {
	return render(
		<QueryClientProvider client={createQueryClient()}>
			<ExportBundleVerificationView />
		</QueryClientProvider>
	);
}

function directoryFiles(files: ExportBundleVerificationFile[]): File[] {
	return files.map((entry) => {
		const file = new File(
			[entry.bytes as BlobPart],
			entry.path.split("/").pop() ?? ""
		);
		Object.defineProperty(file, "webkitRelativePath", {
			value: `bundle/${entry.path}`,
		});
		return file;
	});
}

async function chooseBundle(files: ExportBundleVerificationFile[]) {
	renderVerifier();
	await userEvent.upload(
		screen.getByLabelText("Bundle directory"),
		directoryFiles(files)
	);
}

test("an intact bundle shows its manifest and a verified result", async () => {
	await chooseBundle(await buildFixtureBundleFiles());

	expect(await screen.findByText(verifiedText)).toBeVisible();
	expect(screen.getByText("Manifest contract version")).toBeVisible();
	expect(screen.getByText("1.1.0")).toBeVisible();
	expect(screen.getByText("Profile revision")).toBeVisible();
	expect(screen.getByText("Context revision")).toBeVisible();
	expect(screen.getByText("Waivers")).toBeVisible();
});

test("verifies the selected files when the query client is offline", async () => {
	onlineManager.setOnline(false);
	await chooseBundle(await buildFixtureBundleFiles());
	expect(await screen.findByText(verifiedText)).toBeVisible();
});

test("a corrupted file is reported with its path", async () => {
	await chooseBundle(
		replaceFile(
			await buildFixtureBundleFiles(),
			"images/hero_idle.png",
			Uint8Array.of(0)
		)
	);

	expect(await screen.findByText(failedText)).toBeVisible();
	expect(
		screen.getByText(
			"The file images/hero_idle.png does not have the size the manifest records."
		)
	).toBeVisible();
	expect(screen.queryByText(verifiedText)).toBeNull();
});

test("a directory without a manifest fails and names the missing file", async () => {
	await chooseBundle(
		(await buildFixtureBundleFiles()).filter(
			(file) => file.path !== "manifest.json"
		)
	);

	await waitFor(() =>
		expect(screen.getByText("The file manifest.json is missing.")).toBeVisible()
	);
});

test("a file that cannot be read shows why the directory could not be read", async () => {
	const files = directoryFiles(await buildFixtureBundleFiles());
	const [first] = files;
	if (!first) {
		throw new Error("The fixture bundle has files.");
	}
	Object.defineProperty(first, "arrayBuffer", {
		value: () => Promise.reject(new Error("The disk went away.")),
	});
	renderVerifier();
	await userEvent.upload(screen.getByLabelText("Bundle directory"), files);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"The chosen directory could not be read: The disk went away."
	);
});

test("a manifest that cannot be summarized shows the reason next to the failed result", async () => {
	await chooseBundle(
		replaceFile(await buildFixtureBundleFiles(), "manifest.json", "{ not json")
	);

	expect(await screen.findByText(failedText)).toBeVisible();
	expect(await screen.findByRole("alert")).toHaveTextContent(manifestErrorText);
});

test("a slow failure from a previously selected directory leaves the latest result visible", async () => {
	const bundle = await buildFixtureBundleFiles();
	const oldDirectory = directoryFiles(bundle);
	const [first] = oldDirectory;
	if (!first) {
		throw new Error("The fixture bundle has files.");
	}
	const pending = Promise.withResolvers<ArrayBuffer>();
	Object.defineProperty(first, "arrayBuffer", { value: () => pending.promise });
	renderVerifier();
	const input = screen.getByLabelText("Bundle directory");
	await userEvent.upload(input, oldDirectory);
	await screen.findByText("Verifying bundle…");
	await userEvent.upload(input, directoryFiles(bundle));
	expect(await screen.findByText(verifiedText)).toBeVisible();
	await act(async () => {
		pending.reject(new Error("The previous directory was removed."));
		await pending.promise.catch(() => undefined);
	});
	expect(screen.queryByRole("alert")).toBeNull();
	expect(screen.getByText(verifiedText)).toBeVisible();
});
