// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/utils/orpc", () => ({ client: {} }));

import { useAssetVersionWrites } from "./use-asset-version-writes";

const projectId = "project-ash-knight";
const assetRecordId = "record-ash-knight";
const assetVersionId = "a17f5ff0-a50d-438f-8bf2-a0152b42c301";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
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
				{
					status: 503,
				}
			)
		)
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: assetVersionId }), { status: 200 })
		)
		.mockResolvedValueOnce(
			new Response(JSON.stringify({ id: "snapshot-id" }), { status: 201 })
		);
	globalThis.fetch = fetchMock;
	const refreshCatalogs = vi.fn().mockResolvedValue({ isError: false });
	const { result } = renderHook(() =>
		useAssetVersionWrites(projectId, refreshCatalogs)
	);
	const candidateFile = new File(
		[new Uint8Array([5, 6, 7])],
		"ash-knight.webp",
		{
			lastModified: 1000,
			type: "image/webp",
		}
	);
	const sourceFile = new File(
		[new Uint8Array([1, 2, 3, 4])],
		"Ash Knight.aseprite",
		{ lastModified: 2000, type: "application/octet-stream" }
	);

	let firstResult = true;
	await act(async () => {
		firstResult = await result.current.upload(
			assetRecordId,
			candidateFile,
			undefined,
			{
				managedSnapshot: sourceFile,
				sourceKind: "external_working_file_edit",
			}
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
			undefined,
			{
				managedSnapshot: sourceFile,
				sourceKind: "external_working_file_edit",
			}
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
	globalThis.fetch = fetchMock;
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
		saved = await result.current.upload(
			assetRecordId,
			candidateFile,
			undefined,
			{
				managedSnapshot: sourceFile,
				sourceKind: "external_working_file_edit",
			}
		);
	});

	expect(saved).toBe(true);
	expect(fetchMock).toHaveBeenCalledTimes(2);
	expect(result.current.writeOutcomeUncertain).toBe(false);
});
