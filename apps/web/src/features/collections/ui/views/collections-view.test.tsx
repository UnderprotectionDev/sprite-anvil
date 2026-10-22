// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { createQueryClient } from "@/utils/query-client";
import { CollectionsView } from "./collections-view";

const projectId = "project-collections";
const characterRecord = {
	assetFamilyId: "family-character",
	assetFamilyName: "Ash Knight",
	availability: "active",
	id: "asset-record-character",
	name: "Idle animation",
};
const propRecord = {
	assetFamilyId: "family-prop",
	assetFamilyName: "Iron Key",
	availability: "active",
	id: "asset-record-prop",
	name: "Inventory icon",
};

const fakeApi = vi.hoisted(() => ({
	addAssetRecord: vi.fn(),
	catalog: {
		assetRecords: [
			{
				assetFamilyId: "family-character",
				assetFamilyName: "Ash Knight",
				availability: "active",
				id: "asset-record-character",
				name: "Idle animation",
			},
			{
				assetFamilyId: "family-prop",
				assetFamilyName: "Iron Key",
				availability: "active",
				id: "asset-record-prop",
				name: "Inventory icon",
			},
		],
		collections: [] as {
			createdAt: string;
			id: string;
			name: string;
			projectId: string;
		}[],
		memberships: [] as {
			assetRecordId: string;
			collectionId: string;
			createdAt: string;
			projectId: string;
		}[],
	},
	create: vi.fn(),
	listError: null as Error | null,
	removeAssetRecord: vi.fn(),
}));

const errorToast = vi.hoisted(() => vi.fn());
const fieldNotesButtonName = /^Field Notes/;
const armoryButtonName = /^Armory/;

vi.mock("sonner", () => ({
	toast: { dismiss: vi.fn(), error: errorToast },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...actual,
		Link: ({ children, to }: { children: ReactNode; to: string }) => (
			<a href={to}>{children}</a>
		),
	};
});

function mutation(mutationFn: (input: unknown) => Promise<unknown>) {
	return {
		mutationOptions: (options?: object) => ({ ...options, mutationFn }),
	};
}

