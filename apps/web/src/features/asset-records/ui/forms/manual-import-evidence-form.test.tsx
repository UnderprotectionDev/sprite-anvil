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

const mutationOf = vi.hoisted(
	() => (mutationFn: (input: never) => unknown) => ({
		mutationOptions: (options?: object) => ({ ...options, mutationFn }),
	})
);

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
		assetRecords: {
			createManualImportVersion: mutationOf((input: unknown) =>
				fakeApi.createManualImportVersion(input)
			),
		},
		assetVersions: {
			recordProviderGeneration: mutationOf((input: unknown) =>
				fakeApi.recordProviderGeneration(input)
			),
		},
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
	await screen.findByLabelText("Result file");
	await user.upload(screen.getByLabelText("Result file"), file);
	await user.selectOptions(
		screen.getByLabelText("Generation Package"),
		generationPackageId
	);
	await user.type(
		screen.getByLabelText("Production surface"),
		"ComfyUI 0.3.22"
	);
	const instruction =
		"Preserve the silhouette.\nChange only the cape material.";
	await user.type(
		screen.getByLabelText("Actual production instruction"),
		instruction
	);
	expect(
		(screen.getByLabelText("Result file") as HTMLInputElement).files
	).toHaveLength(1);
	const form = screen
		.getByRole("button", {
			name: "Save Candidate Version with evidence",
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
		"Manual Import Evidence saved"
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
	await screen.findByLabelText("Result file");
	await user.upload(screen.getByLabelText("Result file"), file);
	await user.click(
		screen.getByRole("checkbox", {
			name: "Obtained through another provider's interface",
		})
	);
	await user.selectOptions(
		screen.getByLabelText("Generation Package"),
		generationPackageId
	);
	await user.type(
		screen.getByLabelText("Production surface"),
		"Example Provider"
	);
	await user.type(
		screen.getByLabelText("Actual production instruction"),
		"Generate a pixel-art knight."
	);
	fireEvent.submit(
		screen
			.getByRole("button", { name: "Save Candidate Version with evidence" })
			.closest("form") as HTMLFormElement
	);

	await waitFor(() =>
		expect(fakeApi.createManualImportVersion).toHaveBeenCalledWith(
			expect.objectContaining({ productionSource: "user_reported_provider" })
		)
	);
	await user.type(await screen.findByLabelText("Provider"), "Example Provider");
	await user.click(
		screen.getByRole("button", {
			name: "Save Provider Generation Record",
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
		"Provider Generation Record saved as a user declaration"
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
		name: "Select, paste, or drop the result file",
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
		name: "Select, paste, or drop the result file",
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
	await user.upload(await screen.findByLabelText("Result file"), file);
	await user.selectOptions(
		screen.getByLabelText("Generation Package"),
		generationPackageId
	);
	const form = screen
		.getByRole("button", {
			name: "Save Candidate Version with evidence",
		})
		.closest("form") as HTMLFormElement;
	fireEvent.submit(form);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not read the result file"
	);
	expect(fakeApi.createManualImportVersion).not.toHaveBeenCalled();
});

const selectedFileText = /Selected file:/;

function renderManualImportForm(
	onRefresh = vi.fn().mockResolvedValue(undefined)
) {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<ManualImportEvidenceForm onRefresh={onRefresh} record={record} />
		</QueryClientProvider>
	);
	return onRefresh;
}

function readableFile(name: string, type = "image/png") {
	const file = new File([new Uint8Array([1, 2, 3])], name, { type });
	Object.defineProperty(file, "arrayBuffer", {
		value: async () => new Uint8Array([1, 2, 3]).buffer,
	});
	return file;
}

async function fillManualImport(
	user: ReturnType<typeof userEvent.setup>,
	file: File
) {
	await user.upload(await screen.findByLabelText("Result file"), file);
	await user.selectOptions(
		screen.getByLabelText("Generation Package"),
		generationPackageId
	);
	await user.type(screen.getByLabelText("Production surface"), "ComfyUI");
	await user.type(
		screen.getByLabelText("Actual production instruction"),
		"Keep the cape."
	);
}

test("keeps the manual import save disabled until every required value is usable", async () => {
	const user = userEvent.setup();
	fakeApi.packages = [generationPackage];
	renderManualImportForm();
	const submitButton = await screen.findByRole("button", {
		name: "Save Candidate Version with evidence",
	});
	expect(submitButton).toBeDisabled();
	fireEvent.change(screen.getByLabelText("Result file"), {
		target: { files: [readableFile("result.gif", "image/gif")] },
	});
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Select a PNG or WebP file up to 5 MB."
	);
	await user.selectOptions(
		screen.getByLabelText("Generation Package"),
		generationPackageId
	);
	await user.type(screen.getByLabelText("Production surface"), "   ");
	await user.type(
		screen.getByLabelText("Actual production instruction"),
		"Keep."
	);
	expect(submitButton).toBeDisabled();
	await user.clear(screen.getByLabelText("Production surface"));
	await user.type(screen.getByLabelText("Production surface"), "ComfyUI");
	expect(submitButton).toBeDisabled();
	fireEvent.change(screen.getByLabelText("Result file"), {
		target: { files: [readableFile("result.png")] },
	});
	expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	expect(submitButton).toBeEnabled();
});

