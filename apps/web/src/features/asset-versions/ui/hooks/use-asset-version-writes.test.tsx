// @vitest-environment jsdom

import { assetVersionProductionSourceHeader } from "@sprite-anvil/api/provider-generation-records";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAssetVersionWrites } from "./use-asset-version-writes";

const { recordProviderGenerationMock } = vi.hoisted(() => ({
	recordProviderGenerationMock: vi.fn(),
}));

vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "" } }));
vi.mock("@/utils/orpc", () => ({
	client: {
		assetVersions: {
			recordProviderGeneration: recordProviderGenerationMock,
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

test("marks a user-reported provider-result upload as user-reported", async () => {
	const fetchMock = vi.fn().mockResolvedValue({
		json: vi.fn().mockResolvedValue({}),
		ok: true,
		status: 201,
	});
	vi.stubGlobal("fetch", fetchMock);
	const refreshCatalogs = vi.fn().mockResolvedValue({ isError: false });
	const { result } = renderHook(() =>
		useAssetVersionWrites("project-id", refreshCatalogs)
	);
	const file = new File([new Uint8Array([1, 2, 3])], "result.png", {
		type: "image/png",
	});

	await act(async () => {
		await result.current.upload("asset-record-id", file, {
			productionSource: "user_reported_provider",
		});
	});

	expect(fetchMock).toHaveBeenCalledWith(
		expect.stringContaining("/asset-records/asset-record-id/versions"),
		expect.objectContaining({
			headers: expect.objectContaining({
				[assetVersionProductionSourceHeader]: "user_reported_provider",
			}),
		})
	);
});

test("submits the user-entered record to the provider-generation API", async () => {
	recordProviderGenerationMock.mockResolvedValue({});
	const refreshCatalogs = vi.fn().mockResolvedValue({ isError: false });
	const { result } = renderHook(() =>
		useAssetVersionWrites("project-id", refreshCatalogs)
	);
	const input = {
		actualDimensions: null,
		interface: null,
		model: null,
		modelVersion: null,
		palette: [],
		provider: "Example Provider",
		providerParameters: { steps: 28 },
		referenceIds: [],
		requestedDimensions: null,
		seed: null,
	};

	await act(async () => {
		await result.current.recordProviderGeneration("version-id", input);
	});

	expect(recordProviderGenerationMock).toHaveBeenCalledWith({
		...input,
		assetVersionId: "version-id",
		projectId: "project-id",
	});
	expect(refreshCatalogs).toHaveBeenCalledOnce();
});
