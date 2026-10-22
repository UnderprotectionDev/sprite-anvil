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
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ReferenceBoardView } from "./reference-board-view";

const overrideRationaleLabel = /Bağlam Kuralı İstisnası gerekçesi/;
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

vi.mock("@/features/rights-evidence/ui/components/rights-record-panel", () => ({
	RightsRecordPanel: ({ referenceId }: { referenceId: string }) => (
		<div
			data-reference-id={referenceId}
			data-testid="reference-rights-record"
		/>
	),
}));

vi.mock("@/utils/orpc", () => ({
	orpc: {
		assetRecords: {
			createReference: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.createReference(input),
				}),
			},
		},
		referenceProduction: {
			updateImage: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => fakeApi.updateImage(input),
				}),
			},
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

function renderBoard({
	availableVersions = [],
	hasCanonicalDesign = false,
}: {
	availableVersions?: never[] | Record<string, unknown>[];
	hasCanonicalDesign?: boolean;
} = {}) {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	return render(
		<QueryClientProvider client={queryClient}>
			<ReferenceBoardView
				assetRecordId={assetRecordId}
				assetRecordName="Ash Knight"
				availableVersions={availableVersions as never}
				hasCanonicalDesign={hasCanonicalDesign}
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

test("edits an uploaded Reference and preserves failed-save retry feedback", async () => {
	const timestamp = new Date().toISOString();
	fakeApi.board = {
		assetVersionReferences: [],
		conflicts: [],
		effectiveForbiddenFeatures: [],
		effectiveTransferredFeatures: [],
		imageReferences: [
			{
				assetRecordId,
				conflictFeatures: [],
				contentLength: 4,
				contentType: "image/png",
				contextOverrideRationale: null,
				createdAt: timestamp,
				fileName: "stance.png",
				forbiddenFeatures: [],
				history: [],
				id: crypto.randomUUID(),
				notes: null,
				revision: 1,
				role: "pose",
				sha256: "a".repeat(64),
				sortOrder: 0,
				transferredFeatures: ["pose"],
				updatedAt: timestamp,
				customPurpose: null,
			},
		],
	};
	renderBoard();

	const cards = await screen.findAllByRole("listitem");
	expect(cards).toHaveLength(1);
	const card = within(cards[0]);
	fireEvent.click(card.getByText("Kuralları düzenle"));
	fireEvent.change(card.getByLabelText("Referans notu"), {
		target: { value: "Keep only the pose." },
	});
	fakeApi.updateImage.mockRejectedValueOnce(new Error("Save unavailable"));
	fireEvent.click(card.getByRole("button", { name: "Kuralları kaydet" }));
	expect(await card.findByRole("alert")).toHaveTextContent(
		"Referans değişikliği kaydedilemedi."
	);
	fakeApi.updateImage.mockResolvedValueOnce(undefined);
	fireEvent.click(card.getByRole("button", { name: "Kuralları kaydet" }));
	expect(await card.findByRole("status")).toHaveTextContent(
		"Referans kuralları ve notu kaydedildi."
	);
	expect(card.queryByRole("alert")).not.toBeInTheDocument();
	expect(fakeApi.updateImage).toHaveBeenLastCalledWith(
		expect.objectContaining({
			notes: "Keep only the pose.",
			expectedRevision: 1,
		})
	);
});

test("exposes a versioned Rights Record panel on each reference image", async () => {
	const timestamp = new Date().toISOString();
	const referenceId = "fcd2bb54-60fd-4555-bc6f-a30a1c2e4dd4";
	fakeApi.board = {
		assetVersionReferences: [],
		conflicts: [],
		effectiveForbiddenFeatures: [],
		effectiveTransferredFeatures: [],
		imageReferences: [
			{
				assetRecordId,
				conflictFeatures: [],
				contentLength: 4,
				contentType: "image/png",
				contextOverrideRationale: null,
				createdAt: timestamp,
				customPurpose: null,
				fileName: "stance.png",
				forbiddenFeatures: [],
				history: [],
				id: referenceId,
				notes: null,
				revision: 1,
				role: "pose",
				sha256: "a".repeat(64),
				sortOrder: 0,
				transferredFeatures: ["pose"],
				updatedAt: timestamp,
			},
		],
	};
	renderBoard();

	expect(await screen.findByTestId("reference-rights-record")).toHaveAttribute(
		"data-reference-id",
		referenceId
	);
});

test("explains that opposing reference rules block package creation", () => {
	renderBoard();

	expect(
		screen.getByText(
			"Aynı özellik için izin ve yasak çakışırsa Üretim Paketi oluşturulamaz; kurallardan birini düzenleyerek çelişkiyi giderin."
		)
	).toBeVisible();
});

test("shows opposing transfer rules and explains that package creation is blocked", async () => {
	const timestamp = new Date().toISOString();
	const allowingReferenceId = crypto.randomUUID();
	const forbiddingReferenceId = crypto.randomUUID();
	fakeApi.board = {
		assetVersionReferences: [],
		conflicts: [
			{
				allowingReferenceIds: [allowingReferenceId],
				feature: "palette",
				forbiddingReferenceIds: [forbiddingReferenceId],
			},
		],
		effectiveForbiddenFeatures: [],
		effectiveTransferredFeatures: [],
		imageReferences: [
			{
				assetRecordId,
				conflictFeatures: ["palette"],
				contentLength: 4,
				contentType: "image/png",
				contextOverrideRationale: null,
				createdAt: timestamp,
				customPurpose: null,
				fileName: "palette-reference.png",
				forbiddenFeatures: [],
				history: [],
				id: allowingReferenceId,
				notes: null,
				revision: 1,
				role: "palette",
				sha256: "a".repeat(64),
				sortOrder: 0,
				transferredFeatures: ["palette"],
				updatedAt: timestamp,
			},
			{
				assetRecordId,
				conflictFeatures: ["palette"],
				contentLength: 4,
				contentType: "image/png",
				contextOverrideRationale: null,
				createdAt: timestamp,
				customPurpose: null,
				fileName: "avoid-palette.png",
				forbiddenFeatures: ["palette"],
				history: [],
				id: forbiddingReferenceId,
				notes: null,
				revision: 1,
				role: "avoid",
				sha256: "b".repeat(64),
				sortOrder: 1,
				transferredFeatures: [],
				updatedAt: timestamp,
			},
		],
	};
	renderBoard();

	const conflictAlert = await screen.findByRole("alert", {
		name: "Çözülmemiş aktarım çelişkileri",
	});
	expect(conflictAlert).toHaveTextContent("Palet");
	expect(conflictAlert).toHaveTextContent("palette-reference.png");
	expect(conflictAlert).toHaveTextContent("avoid-palette.png");
	expect(conflictAlert).toHaveTextContent("Üretim Paketi oluşturulamaz");
});

test("unchecking every feature shows the selection message and blocks the upload", async () => {
	const user = userEvent.setup();
	renderBoard();

	await user.click(
		within(
			screen.getByRole("group", { name: "Aktarılabilir özellikler" })
		).getByRole("checkbox", { name: "Poz veya hareket" })
	);

	expect(screen.getByRole("alert")).toHaveTextContent(
		"En az bir özelliği aktarılabilir veya kaçınılacak olarak seçin."
	);
	expect(screen.getByRole("button", { name: "Görseli yükle" })).toBeDisabled();
});

test("feature checkboxes toggle with the keyboard", async () => {
	const user = userEvent.setup();
	renderBoard();
	const checkbox = within(
		screen.getByRole("group", { name: "Kaçınılacak özellikler" })
	).getByRole("checkbox", { name: "Palet veya renk ilişkisi" });

	checkbox.focus();
	await user.keyboard(" ");
	expect(checkbox).toBeChecked();
	await user.keyboard(" ");
	expect(checkbox).not.toBeChecked();
});

test("the custom purpose role requires a written purpose", async () => {
	const user = userEvent.setup();
	renderBoard();

	await user.selectOptions(
		screen.getByLabelText("Referans kullanım amacı"),
		"custom"
	);
	await user.click(
		within(
			screen.getByRole("group", { name: "Kaçınılacak özellikler" })
		).getByRole("checkbox", { name: "Poz veya hareket" })
	);
	expect(
		within(
			screen.getByRole("group", { name: "Aktarılabilir özellikler" })
		).getByRole("checkbox", { name: "Poz veya hareket" })
	).not.toBeChecked();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Özel kullanım amacını yazın."
	);

	await user.type(screen.getByLabelText("Özel kullanım amacı"), "Rim light");
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("a canonical design requires an override rationale for identity transfer", async () => {
	const user = userEvent.setup();
	renderBoard({ hasCanonicalDesign: true });

	await user.selectOptions(
		screen.getByLabelText("Referans kullanım amacı"),
		"identity"
	);
	const rationale = screen.getByLabelText(overrideRationaleLabel);
	expect(rationale).toBeRequired();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Ana Tasarım kimlik sınırını aşmak için Bağlam Kuralı İstisnası gerekçesi yazın."
	);

	await user.type(rationale, "Same hero.");
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("links an existing Asset Version with the entered rules and clears the choice", async () => {
	const user = userEvent.setup();
	const versionId = "1f0b8c0e-8a52-4a8d-9d7d-2f6b6c5e9a11";
	fakeApi.createReference.mockResolvedValue(undefined);
	renderBoard({
		availableVersions: [
			{
				assetRecordId: crypto.randomUUID(),
				assetRecordName: "Ash Mage",
				fileName: "mage.png",
				id: versionId,
				versionNumber: 2,
			},
		],
	});
	const link = screen.getByRole("button", { name: "Varlık Sürümünü bağla" });
	expect(link).toBeDisabled();

	await user.selectOptions(
		screen.getByLabelText("Mevcut Varlık Sürümü"),
		versionId
	);
	await user.type(screen.getByLabelText("Referans notu"), "Pose only");
	await user.click(link);

	await waitFor(() =>
		expect(fakeApi.createReference).toHaveBeenCalledWith(
			expect.objectContaining({
				forbiddenFeatures: [],
				notes: "Pose only",
				role: "pose",
				targetVersionId: versionId,
				transferredFeatures: ["pose"],
			})
		)
	);
	expect(
		await screen.findByText("Varlık Sürümü referans panosuna eklendi.")
	).toBeVisible();
	expect(screen.getByLabelText("Mevcut Varlık Sürümü")).toHaveValue("");
});
