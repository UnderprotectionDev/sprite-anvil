// @vitest-environment jsdom

import { assetVersionProductionSourceHeader } from "@sprite-anvil/api/provider-generation-records";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAssetVersionWrites } from "./use-asset-version-writes";

const {
	recordProviderGenerationMock,
	reviewMock,
	reviewBatchMock,
	toastErrorMock,
} = vi.hoisted(() => ({
	recordProviderGenerationMock: vi.fn(),
	reviewMock: vi.fn(),
	reviewBatchMock: vi.fn(),
	toastErrorMock: vi.fn(),
}));

vi.mock("@/env", () => ({ ENV: { VITE_SERVER_URL: "" } }));
vi.mock("@/utils/orpc", () => ({
	client: {
		assetVersions: {
			recordProviderGeneration: recordProviderGenerationMock,
			review: reviewMock,
			reviewBatch: reviewBatchMock,
		},
	},
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

test("does not claim batch success when the server refuses a blocked selection", async () => {
	const message = "Hiçbir İnceleme Kaydı yazılmadı: Required evidence missing";
	reviewBatchMock.mockRejectedValueOnce(
		Object.assign(new Error(message), { code: "BAD_REQUEST", status: 400 })
	);
	toastErrorMock.mockClear();
	const refreshCatalogs = vi.fn();
	const { result } = renderHook(() =>
		useAssetVersionWrites("project", refreshCatalogs)
	);
	await act(async () => {
		await result.current.reviewBatch({
			projectId: "project",
			decision: "approved",
			rationale: "Reviewed",
			idempotencyKey: crypto.randomUUID(),
			targets: [{ assetVersionId: "one", expectedReviewEventId: null }],
		});
	});
	expect(toastErrorMock).toHaveBeenCalledWith(message);
	expect(result.current.statusMessage).toBeNull();
	expect(refreshCatalogs).not.toHaveBeenCalled();
});

const projectId = "project-ash-knight";
const assetRecordId = "record-ash-knight";
const assetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c301";

test("shows missing mandatory evidence without claiming the Asset Version was approved", async () => {
	const message =
		"Onay için zorunlu kalite kanıtını tamamlayın: icon.small_size_readability";
	reviewMock.mockRejectedValueOnce(
		Object.assign(new Error(message), { code: "BAD_REQUEST", status: 400 })
	);
	toastErrorMock.mockClear();
	const refreshCatalogs = vi.fn().mockResolvedValue({ isError: false });
	const { result } = renderHook(() =>
		useAssetVersionWrites(projectId, refreshCatalogs)
	);
	await act(async () => {
		await result.current.review(
			assetVersionId,
			"approved",
			"Reviewed this result."
		);
	});
	expect(toastErrorMock).toHaveBeenCalledWith(message);
	expect(result.current.statusMessage).not.toBe("Varlık Sürümü onaylandı.");
	expect(result.current.writeOutcomeUncertain).toBe(false);
	expect(refreshCatalogs).not.toHaveBeenCalled();
});

test("retries an external working-file Candidate Version and its Managed Snapshot with the same idempotency keys", async () => {
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: assetVersionId }), { status: 201 })
		)
		.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ error: "Managed Snapshot upload failed" }),
				{ status: 503 }
			)
		)
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: assetVersionId }), { status: 200 })
		)
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: "snapshot-id" }), { status: 201 })
		);
	vi.stubGlobal("fetch", fetchMock);
	const refreshCatalogs = vi.fn().mockResolvedValue({ isError: false });
	const { result } = renderHook(() =>
		useAssetVersionWrites(projectId, refreshCatalogs)
	);
	const candidateFile = new File(
		[new Uint8Array([5, 6, 7])],
		"ash-knight.webp",
		{ lastModified: 1000, type: "image/webp" }
	);
	const sourceFile = new File(
		[new Uint8Array([1, 2, 3, 4])],
		"Ash Knight.aseprite",
		{ lastModified: 2000, type: "application/octet-stream" }
	);
	const options = {
		managedSnapshot: sourceFile,
		sourceKind: "external_working_file_edit" as const,
	};

	let firstResult = true;
	await act(async () => {
		firstResult = await result.current.upload(
			assetRecordId,
			candidateFile,
			options
		);
	});
	expect(firstResult).toBe(false);
	expect(result.current.writeOutcomeUncertain).toBe(true);

	await act(async () => {
		await result.current.checkWriteOutcome();
	});
	let secondResult = false;
	await act(async () => {
		secondResult = await result.current.upload(
			assetRecordId,
			candidateFile,
			options
		);
	});

	expect(secondResult).toBe(true);
	expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(candidateFile);
	expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(sourceFile);
	const firstCandidateHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<
		string,
		string
	>;
	const retryCandidateHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Record<
		string,
		string
	>;
	const firstSnapshotHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<
		string,
		string
	>;
	const retrySnapshotHeaders = fetchMock.mock.calls[3]?.[1]?.headers as Record<
		string,
		string
	>;
	expect(firstCandidateHeaders["X-Asset-Version-Source-Kind"]).toBe(
		"external_working_file_edit"
	);
	expect(retryCandidateHeaders["Idempotency-Key"]).toBe(
		firstCandidateHeaders["Idempotency-Key"]
	);
	expect(retrySnapshotHeaders["Idempotency-Key"]).toBe(
		firstSnapshotHeaders["Idempotency-Key"]
	);
	expect(String(fetchMock.mock.calls[3]?.[0])).toContain(
		`/asset-versions/${assetVersionId}/managed-snapshots`
	);
});

