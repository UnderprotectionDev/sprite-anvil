// @vitest-environment jsdom

import type {
	RightsRecord,
	RightsRecordCreateInput,
} from "@sprite-anvil/api/rights-records";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { RightsRecordPanel } from "./rights-record-panel";

const projectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const assetRecordId = "a7301990-3d79-49c8-887a-c1fa9a468f85";
const restrictionsFieldName = /Bilinen kısıtlar/;

const fakeApi = vi.hoisted(() => ({
	create: vi.fn(),
	records: [] as RightsRecord[],
}));

function rightsRecordQueryKey(input: {
	assetRecordId: string;
	projectId: string;
}) {
	return ["rights-records", input.projectId, input.assetRecordId];
}

vi.mock("@/utils/orpc", () => ({
	client: {
		rightsRecords: {
			create: (input: RightsRecordCreateInput) => fakeApi.create(input),
		},
	},
	orpc: {
		rightsRecords: {
			list: {
				queryKey: ({
					input,
				}: {
					input: { assetRecordId: string; projectId: string };
				}) => rightsRecordQueryKey(input),
				queryOptions: ({
					input,
				}: {
					input: { assetRecordId: string; projectId: string };
				}) => ({
					queryKey: rightsRecordQueryKey(input),
					queryFn: async () =>
						fakeApi.records.filter(
							(record) =>
								record.assetRecordId === input.assetRecordId &&
								record.projectId === input.projectId
						),
				}),
			},
		},
	},
}));

vi.mock("@/env", () => ({
	ENV: { VITE_SERVER_URL: "https://api.example.test" },
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.create.mockReset();
	fakeApi.records = [];
});

function renderPanel() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	return render(
		<QueryClientProvider client={queryClient}>
			<RightsRecordPanel assetRecordId={assetRecordId} projectId={projectId} />
		</QueryClientProvider>
	);
}

test("creates a Rights Record and rereads its persisted declaration and evidence", async () => {
	const user = userEvent.setup();
	fakeApi.create.mockImplementation((input: RightsRecordCreateInput) => {
		const record: RightsRecord = {
			...input,
			createdAt: "2026-09-29T10:00:00.000Z",
			evidenceFile: null,
			versionNumber: 1,
		};
		fakeApi.records = [record];
		return Promise.resolve(record);
	});

	renderPanel();
	await screen.findByRole("heading", { name: "Hak Kaydı" });
	await user.type(
		screen.getByLabelText("Kaynak"),
		"https://example.test/source"
	);
	await user.type(
		screen.getByLabelText("Hak sahibi veya sağlayıcı"),
		"Example Studio"
	);
	await user.type(
		screen.getByLabelText("Beyan edilen izin kapsamı"),
		"Paid game releases"
	);
	await user.type(
		screen.getByLabelText("Hak kaydını destekleyen kanıt"),
		"License reference: https://example.test/license"
	);
	await user.type(
		screen.getByLabelText("Bilinen kısıtlar"),
		"Do not resell the source file."
	);
	await user.type(
		screen.getByLabelText("Belirsizlik"),
		"Merchandising is not covered."
	);
	await user.selectOptions(
		screen.getByLabelText("Beyan edilen hak durumu"),
		"documented"
	);
	await user.click(
		screen.getByRole("button", { name: "Yeni Hak Kaydı sürümü oluştur" })
	);

	await waitFor(() => expect(fakeApi.create).toHaveBeenCalledTimes(1));
	expect(fakeApi.create).toHaveBeenCalledWith(
		expect.objectContaining({
			assetRecordId,
			assertedScope: "Paid game releases",
			evidence: "License reference: https://example.test/license",
			projectId,
			restrictions: "Do not resell the source file.",
			rightsHolderOrProvider: "Example Studio",
			source: "https://example.test/source",
			state: "documented",
			uncertainty: "Merchandising is not covered.",
		})
	);
	await screen.findByText("Revizyon 1");
	expect(screen.getByRole("listitem")).toHaveTextContent("Belgelendi");
	expect(screen.getByRole("listitem")).toHaveTextContent(
		"License reference: https://example.test/license"
	);

	cleanup();
	renderPanel();
	await screen.findByText("Revizyon 1");
	expect(screen.getByLabelText("Beyan edilen izin kapsamı")).toHaveValue(
		"Paid game releases"
	);
});

