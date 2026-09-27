// @vitest-environment jsdom

import type { ReferenceBoard } from "@sprite-anvil/api/reference-production";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ReferenceBoardView } from "./reference-board-view";

const projectId = "c2edb5dc-a82f-42b2-84bb-a878ca20fabf";
const assetRecordId = "7ea123f0-2bd0-4b38-ab57-29477a1366e6";

const fakeApi = vi.hoisted(() => ({
	board: {
		assetVersionReferences: [],
		conflicts: [],
		effectiveForbiddenFeatures: [],
		effectiveTransferredFeatures: [],
		imageReferences: [],
	} as unknown as ReferenceBoard,
	createReference: vi.fn(),
	updateImage: vi.fn(),
}));

vi.mock("@/env", () => ({
	ENV: { VITE_SERVER_URL: "https://app.example.test" },
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			createReference: (input: unknown) => fakeApi.createReference(input),
		},
		referenceProduction: {
			updateImage: (input: unknown) => fakeApi.updateImage(input),
		},
	},
	orpc: {
		referenceProduction: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["reference-board", input],
					queryFn: async () => fakeApi.board,
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	fakeApi.board = {
		assetVersionReferences: [],
		conflicts: [],
		effectiveForbiddenFeatures: [],
		effectiveTransferredFeatures: [],
		imageReferences: [],
	} as unknown as ReferenceBoard;
	fakeApi.createReference.mockReset();
	fakeApi.updateImage.mockReset();
});

function renderBoard() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	return render(
		<QueryClientProvider client={queryClient}>
			<ReferenceBoardView
				assetRecordId={assetRecordId}
				assetRecordName="Ash Knight"
				availableVersions={[]}
				hasCanonicalDesign={false}
				onRefresh={async () => undefined}
				projectId={projectId}
				references={[]}
			/>
		</QueryClientProvider>
	);
}

test("accepts a dropped reference image and uploads it with its transfer rules", async () => {
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:reference-preview");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	const fetchMock = vi
		.fn()
		.mockResolvedValue(
			new Response(JSON.stringify({ id: crypto.randomUUID() }), { status: 201 })
		);
	vi.stubGlobal("fetch", fetchMock);
	renderBoard();

	const file = new File([new Uint8Array([137, 80, 78, 71])], "stance.png", {
		type: "image/png",
	});
	const dropTarget = screen.getByRole("button", {
		name: "Referans görseli ekleme alanı",
	});
	fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
	fireEvent.click(
		within(
			screen.getByRole("group", { name: "Kaçınılacak özellikler" })
		).getByRole("checkbox", { name: "Poz veya hareket" })
	);
	fireEvent.change(screen.getByLabelText("Referans notu"), {
		target: { value: "Yalnızca duruş." },
	});
	fireEvent.click(screen.getByRole("button", { name: "Görseli yükle" }));

	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
	expect(request.method).toBe("POST");
	expect(request.credentials).toBe("include");
	expect(request.headers).toMatchObject({
		"Content-Type": "image/png",
		"X-Reference-Board-File-Name": "stance.png",
	});
	expect(request.body).toBe(file);
	const encodedMetadata = (request.headers as Record<string, string>)[
		"X-Reference-Board-Metadata"
	];
	const decodedBytes = atob(
		encodedMetadata.replaceAll("-", "+").replaceAll("_", "/")
	);
	const decodedMetadata = new TextDecoder().decode(
		Uint8Array.from(decodedBytes, (character) => character.charCodeAt(0))
	);
	expect(JSON.parse(decodedMetadata)).toMatchObject({
		forbiddenFeatures: ["pose"],
		notes: "Yalnızca duruş.",
		role: "pose",
		transferredFeatures: ["pose"],
	});
});

test("pastes a reference image into the focused drop area", async () => {
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pasted-reference");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
	renderBoard();
	const file = new File([new Uint8Array([1, 2, 3])], "palette.webp", {
		type: "image/webp",
	});
	const dropArea = screen.getByRole("button", {
		name: "Referans görseli ekleme alanı",
	});
	dropArea.focus();
	fireEvent.paste(dropArea, {
		clipboardData: {
			items: [{ type: "image/webp", getAsFile: () => file }],
		},
	});

	expect(await screen.findByText("palette.webp")).toBeVisible();
});