vi.mock("@/utils/orpc", () => ({
	client: {},
	orpc: {
		collections: {
			addAssetRecord: mutation((input) => fakeApi.addAssetRecord(input)),
			create: mutation((input) => fakeApi.create(input)),
			removeAssetRecord: mutation((input) => fakeApi.removeAssetRecord(input)),
			list: {
				queryKey: () => ["collections", projectId],
				queryOptions: () => ({
					queryKey: ["collections", projectId],
					queryFn: () => {
						if (fakeApi.listError) {
							return Promise.reject(fakeApi.listError);
						}
						return Promise.resolve(structuredClone(fakeApi.catalog));
					},
				}),
			},
		},
		projectContexts: {
			list: {
				queryOptions: () => ({
					queryKey: ["projects"],
					queryFn: async () => [{ id: projectId, name: "Forest Quest" }],
				}),
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	fakeApi.addAssetRecord.mockReset();
	fakeApi.create.mockReset();
	fakeApi.removeAssetRecord.mockReset();
	fakeApi.listError = null;
	fakeApi.catalog = {
		assetRecords: [characterRecord, propRecord],
		collections: [],
		memberships: [],
	};
	errorToast.mockClear();
});

function renderView() {
	const queryClient = createQueryClient();
	queryClient.setDefaultOptions({ queries: { retry: false } });
	render(
		<QueryClientProvider client={queryClient}>
			<CollectionsView projectId={projectId} />
		</QueryClientProvider>
	);
}

test("creates a Collection and moves Asset Records across family boundaries", async () => {
	fakeApi.create.mockImplementation(
		({ name, projectId: requestedProjectId }) => {
			const collection = {
				createdAt: "2026-09-27T08:00:00.000Z",
				id: "collection-field-notes",
				name,
				projectId: requestedProjectId,
			};
			fakeApi.catalog.collections.push(collection);
			return collection;
		}
	);
	fakeApi.addAssetRecord.mockImplementation(
		({ assetRecordId, collectionId }) => {
			const membership = {
				assetRecordId,
				collectionId,
				createdAt: "2026-09-27T08:01:00.000Z",
				projectId,
			};
			fakeApi.catalog.memberships.push(membership);
			return membership;
		}
	);
	fakeApi.removeAssetRecord.mockImplementation(
		({ assetRecordId, collectionId }) => {
			const index = fakeApi.catalog.memberships.findIndex(
				(membership) =>
					membership.assetRecordId === assetRecordId &&
					membership.collectionId === collectionId
			);
			return fakeApi.catalog.memberships.splice(index, 1)[0];
		}
	);

	renderView();
	fireEvent.change(screen.getByLabelText("Koleksiyon adı"), {
		target: { value: "Field Notes" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Koleksiyon oluştur" }));
	await screen.findByRole("heading", { name: "Field Notes" });

	fireEvent.change(screen.getByLabelText("Varlık Kaydı"), {
		target: { value: characterRecord.id },
	});
	fireEvent.click(screen.getByRole("button", { name: "Koleksiyona ekle" }));
	await screen.findByRole("heading", { name: "Idle animation" });

	fireEvent.change(screen.getByLabelText("Varlık Kaydı"), {
		target: { value: propRecord.id },
	});
	fireEvent.click(screen.getByRole("button", { name: "Koleksiyona ekle" }));
	await screen.findByRole("heading", { name: "Inventory icon" });
	expect(screen.getByText("Ash Knight")).toBeInTheDocument();
	expect(screen.getByText("Iron Key")).toBeInTheDocument();

	fireEvent.click(
		screen.getByRole("button", {
			name: "Idle animation Varlık Kaydını Koleksiyondan kaldır",
		})
	);
	await waitFor(() =>
		expect(
			screen.queryByRole("heading", { name: "Idle animation" })
		).not.toBeInTheDocument()
	);
	expect(screen.getByRole("heading", { name: "Inventory icon" })).toBeVisible();
	expect(fakeApi.catalog.assetRecords).toEqual([characterRecord, propRecord]);
});

test("shows a write failure without hiding the Collection state", async () => {
	fakeApi.catalog.collections = [
		{
			createdAt: "2026-09-27T08:00:00.000Z",
			id: "collection-field-notes",
			name: "Field Notes",
			projectId,
		},
	];
	fakeApi.addAssetRecord.mockRejectedValue(new Error("Write failed"));
	renderView();
	await screen.findByRole("heading", { name: "Field Notes" });

	fireEvent.change(screen.getByLabelText("Varlık Kaydı"), {
		target: { value: characterRecord.id },
	});
	fireEvent.click(screen.getByRole("button", { name: "Koleksiyona ekle" }));

	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.getByRole("heading", { name: "Field Notes" })).toBeVisible();
	expect(fakeApi.catalog.memberships).toHaveLength(0);
});

test("gates Collection creation on a non-blank name and sends the trimmed name", async () => {
	fakeApi.create.mockImplementation(({ name }) => {
		const collection = {
			createdAt: "2026-09-27T08:00:00.000Z",
			id: "collection-field-notes",
			name,
			projectId,
		};
		fakeApi.catalog.collections.push(collection);
		return collection;
	});
	renderView();
	const nameInput = screen.getByLabelText("Koleksiyon adı");
	const createButton = screen.getByRole("button", {
		name: "Koleksiyon oluştur",
	});
	expect(nameInput).toHaveAttribute("maxLength", "120");
	expect(nameInput).toHaveAttribute("name", "name");
	expect(nameInput).toHaveAttribute("autoComplete", "off");
	expect(createButton).toBeDisabled();

	fireEvent.change(nameInput, { target: { value: "   " } });
	expect(createButton).toBeDisabled();
	fireEvent.submit(nameInput.closest("form") as HTMLFormElement);
	expect(fakeApi.create).not.toHaveBeenCalled();

	fireEvent.change(nameInput, { target: { value: "  Field Notes  " } });
	await waitFor(() => expect(createButton).toBeEnabled());
	fireEvent.click(createButton);

	await screen.findByRole("heading", { name: "Field Notes" });
	expect(fakeApi.create).toHaveBeenCalledExactlyOnceWith({
		name: "Field Notes",
		projectId,
	});
	expect(screen.getByLabelText("Koleksiyon adı")).toHaveValue("");
	expect(
		screen.getByRole("button", { name: fieldNotesButtonName })
	).toHaveAttribute("aria-pressed", "true");
});

test("keeps the Collection name draft when creation fails", async () => {
	fakeApi.create.mockRejectedValue(new Error("Write failed"));
	renderView();
	fireEvent.change(screen.getByLabelText("Koleksiyon adı"), {
		target: { value: "Field Notes" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Koleksiyon oluştur" }));

	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.getByLabelText("Koleksiyon adı")).toHaveValue("Field Notes");
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Koleksiyon oluştur" })
		).toBeEnabled()
	);
});

test("gates membership on a selected Asset Record and resets it per Collection", async () => {
	fakeApi.catalog.collections = [
		{
			createdAt: "2026-09-27T08:00:00.000Z",
			id: "collection-field-notes",
			name: "Field Notes",
			projectId,
		},
		{
			createdAt: "2026-09-27T08:00:00.000Z",
			id: "collection-armory",
			name: "Armory",
			projectId,
		},
	];
	fakeApi.addAssetRecord.mockImplementation(
		({ assetRecordId, collectionId }) => {
			const membership = {
				assetRecordId,
				collectionId,
				createdAt: "2026-09-27T08:01:00.000Z",
				projectId,
			};
			fakeApi.catalog.memberships.push(membership);
			return membership;
		}
	);
	renderView();
	await screen.findByRole("heading", { name: "Field Notes" });
	const addButton = () =>
		screen.getByRole("button", { name: "Koleksiyona ekle" });
	const recordSelect = () => screen.getByLabelText("Varlık Kaydı");
	expect(recordSelect()).toHaveAttribute("name", "assetRecordId");
	expect(recordSelect()).toHaveValue("");
	expect(
		screen.getByRole("option", { name: "Varlık Kaydı seçin" })
	).toBeInTheDocument();
	expect(
		screen.getByRole("option", { name: "Idle animation · Ash Knight" })
	).toBeInTheDocument();
	expect(addButton()).toBeDisabled();

	fireEvent.change(recordSelect(), { target: { value: characterRecord.id } });
	expect(addButton()).toBeEnabled();
	fireEvent.click(screen.getByRole("button", { name: fieldNotesButtonName }));
	expect(recordSelect()).toHaveValue("");
	expect(addButton()).toBeDisabled();

	fireEvent.click(screen.getByRole("button", { name: armoryButtonName }));
	await screen.findByRole("heading", { name: "Armory" });
	fireEvent.change(recordSelect(), { target: { value: propRecord.id } });
	fireEvent.click(addButton());
	await screen.findByRole("heading", { name: "Inventory icon" });
	expect(fakeApi.addAssetRecord).toHaveBeenCalledExactlyOnceWith({
		assetRecordId: propRecord.id,
		collectionId: "collection-armory",
		projectId,
	});
	expect(recordSelect()).toHaveValue("");
	expect(
		screen.queryByRole("option", { name: "Inventory icon · Iron Key" })
	).not.toBeInTheDocument();
});

test("keeps the selected Asset Record when adding it fails", async () => {
	fakeApi.catalog.collections = [
		{
			createdAt: "2026-09-27T08:00:00.000Z",
			id: "collection-field-notes",
			name: "Field Notes",
			projectId,
		},
	];
	fakeApi.addAssetRecord.mockRejectedValue(new Error("Write failed"));
	renderView();
	await screen.findByRole("heading", { name: "Field Notes" });
	fireEvent.change(screen.getByLabelText("Varlık Kaydı"), {
		target: { value: characterRecord.id },
	});
	fireEvent.click(screen.getByRole("button", { name: "Koleksiyona ekle" }));

	await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
	expect(screen.getByLabelText("Varlık Kaydı")).toHaveValue(characterRecord.id);
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Koleksiyona ekle" })
		).toBeEnabled()
	);
});