test("clears the manual import draft after a confirmed save", async () => {
	const user = userEvent.setup();
	fakeApi.packages = [generationPackage];
	fakeApi.createManualImportVersion.mockResolvedValue({
		id: "ad800472-d38e-4076-835a-ae4f51cd7db6",
	});
	renderManualImportForm();
	await fillManualImport(user, readableFile("result.png"));
	await user.click(
		screen.getByRole("checkbox", {
			name: "Obtained through another provider's interface",
		})
	);
	await user.click(
		screen.getByRole("button", { name: "Save Candidate Version with evidence" })
	);

	expect(await screen.findByRole("status")).toHaveTextContent(
		"Manual Import Evidence saved"
	);
	expect(screen.getByLabelText("Production surface")).toHaveValue("");
	expect(screen.getByLabelText("Actual production instruction")).toHaveValue(
		""
	);
	expect(screen.getByLabelText("Generation Package")).toHaveValue("");
	expect(
		screen.getByRole("checkbox", {
			name: "Obtained through another provider's interface",
		})
	).not.toBeChecked();
	expect(screen.queryByText(selectedFileText)).not.toBeInTheDocument();
	expect((screen.getByLabelText("Result file") as HTMLInputElement).value).toBe(
		""
	);
	expect(await screen.findByLabelText("Provider")).toBeVisible();
});

test("keeps the manual import draft and request identity when saving fails", async () => {
	const user = userEvent.setup();
	fakeApi.packages = [generationPackage];
	fakeApi.createManualImportVersion
		.mockRejectedValueOnce(new Error("write failed"))
		.mockResolvedValueOnce({ id: "ad800472-d38e-4076-835a-ae4f51cd7db6" });
	renderManualImportForm();
	await fillManualImport(user, readableFile("result.png"));
	await user.click(
		screen.getByRole("button", { name: "Save Candidate Version with evidence" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not save Manual Import Evidence."
	);
	expect(screen.getByLabelText("Production surface")).toHaveValue("ComfyUI");
	expect(screen.getByLabelText("Actual production instruction")).toHaveValue(
		"Keep the cape."
	);
	expect(screen.getByRole("status")).toHaveTextContent(
		"Selected file: result.png"
	);
	await user.click(
		screen.getByRole("button", { name: "Save Candidate Version with evidence" })
	);
	await waitFor(() =>
		expect(fakeApi.createManualImportVersion).toHaveBeenCalledTimes(2)
	);
	expect(fakeApi.createManualImportVersion.mock.calls[1]?.[0].id).toBe(
		fakeApi.createManualImportVersion.mock.calls[0]?.[0].id
	);
});

test("opens the file picker from the drop area and locks it during an uncertain save", async () => {
	const user = userEvent.setup();
	fakeApi.packages = [generationPackage];
	fakeApi.createManualImportVersion.mockRejectedValueOnce(
		new TypeError("Failed to fetch")
	);
	renderManualImportForm();
	const fileInput = (await screen.findByLabelText(
		"Result file"
	)) as HTMLInputElement;
	const pickerClick = vi.spyOn(fileInput, "click");
	const area = screen.getByRole("button", {
		name: "Select, paste, or drop the result file",
	});
	await user.click(area);
	expect(pickerClick).toHaveBeenCalled();
	await fillManualImport(user, readableFile("result.png"));
	await user.click(
		screen.getByRole("button", { name: "Save Candidate Version with evidence" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not verify the save result."
	);
	expect(area).toBeDisabled();
	expect(screen.getByLabelText("Production surface")).toBeDisabled();
	expect(
		screen.getByRole("button", { name: "Save Candidate Version with evidence" })
	).toBeDisabled();
});

test("toggles the provider result checkbox with the keyboard", async () => {
	const user = userEvent.setup();
	fakeApi.packages = [generationPackage];
	renderManualImportForm();
	const checkbox = await screen.findByRole("checkbox", {
		name: "Obtained through another provider's interface",
	});
	await user.tab();
	checkbox.focus();
	expect(checkbox).toHaveFocus();
	await user.keyboard(" ");
	expect(checkbox).toBeChecked();
	await user.keyboard(" ");
	expect(checkbox).not.toBeChecked();
});
