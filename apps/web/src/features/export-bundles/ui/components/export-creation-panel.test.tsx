// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ExportCreationPanel } from "./export-creation-panel";

const storage = vi.hoisted(() => ({
	rows: new Map<string, { key: string }>(),
	fail: false,
	user: "user-1",
}));
vi.mock("@/lib/auth-client", () => ({
	authClient: { useSession: () => ({ data: { user: { id: storage.user } } }) },
}));
vi.mock("../../lib/pending-export-store", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("../../lib/pending-export-store")>();
	return {
		...original,
		pendingExportTable: () => ({
			get: async (key: string) => storage.rows.get(key),
			put: (row: { key: string }) => {
				if (storage.fail) {
					return Promise.reject(new Error("storage"));
				}
				storage.rows.set(row.key, row);
				return Promise.resolve();
			},
			delete: (key: string) => {
				storage.rows.delete(key);
				return Promise.resolve();
			},
		}),
	};
});
beforeEach(() => {
	storage.rows.clear();
	storage.fail = false;
	storage.user = "user-1";
	save.mockClear();
	create.mockClear();
});
afterEach(cleanup);
const save = vi.hoisted(() =>
	vi.fn(async (_input: Record<string, unknown>) => ({}))
);
const create = vi.hoisted(() =>
	vi.fn(async (_input: Record<string, unknown>) => ({}))
);
const familyId = "d55304bf-e278-4cef-93ab-638a2dd651c3";
const revisionId = "2eeab681-0813-4c6b-a0d2-d0129a8b8474";
const catalog = vi.hoisted(() => ({
	profiles: [] as unknown[],
	bundles: [] as unknown[],
	getBundle: vi.fn(),
}));
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		exportProfiles: { list: async () => catalog, createRevision: save },
		assetFamilies: {
			list: async () => ({
				assetFamilies: catalog.profiles.length
					? [{ id: familyId, name: "Hero" }]
					: [],
			}),
		},
		exportBundles: {
			list: async () => ({ bundles: catalog.bundles }),
			get: catalog.getBundle,
			preview: async () => ({
				status: "resolved",
				context: { revisionId: "ctx-preview", revisionNumber: 8 },
				families: [
					{
						assetFamilyId: familyId,
						assetFamilyName: "Hero",
						requiredSet: {
							revisionId: "set-preview",
							revisionNumber: 3,
							items: [{ id: "idle", name: "Idle", disposition: "required" }],
						},
						selections: [
							{ itemId: "idle", assetVersionIds: ["version-preview"] },
						],
					},
				],
				assetVersions: [
					{
						id: "version-preview",
						assetRecordId: "asset-preview",
						versionNumber: 2,
					},
				],
				blockers: [],
			}),
			create,
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});
test("shows empty project catalogs and profile creation", async () => {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
		</QueryClientProvider>
	);
	expect(
		await screen.findByText("No Export Profiles yet.")
	).toBeInTheDocument();
	expect(screen.getByLabelText("Profile name")).toBeInTheDocument();
	expect(screen.getByText("No Asset Families yet.")).toBeInTheDocument();
});

test("saves metadata mappings and rejects duplicate target keys", async () => {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
		</QueryClientProvider>
	);
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "Profile" },
	});
	fireEvent.change(screen.getByLabelText("Naming template"), {
		target: { value: "{name}" },
	});
	fireEvent.click(screen.getByText("Add metadata mapping"));
	fireEvent.change(screen.getByLabelText("Source field"), {
		target: { value: "rarity" },
	});
	fireEvent.change(screen.getByLabelText("Target key"), {
		target: { value: "tier" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	await waitFor(() => expect(save).toHaveBeenCalled());
	expect(save.mock.calls[0][0].definition).toEqual({
		layout: "grid",
		padding: 0,
		trim: "none",
		scale: 1,
		namingTemplate: "{name}",
		fileFormat: "png",
		metadataMapping: [{ sourceField: "rarity", targetKey: "tier" }],
	});
	fireEvent.click(screen.getByText("Add metadata mapping"));
	fireEvent.change(screen.getAllByLabelText("Source field")[1], {
		target: { value: "other" },
	});
	fireEvent.change(screen.getAllByLabelText("Target key")[1], {
		target: { value: "tier" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	expect(
		await screen.findByText("A metadata key can be mapped only once.")
	).toBeInTheDocument();
	expect(save).toHaveBeenCalledTimes(1);
});

test("loads latest profile definition for a new version", async () => {
	catalog.profiles = [
		{
			id: "profile-1",
			name: "Existing",
			revisions: [
				{
					definition: {
						layout: "packed",
						padding: 2,
						trim: "transparent",
						scale: 2,
						namingTemplate: "{name}",
						fileFormat: "png",
						metadataMapping: [{ sourceField: "kind", targetKey: "type" }],
					},
				},
			],
		},
	];
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
		</QueryClientProvider>
	);
	await screen.findByText("Existing");
	fireEvent.change(screen.getByLabelText("Profile to version"), {
		target: { value: "profile-1" },
	});
	expect(screen.getByLabelText("Source field")).toHaveValue("kind");
	expect(screen.getByLabelText("Target key")).toHaveValue("type");
	expect(screen.getByLabelText("Layout")).toHaveValue("packed");
	catalog.profiles = [];
});

test("shows missing mapping fields", async () => {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
		</QueryClientProvider>
	);
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "Profile" },
	});
	fireEvent.change(screen.getByLabelText("Naming template"), {
		target: { value: "{name}" },
	});
	fireEvent.click(screen.getByText("Add metadata mapping"));
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	expect(await screen.findByRole("alert")).toHaveTextContent("Too small");
});

