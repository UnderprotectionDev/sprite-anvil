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

vi.mock("@/utils/orpc", () => ({
	client: {
		collections: {
			addAssetRecord: (input: unknown) => fakeApi.addAssetRecord(input),
			create: (input: unknown) => fakeApi.create(input),
			removeAssetRecord: (input: unknown) => fakeApi.removeAssetRecord(input),
		},
	},
	orpc: {
		collections: {
			list: {
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