test("does not re-import a saved Candidate Version when only catalog refresh fails", async () => {
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: assetVersionId }), { status: 201 })
		)
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: "snapshot-id" }), { status: 201 })
		);
	vi.stubGlobal("fetch", fetchMock);
	const refreshCatalogs = vi
		.fn()
		.mockRejectedValue(new Error("Catalog refresh failed"));
	const { result } = renderHook(() =>
		useAssetVersionWrites(projectId, refreshCatalogs)
	);
	const candidateFile = new File(
		[new Uint8Array([5, 6, 7])],
		"ash-knight.png",
		{ lastModified: 1000, type: "image/png" }
	);
	const sourceFile = new File(
		[new Uint8Array([1, 2, 3, 4])],
		"Ash Knight.aseprite",
		{ lastModified: 2000, type: "application/octet-stream" }
	);

	let saved = false;
	await act(async () => {
		saved = await result.current.upload(assetRecordId, candidateFile, {
			managedSnapshot: sourceFile,
			sourceKind: "external_working_file_edit",
		});
	});

	expect(saved).toBe(true);
	expect(fetchMock).toHaveBeenCalledTimes(2);
	expect(result.current.writeOutcomeUncertain).toBe(false);
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

test("shows the server validation message when a Unit Version correction is rejected", async () => {
	toastErrorMock.mockClear();
	const serverError = "Invalid Asset Version image content";
	const fetchMock = vi
		.fn()
		.mockResolvedValue(
			new Response(JSON.stringify({ error: serverError }), { status: 422 })
		);
	vi.stubGlobal("fetch", fetchMock);
	const refreshCatalogs = vi.fn().mockResolvedValue({ isError: false });
	const { result } = renderHook(() =>
		useAssetVersionWrites(projectId, refreshCatalogs)
	);
	const file = new File([new Uint8Array([1, 2, 3])], "corrected-frame.png", {
		type: "image/png",
	});

	await act(async () => {
		await result.current.upload(assetRecordId, file, {
			unitCorrection: {
				sourceAssetVersionId: assetVersionId,
				unitType: "frame",
				unitKey: "attack/frame-3",
			},
		});
	});

	expect(toastErrorMock).toHaveBeenCalledWith(serverError);
	expect(result.current.writeOutcomeUncertain).toBe(false);
	expect(refreshCatalogs).not.toHaveBeenCalled();
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
