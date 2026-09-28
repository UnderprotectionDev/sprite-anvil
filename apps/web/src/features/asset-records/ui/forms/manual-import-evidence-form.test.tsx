// @vitest-environment jsdom

import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { ManualImportEvidenceForm } from "./manual-import-evidence-form";

const projectId = "c2edb5dc-a82f-42b2-84bb-a878ca20fabf";
const assetRecordId = "7ea123f0-2bd0-4b38-ab57-29477a1366e6";
const generationPackageId = "7b73a4c6-835a-49ed-a84d-f63440351d07";
const fakeApi = vi.hoisted(() => ({
	createManualImportVersion: vi.fn(),
	recordProviderGeneration: vi.fn(),
	packages: [] as GenerationPackage[],
}));

vi.mock("@/utils/orpc", () => ({
	client: {
		assetRecords: {
			createManualImportVersion: (input: unknown) =>
				fakeApi.createManualImportVersion(input),
		},
		assetVersions: {
			recordProviderGeneration: (input: unknown) =>
				fakeApi.recordProviderGeneration(input),
		},
	},
	orpc: {
		generationPackages: {
			list: {
				queryOptions: ({ input }: { input: Record<string, unknown> }) => ({
					queryKey: ["generation-packages", input],
					queryFn: async () => fakeApi.packages,
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.createManualImportVersion.mockReset();
	fakeApi.recordProviderGeneration.mockReset();
	fakeApi.packages = [];
});

const record: AssetRecord = {
	assetCategory: "character_creature_animation",
	availability: "active",
	createdAt: "2026-09-28T08:00:00.000Z",
	id: assetRecordId,
	identityCriteria: ["independent_product_meaning"],
	measurements: {
		atlasDimensions: { confirmed: null, proposal: null },
		cellDimensions: { confirmed: null, proposal: null },
		displayScale: { confirmed: null, proposal: null },
		logicalResolution: { confirmed: null, proposal: null },
		sourceImageDimensions: { confirmed: null, proposal: null },
		visibleContentBounds: { confirmed: null, proposal: null },
	},
	name: "Ash Knight attack",
	projectId,
	supportLevel: "general",
	tags: [],
};

const generationPackage = {
	assetRecordId,
	createdAt: "2026-09-28T09:00:00.000Z",
	id: generationPackageId,
	projectId,
	targetTask: "Create a four-frame attack animation.",
} as GenerationPackage;

function fireFileTransfer(
	element: HTMLElement,
	type: "drop" | "paste",
	file: File
) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const transfer = {
		files: {
			item: (index: number) => (index === 0 ? file : null),
		},
		items: [],
	} as unknown as DataTransfer;
	Object.defineProperty(
		event,
		type === "drop" ? "dataTransfer" : "clipboardData",
		{
			value: transfer,
		}
	);
	fireEvent(element, event);
}

test("saves the exact manual result and evidence against its Generation Package", async () => {
	const user = userEvent.setup();
	const onRefresh = vi.fn().mockResolvedValue(undefined);
	fakeApi.packages = [generationPackage];
	fakeApi.createManualImportVersion.mockResolvedValue({
		contentDigest: "a".repeat(64),
		contentLength: 3,
		contentType: "image/png",
		createdAt: "2026-09-28T09:01:00.000Z",
		fileName: "attack-result.png",
		id: "ad800472-d38e-4076-835a-ae4f51cd7db6",
		integrityVerified: true,
		projectId,
		reviewDisposition: "candidate",
		sourceKind: "manual_import",
		versionNumber: 1,
	});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ManualImportEvidenceForm onRefresh={onRefresh} record={record} />
		</QueryClientProvider>
	);

	const file = new File([new Uint8Array([1, 2, 3])], "attack-result.png", {
		type: "image/png",
	});
	Object.defineProperty(file, "arrayBuffer", {
		value: async () => new Uint8Array([1, 2, 3]).buffer,
	});
	await screen.findByLabelText("Sonuç dosyası");
	await user.upload(screen.getByLabelText("Sonuç dosyası"), file);
	await user.selectOptions(
		screen.getByLabelText("Üretim Paketi"),
		generationPackageId
	);
	await user.type(screen.getByLabelText("Üretim yüzeyi"), "ComfyUI 0.3.22");
	const instruction =
		"Preserve the silhouette.\nChange only the cape material.";
	await user.type(screen.getByLabelText("Gerçek üretim talimatı"), instruction);
	expect(
		(screen.getByLabelText("Sonuç dosyası") as HTMLInputElement).files
	).toHaveLength(1);
	const form = screen
		.getByRole("button", {
			name: "Kanıtla birlikte aday sürümü kaydet",
		})
		.closest("form") as HTMLFormElement;
	fireEvent.submit(form);

	await waitFor(() =>
		expect(fakeApi.createManualImportVersion).toHaveBeenCalledWith(
			expect.objectContaining({
				assetRecordId,
				contentBase64: "AQID",
				contentType: "image/png",
				fileName: "attack-result.png",
				generationInstruction: instruction,
				generationPackageId,
				projectId,
				sourceSurface: "ComfyUI 0.3.22",
			})
		)
	);
	expect(onRefresh).toHaveBeenCalledOnce();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Elle İçe Aktarma Kanıtı kaydedildi"
	);
});

test("records provider details after saving the manual result and its required evidence", async () => {
	const user = userEvent.setup();
	const onRefresh = vi.fn().mockResolvedValue(undefined);
	fakeApi.packages = [generationPackage];
	fakeApi.createManualImportVersion.mockResolvedValue({
		id: "ad800472-d38e-4076-835a-ae4f51cd7db6",
	});
	fakeApi.recordProviderGeneration.mockResolvedValue({
		assetVersionId: "ad800472-d38e-4076-835a-ae4f51cd7db6",
	});
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ManualImportEvidenceForm onRefresh={onRefresh} record={record} />
		</QueryClientProvider>
	);

	const file = new File([new Uint8Array([1, 2, 3])], "provider-result.png", {
		type: "image/png",
	});
	Object.defineProperty(file, "arrayBuffer", {
		value: async () => new Uint8Array([1, 2, 3]).buffer,
	});
	await screen.findByLabelText("Sonuç dosyası");
	await user.upload(screen.getByLabelText("Sonuç dosyası"), file);
	await user.click(
		screen.getByLabelText("Başka bir sağlayıcının arayüzünden alındı")
	);
	await user.selectOptions(
		screen.getByLabelText("Üretim Paketi"),
		generationPackageId
	);
	await user.type(screen.getByLabelText("Üretim yüzeyi"), "Example Provider");
	await user.type(
		screen.getByLabelText("Gerçek üretim talimatı"),
		"Generate a pixel-art knight."
	);
	fireEvent.submit(
		screen
			.getByRole("button", { name: "Kanıtla birlikte aday sürümü kaydet" })
			.closest("form") as HTMLFormElement
	);

	await waitFor(() =>
		expect(fakeApi.createManualImportVersion).toHaveBeenCalledWith(
			expect.objectContaining({ productionSource: "user_reported_provider" })
		)
	);
	await user.type(
		await screen.findByLabelText("Sağlayıcı"),
		"Example Provider"
	);
	await user.click(
		screen.getByRole("button", {
			name: "Sağlayıcı üretim kaydını kaydet",
		})
	);
	await waitFor(() =>
		expect(fakeApi.recordProviderGeneration).toHaveBeenCalledWith(
			expect.objectContaining({
				assetVersionId: "ad800472-d38e-4076-835a-ae4f51cd7db6",
				projectId,
				provider: "Example Provider",
			})
		)
	);
	expect(onRefresh).toHaveBeenCalledTimes(2);
	expect(screen.getByRole("status")).toHaveTextContent(
		"Sağlayıcı Üretim Kaydı kullanıcı bildirimi olarak kaydedildi"
	);
});

test("accepts a pasted image in the result file area", async () => {
	fakeApi.packages = [generationPackage];
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ManualImportEvidenceForm
				onRefresh={vi.fn().mockResolvedValue(undefined)}
				record={record}
			/>
		</QueryClientProvider>
	);
	const file = new File([new Uint8Array([1, 2, 3])], "pasted-result.png", {
		type: "image/png",
	});
	const area = await screen.findByRole("button", {
		name: "Sonuç dosyasını seçin, yapıştırın veya bırakın",
	});
	fireFileTransfer(area, "paste", file);

	expect(await screen.findByRole("status")).toHaveTextContent(
		"pasted-result.png"
	);
});

test("accepts a dropped image in the result file area", async () => {
	fakeApi.packages = [generationPackage];
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ManualImportEvidenceForm
				onRefresh={vi.fn().mockResolvedValue(undefined)}
				record={record}
			/>
		</QueryClientProvider>
	);
	const file = new File([new Uint8Array([1, 2, 3])], "dropped-result.webp", {
		type: "image/webp",
	});
	const area = await screen.findByRole("button", {
		name: "Sonuç dosyasını seçin, yapıştırın veya bırakın",
	});
	fireFileTransfer(area, "drop", file);

	expect(await screen.findByRole("status")).toHaveTextContent(
		"dropped-result.webp"
	);
});

test("reports a result file that cannot be read", async () => {
	const user = userEvent.setup();
	fakeApi.packages = [generationPackage];
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ManualImportEvidenceForm
				onRefresh={vi.fn().mockResolvedValue(undefined)}
				record={record}
			/>
		</QueryClientProvider>
	);
	const file = new File([new Uint8Array([1, 2, 3])], "unreadable-result.png", {
		type: "image/png",
	});
	Object.defineProperty(file, "arrayBuffer", {
		value: () => Promise.reject(new Error("File read failed")),
	});
	await user.upload(await screen.findByLabelText("Sonuç dosyası"), file);
	await user.selectOptions(
		screen.getByLabelText("Üretim Paketi"),
		generationPackageId
	);
	const form = screen
		.getByRole("button", {
			name: "Kanıtla birlikte aday sürümü kaydet",
		})
		.closest("form") as HTMLFormElement;
	fireEvent.submit(form);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Sonuç dosyası okunamadı"
	);
	expect(fakeApi.createManualImportVersion).not.toHaveBeenCalled();
});