test("retries uncertain profile and bundle writes with the same identifiers", async () => {
	save
		.mockClear()
		.mockRejectedValueOnce(
			Object.assign(new Error("Server error"), { status: 500 })
		);
	create
		.mockClear()
		.mockRejectedValueOnce(
			Object.assign(new Error("Server error"), { status: 500 })
		);
	catalog.profiles = [
		{
			id: "profile-1",
			name: "Existing",
			revisions: [{ id: revisionId, revisionNumber: 1 }],
		},
	];
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
		</QueryClientProvider>
	);
	await screen.findByText("Hero");
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "Profile" },
	});
	fireEvent.change(screen.getByLabelText("Naming template"), {
		target: { value: "{name}" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
	await waitFor(() =>
		expect(screen.getByLabelText("Profile name")).toBeDisabled()
	);
	fireEvent.click(await screen.findByText("Retry profile"));
	await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
	expect(save.mock.calls[1][0].profileId).toBe(save.mock.calls[0][0].profileId);
	expect(save.mock.calls[1][0].revisionId).toBe(
		save.mock.calls[0][0].revisionId
	);
	fireEvent.change(screen.getByLabelText("Profile version"), {
		target: { value: revisionId },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: "Hero" }));
	await waitFor(() => expect(screen.getByText("Create bundle")).toBeEnabled());
	fireEvent.click(screen.getByText("Create bundle"));
	await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
	await waitFor(() =>
		expect(screen.getByLabelText("Profile version")).toBeDisabled()
	);
	fireEvent.click(await screen.findByText("Retry bundle"));
	await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
	expect(create.mock.calls[1][0].idempotencyKey).toBe(
		create.mock.calls[0][0].idempotencyKey
	);
	catalog.profiles = [];
});

test("uses new profile identifiers after a known rejection and corrected input", async () => {
	save
		.mockClear()
		.mockRejectedValueOnce(
			Object.assign(new Error("Invalid input"), { status: 400 })
		);
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
		</QueryClientProvider>
	);
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "First" },
	});
	fireEvent.change(screen.getByLabelText("Naming template"), {
		target: { value: "{name}" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	await screen.findByText("Invalid input");
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "Corrected" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
	expect(save.mock.calls[1][0].profileId).not.toBe(
		save.mock.calls[0][0].profileId
	);
	expect(save.mock.calls[1][0].revisionId).not.toBe(
		save.mock.calls[0][0].revisionId
	);
});

test("shows the saved Context, Required Set and Asset Version pins before download", async () => {
	catalog.bundles = [{ id: "bundle-1", isLatest: true }];
	catalog.getBundle.mockResolvedValue({
		manifest: {
			context: { revisionId: "ctx-1", revisionNumber: 4 },
			requiredSets: [
				{
					assetFamilyId: "fam-1",
					revisionId: "set-1",
					revisionNumber: 2,
					items: [{ id: "idle", name: "Idle" }],
				},
			],
			files: [
				{
					assetRecordId: "asset-1",
					assetVersionId: "version-3",
					itemId: "idle",
					path: "idle.png",
				},
			],
			profile: { revisionId: "profile-1", revisionNumber: 5 },
		},
	});
	try {
		render(
			<QueryClientProvider
				client={
					new QueryClient({ defaultOptions: { queries: { retry: false } } })
				}
			>
				<ExportCreationPanel projectId="project-1" />
			</QueryClientProvider>
		);
		fireEvent.click(
			await screen.findByRole("button", { name: "View bundle details" })
		);
		expect(
			await screen.findByText("Context Revision 4 · ctx-1")
		).toBeInTheDocument();
		expect(
			screen.getByText("Required Set version 2 · set-1 · Family fam-1")
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"idle.png · Asset Version version-3 · Asset Record asset-1 · item idle"
			)
		).toBeInTheDocument();
	} finally {
		catalog.bundles = [];
		catalog.getBundle.mockReset();
	}
});

