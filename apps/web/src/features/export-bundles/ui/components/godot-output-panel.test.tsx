// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
	buildGodotOutput,
	buildGodotOutputZip,
} from "@sprite-anvil/api/godot-output";
import {
	buildGoldenBundle,
	goldenTextures,
} from "@sprite-anvil/api/test-support/godot-golden-fixture";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { unzipSync } from "fflate";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GodotOutputPanel } from "./godot-output-panel";

const legacyText = /created before engine data was pinned/i;
const supportedText = /Godot 4\.3, 4\.4, 4\.5/;
const sourceText = /never a source of truth/i;
const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
const bundleId = "11111111-1111-4111-8111-111111111111";
const legacyBundleId = "22222222-2222-4222-8222-222222222222";

const transport = vi.hoisted(() => ({
	bundles: [] as unknown[],
	godotInputs: [] as unknown[],
	failGodot: null as Error | null,
	output: null as unknown,
	byteUrls: [] as string[],
}));

vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		exportBundles: {
			godotOutput: (input: unknown) => {
				transport.godotInputs.push(input);
				return transport.failGodot
					? Promise.reject(transport.failGodot)
					: Promise.resolve(transport.output);
			},
			list: () =>
				Promise.resolve({
					bundles: transport.bundles,
					latestBundleId: bundleId,
				}),
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});

vi.mock("@/utils/hono-api", () => ({
	honoGetBytes: (url: string) => {
		transport.byteUrls.push(url);
		const id = url.split("/").at(-2) as keyof typeof goldenTextures;
		return Promise.resolve(goldenTextures[id]);
	},
	projectApiUrl: (id: string) => `https://api.test/api/projects/${id}`,
}));

function summary(id: string, contractVersion: string, adapterVersion = null) {
	return {
		adapterVersion,
		contextRevisionId: "ctx-1",
		contractVersion,
		createdAt: "2026-11-10T10:00:00.000Z",
		deliveryTargetRevisionId: null,
		id,
		isLatest: id === bundleId,
		manifestDigest: "a".repeat(64),
		profileId: "p-1",
		profileRevisionId: "r-1",
	};
}

let downloads: { blob: Blob; name: string }[] = [];

beforeEach(async () => {
	downloads = [];
	transport.godotInputs = [];
	transport.byteUrls = [];
	transport.failGodot = null;
	// The catalog lists the oldest bundle first.
	transport.bundles = [
		summary(legacyBundleId, "1.0.0"),
		summary(bundleId, "1.1.0"),
	];
	const built = await buildGodotOutput(await buildGoldenBundle());
	transport.output = built.ok ? built.output : null;
	URL.createObjectURL = vi.fn((blob: Blob) => {
		downloads.push({ blob, name: "" });
		return "blob:godot";
	});
	URL.revokeObjectURL = vi.fn();
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
		this: HTMLAnchorElement
	) {
		const last = downloads.at(-1);
		if (last) {
			last.name = this.download;
		}
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function renderPanel() {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<GodotOutputPanel projectId={projectId} />
		</QueryClientProvider>
	);
}

test("lists the stored bundles and creates the Godot output of one as a zip download", async () => {
	renderPanel();

	expect(await screen.findByText("Godot output")).toBeVisible();
	const buttons = await screen.findAllByRole("button", {
		name: "Create Godot output",
	});
	expect(buttons).toHaveLength(2);
	await userEvent.click(buttons[0] as HTMLElement);

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Godot output downloaded"
	);
	expect(transport.godotInputs).toEqual([{ bundleId, projectId }]);
	expect(transport.byteUrls.sort()).toEqual([
		"https://api.test/api/projects/7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01/asset-versions/av-1/preview",
		"https://api.test/api/projects/7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01/asset-versions/av-2/preview",
	]);
	expect(downloads).toHaveLength(1);
	expect(downloads[0]?.name).toBe("godot-output-11111111.zip");
	const entries = unzipSync(
		new Uint8Array(await (downloads[0] as { blob: Blob }).blob.arrayBuffer())
	);
	expect(Object.keys(entries)).toContain("sprite_anvil/animations.json");
	const expected = buildGodotOutputZip(
		transport.output as never,
		new Map(Object.entries(goldenTextures))
	);
	expect(
		new Uint8Array(await (downloads[0] as { blob: Blob }).blob.arrayBuffer())
	).toEqual(expected);
});

test("a bundle created before engine data was pinned cannot be turned into Godot output", async () => {
	renderPanel();
	const buttons = await screen.findAllByRole("button", {
		name: "Create Godot output",
	});
	expect(buttons[1]).toBeDisabled();
	expect(screen.getByText(legacyText)).toBeVisible();
});

test("states the supported Godot versions and that the output is not the source", async () => {
	renderPanel();
	expect(await screen.findByText(supportedText)).toBeVisible();
	expect(screen.getByText(sourceText)).toBeVisible();
});

test("a refused output is shown as an error and nothing is downloaded", async () => {
	transport.failGodot = new Error("The bundle names another adapter.");
	renderPanel();
	const [button] = await screen.findAllByRole("button", {
		name: "Create Godot output",
	});
	await userEvent.click(button as HTMLElement);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"The bundle names another adapter."
	);
	expect(downloads).toHaveLength(0);
});

test("a project without bundles says so", async () => {
	transport.bundles = [];
	renderPanel();
	expect(await screen.findByText("No Export Bundles yet.")).toBeVisible();
});
