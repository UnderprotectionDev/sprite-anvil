// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { VersionProductionEvidencePanel } from "@/components/version-production-evidence-panel";

const { saveManualImportEvidence, onRefresh } = vi.hoisted(() => ({
	saveManualImportEvidence: vi.fn(),
	onRefresh: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useMutation: (options: { mutationFn: (input: unknown) => unknown }) => ({
		mutateAsync: (input: unknown) => options.mutationFn(input),
	}),
	useQuery: () => ({
		data: [
			{
				id: "a17f5ff0-a50d-438f-8bf2-a0152b42c309",
				createdAt: "2026-09-28T12:00:00.000Z",
				snapshot: {},
			},
		],
		isPending: false,
		isError: false,
	}),
}));

vi.mock("@/utils/orpc", () => ({
	orpc: {
		assetVersions: {
			saveManualImportEvidence: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => saveManualImportEvidence(input),
				}),
			},
		},
		generationPackages: {
			list: { queryOptions: () => ({}) },
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function renderSnapshotUploadPanel() {
	const fetchSpy = vi.fn().mockResolvedValue({
		ok: true,
		json: () => Promise.resolve({}),
	});
	vi.stubGlobal("fetch", fetchSpy);
	render(
		<VersionProductionEvidencePanel
			assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
			evidence={{
				evidenceLevel: "unknown",
				managedSnapshots: [],
				manualImportEvidence: null,
				sourceKind: "unknown",
			}}
			onRefresh={onRefresh}
			projectId="a17f5ff0-a50d-438f-8bf2-a0152b42c300"
			reviewDisposition="candidate"
			versionId="a17f5ff0-a50d-438f-8bf2-a0152b42c302"
		/>
	);
	const [uploadTarget] = screen.getAllByRole("button", {
		name: "Select, drop, or paste working file",
	});
	if (!uploadTarget) {
		throw new Error("The Managed Snapshot upload target was not rendered.");
	}
	return { fetchSpy, uploadTarget };
}

async function expectSnapshotUpload(
	fetchSpy: ReturnType<typeof vi.fn>,
	file: File
) {
	await waitFor(() =>
		expect(fetchSpy).toHaveBeenCalledWith(
			expect.stringContaining("/managed-snapshots"),
			expect.objectContaining({
				method: "POST",
				credentials: "include",
				headers: expect.objectContaining({
					"Content-Type": "application/octet-stream",
					"X-Managed-Snapshot-Size": file.size.toString(),
					"X-Managed-Snapshot-File-Name": file.name,
				}),
				body: file,
			})
		)
	);
}

test("manual import candidates show incomplete evidence and save its exact fields", async () => {
	const user = userEvent.setup();
	saveManualImportEvidence.mockResolvedValue({
		actualInstruction: "Export the idle pose as a transparent PNG.",
		generationPackageId: "a17f5ff0-a50d-438f-8bf2-a0152b42c309",
		id: "a17f5ff0-a50d-438f-8bf2-a0152b42c310",
		recordedAt: "2026-09-28T12:30:00.000Z",
		revision: 1,
		sourceSurface: "Aseprite 1.3.15",
	});
	render(
		<VersionProductionEvidencePanel
			assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
			evidence={{
				evidenceLevel: "incomplete",
				managedSnapshots: [],
				manualImportEvidence: null,
				sourceKind: "manual_import",
			}}
			onRefresh={onRefresh}
			projectId="a17f5ff0-a50d-438f-8bf2-a0152b42c300"
			reviewDisposition="candidate"
			versionId="a17f5ff0-a50d-438f-8bf2-a0152b42c302"
		/>
	);

	expect(
		screen.getByText("Production evidence level: Incomplete")
	).toBeVisible();
	await user.selectOptions(
		screen.getByLabelText("Generation Package"),
		"a17f5ff0-a50d-438f-8bf2-a0152b42c309"
	);
	await user.type(screen.getByLabelText("Source surface"), "Aseprite 1.3.15");
	await user.type(
		screen.getByLabelText("Actual production instruction"),
		"Export the idle pose as a transparent PNG."
	);
	await user.click(
		screen.getByRole("button", { name: "Save Manual Import Evidence" })
	);

	expect(saveManualImportEvidence).toHaveBeenCalledWith({
		actualInstruction: "Export the idle pose as a transparent PNG.",
		assetRecordId: "a17f5ff0-a50d-438f-8bf2-a0152b42c301",
		generationPackageId: "a17f5ff0-a50d-438f-8bf2-a0152b42c309",
		projectId: "a17f5ff0-a50d-438f-8bf2-a0152b42c300",
		sourceSurface: "Aseprite 1.3.15",
		versionId: "a17f5ff0-a50d-438f-8bf2-a0152b42c302",
	});
	expect(onRefresh).toHaveBeenCalled();
});

test("external working-file edits explain that the Managed Snapshot is required for approval", () => {
	render(
		<VersionProductionEvidencePanel
			assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
			evidence={{
				evidenceLevel: "incomplete",
				managedSnapshots: [],
				manualImportEvidence: null,
				sourceKind: "external_working_file_edit",
			}}
			onRefresh={onRefresh}
			projectId="a17f5ff0-a50d-438f-8bf2-a0152b42c300"
			reviewDisposition="candidate"
			versionId="a17f5ff0-a50d-438f-8bf2-a0152b42c302"
		/>
	);

	expect(screen.getByText("Source: External working file edit")).toBeVisible();
	expect(
		screen.getByText(
			"Save a Managed Snapshot of the editable working file before approval."
		)
	).toBeVisible();
});

test("each version upload control has a unique accessible drop hint", () => {
	const evidence = {
		evidenceLevel: "unknown" as const,
		managedSnapshots: [],
		manualImportEvidence: null,
		sourceKind: "unknown" as const,
	};
	const { container } = render(
		<>
			<VersionProductionEvidencePanel
				assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
				evidence={evidence}
				onRefresh={onRefresh}
				projectId="a17f5ff0-a50d-438f-8bf2-a0152b42c300"
				reviewDisposition="candidate"
				versionId="a17f5ff0-a50d-438f-8bf2-a0152b42c302"
			/>
			<VersionProductionEvidencePanel
				assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
				evidence={evidence}
				onRefresh={onRefresh}
				projectId="a17f5ff0-a50d-438f-2bf2-a0152b42c300"
				reviewDisposition="candidate"
				versionId="a17f5ff0-a50d-438f-2bf2-a0152b42c302"
			/>
		</>
	);
	const describedByIds = screen
		.getAllByRole("button", {
			name: "Select, drop, or paste working file",
		})
		.map((button) => button.getAttribute("aria-describedby"));

	expect(new Set(describedByIds).size).toBe(2);
	for (const id of describedByIds) {
		expect(id).toBeTruthy();
		expect(container.querySelector(`[id="${id}"]`)).toBeInTheDocument();
	}
});

test("any external working file can be uploaded as a Managed Snapshot", async () => {
	const { fetchSpy } = renderSnapshotUploadPanel();
	const workingFile = new File(["abc"], "warrior.aseprite", {
		lastModified: 1_790_591_900_000,
	});
	fireEvent.change(screen.getByLabelText("Managed working file"), {
		target: { files: [workingFile] },
	});

	await expectSnapshotUpload(fetchSpy, workingFile);
	expect(onRefresh).toHaveBeenCalled();
});

test("dropping an external working file uploads the same Managed Snapshot", async () => {
	const { fetchSpy, uploadTarget } = renderSnapshotUploadPanel();
	const workingFile = new File(["abc"], "warrior.aseprite", {
		lastModified: 1_790_591_900_000,
	});
	fireEvent.drop(uploadTarget, {
		dataTransfer: {
			files: {
				item: (index: number) => (index === 0 ? workingFile : null),
			},
		},
	});

	await expectSnapshotUpload(fetchSpy, workingFile);
	expect(onRefresh).toHaveBeenCalled();
});

test("pasting an external working file uploads the same Managed Snapshot", async () => {
	const { fetchSpy, uploadTarget } = renderSnapshotUploadPanel();
	const workingFile = new File(["abc"], "warrior.aseprite", {
		lastModified: 1_790_591_900_000,
	});
	fireEvent.paste(uploadTarget, {
		clipboardData: {
			files: {
				item: (index: number) => (index === 0 ? workingFile : null),
			},
		},
	});

	await expectSnapshotUpload(fetchSpy, workingFile);
	expect(onRefresh).toHaveBeenCalled();
});

test("recorded manual import evidence prefills the update form and requires every field", () => {
	render(
		<VersionProductionEvidencePanel
			assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
			evidence={{
				evidenceLevel: "complete",
				managedSnapshots: [],
				manualImportEvidence: {
					actualInstruction: "Export the idle pose.",
					generationPackageId: "a17f5ff0-a50d-438f-8bf2-a0152b42c309",
					id: "a17f5ff0-a50d-438f-8bf2-a0152b42c310",
					recordedAt: "2026-09-28T12:30:00.000Z",
					revision: 2,
					sourceSurface: "Aseprite 1.3.15",
				},
				sourceKind: "manual_import",
			}}
			onRefresh={onRefresh}
			projectId="a17f5ff0-a50d-438f-8bf2-a0152b42c300"
			reviewDisposition="candidate"
			versionId="a17f5ff0-a50d-438f-8bf2-a0152b42c302"
		/>
	);

	expect(screen.getByLabelText("Generation Package")).toHaveValue(
		"a17f5ff0-a50d-438f-8bf2-a0152b42c309"
	);
	expect(screen.getByLabelText("Source surface")).toHaveValue(
		"Aseprite 1.3.15"
	);
	expect(screen.getByLabelText("Actual production instruction")).toHaveValue(
		"Export the idle pose."
	);
	expect(screen.getByLabelText("Generation Package")).toBeRequired();
	expect(screen.getByLabelText("Source surface")).toBeRequired();
	expect(screen.getByLabelText("Actual production instruction")).toBeRequired();
	expect(screen.getByRole("button", { name: "Update evidence" })).toBeEnabled();
});

test("a failed manual import evidence save shows its message and keeps the draft", async () => {
	const user = userEvent.setup();
	saveManualImportEvidence.mockRejectedValue(new Error("offline"));
	render(
		<VersionProductionEvidencePanel
			assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
			evidence={{
				evidenceLevel: "incomplete",
				managedSnapshots: [],
				manualImportEvidence: null,
				sourceKind: "manual_import",
			}}
			onRefresh={onRefresh}
			projectId="a17f5ff0-a50d-438f-8bf2-a0152b42c300"
			reviewDisposition="candidate"
			versionId="a17f5ff0-a50d-438f-8bf2-a0152b42c302"
		/>
	);

	await user.selectOptions(
		screen.getByLabelText("Generation Package"),
		"a17f5ff0-a50d-438f-8bf2-a0152b42c309"
	);
	await user.type(screen.getByLabelText("Source surface"), "Aseprite");
	await user.type(
		screen.getByLabelText("Actual production instruction"),
		"Export."
	);
	await user.click(
		screen.getByRole("button", { name: "Save Manual Import Evidence" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not save Manual Import Evidence."
	);
	expect(screen.getByLabelText("Source surface")).toHaveValue("Aseprite");
	expect(onRefresh).not.toHaveBeenCalled();
});

test("an empty working file is rejected before any upload starts", () => {
	const { fetchSpy } = renderSnapshotUploadPanel();
	fireEvent.change(screen.getByLabelText("Managed working file"), {
		target: { files: [new File([], "empty.aseprite")] },
	});

	expect(screen.getByRole("alert")).toHaveTextContent(
		"The working file must be nonempty and no larger than 100 MB."
	);
	expect(fetchSpy).not.toHaveBeenCalled();
});

test("non-candidate versions hide the manual import evidence form", () => {
	render(
		<VersionProductionEvidencePanel
			assetRecordId="a17f5ff0-a50d-438f-8bf2-a0152b42c301"
			evidence={{
				evidenceLevel: "incomplete",
				managedSnapshots: [],
				manualImportEvidence: null,
				sourceKind: "manual_import",
			}}
			onRefresh={onRefresh}
			projectId="a17f5ff0-a50d-438f-8bf2-a0152b42c300"
			reviewDisposition="approved"
			versionId="a17f5ff0-a50d-438f-8bf2-a0152b42c302"
		/>
	);

	expect(screen.queryByLabelText("Source surface")).toBeNull();
	expect(screen.getByRole("status")).toHaveTextContent(
		"Missing Manual Import Evidence"
	);
});