test("shows current source candidates before creating a bundle", async () => {
	catalog.profiles = [
		{
			id: "profile-1",
			name: "Profile",
			revisions: [{ id: revisionId, revisionNumber: 1 }],
		},
	];
	try {
		render(
			<QueryClientProvider
				client={
					new QueryClient({ defaultOptions: { queries: { retry: false } } })
				}
			>
				<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
			</QueryClientProvider>
		);
		fireEvent.click(await screen.findByRole("checkbox", { name: "Hero" }));
		expect(
			await screen.findByText("Current Context Revision 8 · ctx-preview")
		).toBeInTheDocument();
		expect(
			screen.getByText("Required Set version 3 · set-preview")
		).toBeInTheDocument();
		expect(
			screen.getByText("Asset Version 2 · version-preview")
		).toBeInTheDocument();
		expect(
			screen.getByText("These inputs may change before the bundle is created.")
		).toBeInTheDocument();
	} finally {
		catalog.profiles = [];
	}
});

test("explains missing bundle selections", async () => {
	create.mockClear();
	render(
		<QueryClientProvider client={new QueryClient()}>
			<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
		</QueryClientProvider>
	);
	await waitFor(() => expect(screen.getByText("Create bundle")).toBeEnabled());
	fireEvent.click(screen.getByText("Create bundle"));
	expect(
		await screen.findByText("Choose a profile version.")
	).toBeInTheDocument();
	expect(
		screen.getByText("Choose at least one Asset Family.")
	).toBeInTheDocument();
	expect(create).not.toHaveBeenCalled();
});

test("retries the exact profile payload when the catalog changes", async () => {
	save
		.mockClear()
		.mockRejectedValueOnce(
			Object.assign(new Error("Server error"), { status: 500 })
		);
	const profile = {
		id: "profile-1",
		name: "Original",
		revisions: [{ id: revisionId, revisionNumber: 1 }],
	};
	catalog.profiles = [profile];
	try {
		render(
			<QueryClientProvider client={new QueryClient()}>
				<ExportCreationPanel projectId="7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01" />
			</QueryClientProvider>
		);
		await screen.findByText("Original");
		fireEvent.change(screen.getByLabelText("Profile to version"), {
			target: { value: "profile-1" },
		});
		fireEvent.change(screen.getByLabelText("Naming template"), {
			target: { value: "{name}" },
		});
		await waitFor(() =>
			expect(screen.getByText("Save profile version")).toBeEnabled()
		);
		fireEvent.click(screen.getByText("Save profile version"));
		await screen.findByText("Server error");
		profile.name = "Changed";
		fireEvent.click(await screen.findByText("Retry profile"));
		await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
		expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0]);
	} finally {
		catalog.profiles = [];
	}
});

test("does not send a profile when local pending storage is unavailable", async () => {
	storage.fail = true;
	const before = save.mock.calls.length;
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ExportCreationPanel projectId="storage-failure" />
		</QueryClientProvider>
	);
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "Profile" },
	});
	fireEvent.change(screen.getByLabelText("Naming template"), {
		target: { value: "{name}" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	await screen.findByText(
		"Pending export requests could not be stored on this device."
	);
	expect(save.mock.calls.length).toBe(before);
});

test("retains an uncertain request across remount and isolates user and project", async () => {
	save.mockRejectedValueOnce(
		Object.assign(new Error("Server error"), { status: 500 })
	);
	const panel = (projectId: string) => (
		<QueryClientProvider client={new QueryClient()}>
			<ExportCreationPanel projectId={projectId} />
		</QueryClientProvider>
	);
	const view = render(panel("project-a"));
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "Profile" },
	});
	fireEvent.change(screen.getByLabelText("Naming template"), {
		target: { value: "{name}" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	await screen.findByText("Retry profile");
	await screen.findByText("Server error");
	const [[input]] = save.mock.calls;
	view.unmount();
	storage.user = "user-2";
	const other = render(panel("project-a"));
	await screen.findByText("No Export Profiles yet.");
	expect(screen.queryByText("Retry profile")).not.toBeInTheDocument();
	other.unmount();
	storage.user = "user-1";
	const otherProject = render(panel("project-b"));
	await screen.findByText("No Export Profiles yet.");
	expect(screen.queryByText("Retry profile")).not.toBeInTheDocument();
	otherProject.unmount();
	render(panel("project-a"));
	fireEvent.click(await screen.findByText("Retry profile"));
	await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
	expect(save.mock.calls[1][0]).toEqual(input);
});

test("removes a definitively rejected pending request before remount", async () => {
	save.mockRejectedValueOnce(
		Object.assign(new Error("Invalid input"), { status: 400 })
	);
	const panel = () => (
		<QueryClientProvider client={new QueryClient()}>
			<ExportCreationPanel projectId="project-a" />
		</QueryClientProvider>
	);
	const view = render(panel());
	fireEvent.change(screen.getByLabelText("Profile name"), {
		target: { value: "Profile" },
	});
	fireEvent.change(screen.getByLabelText("Naming template"), {
		target: { value: "{name}" },
	});
	await waitFor(() =>
		expect(screen.getByText("Save profile version")).toBeEnabled()
	);
	fireEvent.click(screen.getByText("Save profile version"));
	await screen.findByText("Invalid input");
	await waitFor(() => expect(storage.rows.size).toBe(0));
	view.unmount();
	render(panel());
	await screen.findByText("No Export Profiles yet.");
	expect(screen.queryByText("Retry profile")).not.toBeInTheDocument();
});