test("requires evidence before the user can declare a Rights Record Documented", async () => {
	const user = userEvent.setup();
	renderPanel();

	await user.selectOptions(
		screen.getByLabelText("Beyan edilen hak durumu"),
		"documented"
	);
	await user.click(
		screen.getByRole("button", { name: "Yeni Hak Kaydı sürümü oluştur" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Belgelendi durumunda destekleyici kanıt gerekir."
	);
	expect(fakeApi.create).not.toHaveBeenCalled();
});

test("requires a restriction before the user can declare a Rights Record Restricted", async () => {
	const user = userEvent.setup();
	renderPanel();

	await user.selectOptions(
		screen.getByLabelText("Beyan edilen hak durumu"),
		"restricted"
	);
	await user.click(
		screen.getByRole("button", { name: "Yeni Hak Kaydı sürümü oluştur" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Kısıtlı durumunda bilinen en az bir kısıt gerekir."
	);
	expect(fakeApi.create).not.toHaveBeenCalled();
});

test("creates a Documented Rights Record with an uploaded evidence file", async () => {
	const user = userEvent.setup();
	const uploadedRecord: RightsRecord = {
		assetRecordId,
		assertedScope: "Paid game releases",
		createdAt: "2026-09-29T10:00:00.000Z",
		evidence: null,
		evidenceFile: {
			contentLength: 12,
			fileName: "license.pdf",
			sha256: "a".repeat(64),
			sourceContentType: "application/pdf",
		},
		id: "3d9d07a4-37af-43d6-8583-e2256baf0a58",
		projectId,
		restrictions: null,
		rightsHolderOrProvider: null,
		source: null,
		state: "documented",
		uncertainty: null,
		versionNumber: 1,
	};
	const fetchMock = vi.fn().mockResolvedValue(
		new Response(JSON.stringify(uploadedRecord), {
			headers: { "Content-Type": "application/json" },
			status: 201,
		})
	);
	fakeApi.records = [uploadedRecord];
	vi.stubGlobal("fetch", fetchMock);

	renderPanel();
	await user.upload(
		screen.getByLabelText("Kanıt dosyası ekle"),
		new File(["license text"], "license.pdf", { type: "application/pdf" })
	);
	await screen.findByText("Seçilen dosya: license.pdf");
	await user.type(
		screen.getByLabelText("Beyan edilen izin kapsamı"),
		"Paid game releases"
	);
	await user.type(
		screen.getByLabelText("Hak kaydını destekleyen kanıt"),
		"License reference: https://example.test/license"
	);
	await user.selectOptions(
		screen.getByLabelText("Beyan edilen hak durumu"),
		"documented"
	);
	await user.click(
		screen.getByRole("button", { name: "Yeni Hak Kaydı sürümü oluştur" })
	);

	await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
	await screen.findByRole("link", { name: "license.pdf" });
	expect(fakeApi.create).not.toHaveBeenCalled();
	const uploadedForm = fetchMock.mock.calls[0]?.[1]?.body;
	expect(uploadedForm).toBeInstanceOf(FormData);
	expect(
		JSON.parse((uploadedForm as FormData).get("rightsRecord") as string)
	).toMatchObject({
		evidence: "License reference: https://example.test/license",
		state: "documented",
	});
});

test("blocks submission while an oversized evidence file is selected", async () => {
	const user = userEvent.setup();
	const fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
	fakeApi.create.mockResolvedValue({});

	renderPanel();
	await user.type(
		screen.getByLabelText("Hak kaydını destekleyen kanıt"),
		"License reference"
	);
	await user.selectOptions(
		screen.getByLabelText("Beyan edilen hak durumu"),
		"documented"
	);
	await user.upload(
		screen.getByLabelText("Kanıt dosyası ekle"),
		new File([new Uint8Array(5 * 1024 * 1024 + 1)], "oversized.pdf", {
			type: "application/pdf",
		})
	);
	await user.click(
		screen.getByRole("button", { name: "Yeni Hak Kaydı sürümü oluştur" })
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Kanıt dosyası 5 MiB sınırını aşıyor."
	);
	expect(fakeApi.create).not.toHaveBeenCalled();
	expect(fetchMock).not.toHaveBeenCalled();
});

test("starts a new revision from the latest Rights Record without changing history", async () => {
	const user = userEvent.setup();
	const previousRevision: RightsRecord = {
		assetRecordId,
		assertedScope: "Paid game releases",
		createdAt: "2026-09-29T09:00:00.000Z",
		evidence: "License reference",
		evidenceFile: null,
		id: "3d9d07a4-37af-43d6-8583-e2256baf0a58",
		projectId,
		restrictions: "Do not resell the source file.",
		rightsHolderOrProvider: "Example Studio",
		source: "https://example.test/source",
		state: "documented",
		uncertainty: "Merchandising is not covered.",
		versionNumber: 1,
	};
	fakeApi.records = [previousRevision];
	fakeApi.create.mockImplementation((input: RightsRecordCreateInput) => {
		const nextRevision: RightsRecord = {
			...input,
			createdAt: "2026-09-29T10:00:00.000Z",
			evidenceFile: null,
			versionNumber: 2,
		};
		fakeApi.records = [nextRevision, previousRevision];
		return Promise.resolve(nextRevision);
	});

	renderPanel();
	await waitFor(() =>
		expect(screen.getByLabelText("Kaynak")).toHaveValue(
			"https://example.test/source"
		)
	);
	await user.selectOptions(
		screen.getByLabelText("Beyan edilen hak durumu"),
		"restricted"
	);
	await user.clear(
		screen.getByRole("textbox", { name: restrictionsFieldName })
	);
	await user.type(
		screen.getByRole("textbox", { name: restrictionsFieldName }),
		"Game use only."
	);
	await user.click(
		screen.getByRole("button", { name: "Yeni Hak Kaydı sürümü oluştur" })
	);

	expect(fakeApi.create).toHaveBeenCalledWith(
		expect.objectContaining({
			assetRecordId,
			assertedScope: "Paid game releases",
			evidence: "License reference",
			projectId,
			restrictions: "Game use only.",
			rightsHolderOrProvider: "Example Studio",
			source: "https://example.test/source",
			state: "restricted",
			uncertainty: "Merchandising is not covered.",
		})
	);
	await screen.findByText("Revizyon 2");
	expect(screen.getAllByRole("listitem")[1]).toHaveTextContent(
		"Do not resell the source file."
	);
});
