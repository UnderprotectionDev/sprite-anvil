// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ProductionRecipesView } from "./production-recipes-view";

const idlePattern = /idle/u;

afterEach(() => cleanup());

const fixtures = vi.hoisted(() => ({
	recipes: [] as Record<string, unknown>[],
	copy: vi.fn(),
	create: vi.fn(),
	createVersion: vi.fn(),
	use: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
	orpc: {
		productionRecipes: {
			list: {
				queryOptions: () => ({
					queryKey: ["recipes"],
					queryFn: async () => fixtures.recipes,
				}),
				queryKey: () => ["recipes"],
			},
			createVersion: {
				mutationOptions: () => ({ mutationFn: fixtures.createVersion }),
			},
			create: { mutationOptions: () => ({ mutationFn: fixtures.create }) },
			use: { mutationOptions: () => ({ mutationFn: fixtures.use }) },
			copy: { mutationOptions: () => ({ mutationFn: fixtures.copy }) },
		},
		productionExperiments: {
			list: {
				queryOptions: () => ({
					queryKey: ["experiments"],
					queryFn: async () => [
						{
							id: "66666666-6666-4666-8666-666666666666",
							title: "Experiment",
							trials: [
								{ id: "77777777-7777-4777-8777-777777777777", label: "Trial" },
							],
						},
					],
				}),
			},
		},
		projects: {
			list: {
				queryOptions: () => ({
					queryKey: ["projects"],
					queryFn: async () => [
						{
							id: "22222222-2222-4222-8222-222222222222",
							name: "Other project",
						},
					],
				}),
			},
		},
		assetVersions: {
			list: {
				queryOptions: () => ({
					queryKey: ["versions"],
					queryFn: async () => ({
						unitVersions: [
							{
								id: "33333333-3333-4333-8333-333333333333",
								assetRecordId: "44444444-4444-4444-8444-444444444444",
								unitType: "frame",
								unitKey: "idle",
								versionNumber: 1,
							},
						],
					}),
				}),
			},
		},
		assetRecords: {
			list: {
				queryOptions: () => ({
					queryKey: ["records"],
					queryFn: async () => [
						{ id: "44444444-4444-4444-8444-444444444444", name: "Hero" },
						{ id: "88888888-8888-4888-8888-888888888888", name: "Tree" },
					],
				}),
			},
		},
	},
}));

test("offers creation from an experiment and a target record", async () => {
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="project" />
		</QueryClientProvider>
	);
	expect(
		await screen.findByText("Create Production Recipe")
	).toBeInTheDocument();
	expect(screen.getByLabelText("Source Asset Record")).toBeInTheDocument();
});

test("copies a recipe to the selected project", async () => {
	fixtures.recipes = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			title: "Example",
			versions: [
				{
					versionNumber: 1,
					content: {
						fields: [],
						referenceRoles: [],
						instructionSkeleton: "Draw",
						expectedOutputStructure: "PNG",
					},
				},
			],
		},
	];
	fixtures.copy.mockResolvedValue({});
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="project" />
		</QueryClientProvider>
	);
	await screen.findByRole("option", { name: "Other project" });
	await userEvent.selectOptions(
		await screen.findByLabelText("Copy to project"),
		"22222222-2222-4222-8222-222222222222"
	);
	await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
	expect(
		await screen.findByText("Independent copy created in the selected project.")
	).toBeInTheDocument();
	expect(fixtures.copy).toHaveBeenCalledWith(
		expect.objectContaining({
			targetProjectId: "22222222-2222-4222-8222-222222222222",
		}),
		expect.anything()
	);
});

test("selects a unit version for recipe use", async () => {
	fixtures.recipes = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			title: "Example",
			versions: [
				{
					versionNumber: 1,
					content: {
						fields: [],
						referenceRoles: [],
						instructionSkeleton: "Draw",
						expectedOutputStructure: "PNG",
					},
				},
			],
		},
	];
	fixtures.use.mockResolvedValue({});
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="55555555-5555-4555-8555-555555555555" />
		</QueryClientProvider>
	);
	await userEvent.selectOptions(
		await screen.findByLabelText("Target Asset Record"),
		"44444444-4444-4444-8444-444444444444"
	);
	await userEvent.click(
		await screen.findByRole("checkbox", { name: idlePattern })
	);
	await userEvent.type(screen.getByLabelText("Target width"), "32");
	await userEvent.type(screen.getByLabelText("Target height"), "32");
	await userEvent.click(screen.getByRole("button", { name: "Use recipe" }));
	expect(
		await screen.findByText("Generation Package created.")
	).toBeInTheDocument();
	expect(fixtures.use).toHaveBeenCalledWith(
		expect.objectContaining({
			lockedUnitVersionIds: ["33333333-3333-4333-8333-333333333333"],
			versionNumber: 1,
		}),
		expect.anything()
	);
});

test("edits the current recipe into a new version", async () => {
	fixtures.recipes = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			title: "Example",
			versions: [
				{
					versionNumber: 1,
					content: {
						instructionSkeleton: "Draw",
						expectedOutputStructure: "PNG",
						fields: [],
						referenceRoles: [],
					},
				},
			],
		},
	];
	fixtures.createVersion.mockResolvedValue({});
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="55555555-5555-4555-8555-555555555555" />
		</QueryClientProvider>
	);
	const instruction = await screen.findByLabelText("Instruction skeleton");
	await userEvent.clear(instruction);
	await userEvent.type(instruction, "Paint");
	await userEvent.click(screen.getByRole("button", { name: "Create version" }));
	expect(
		await screen.findByText("Production Recipe version created.")
	).toBeInTheDocument();
	expect(fixtures.createVersion).toHaveBeenCalledWith(
		expect.objectContaining({
			baseVersionNumber: 1,
			content: expect.objectContaining({ instructionSkeleton: "Paint" }),
		}),
		expect.anything()
	);
});

test("shows a version conflict without discarding edits", async () => {
	fixtures.recipes = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			title: "Example",
			versions: [
				{
					versionNumber: 1,
					content: {
						instructionSkeleton: "Draw",
						expectedOutputStructure: "PNG",
						fields: [],
						referenceRoles: [],
					},
				},
			],
		},
	];
	fixtures.createVersion.mockRejectedValueOnce(
		new Error("Reload and edit the latest version.")
	);
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="55555555-5555-4555-8555-555555555555" />
		</QueryClientProvider>
	);
	const input = await screen.findByLabelText("Instruction skeleton");
	await userEvent.type(input, " more");
	await userEvent.click(screen.getByRole("button", { name: "Create version" }));
	expect(
		await screen.findByText("Reload and edit the latest version.")
	).toBeInTheDocument();
	expect(input).toHaveValue("Draw more");
});

test("creates a recipe from a selected trial and reports an error", async () => {
	fixtures.recipes = [];
	fixtures.create
		.mockResolvedValueOnce({})
		.mockRejectedValueOnce(new Error("Create failed"));
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="55555555-5555-4555-8555-555555555555" />
		</QueryClientProvider>
	);
	await userEvent.type(screen.getByLabelText("Title"), "Recipe");
	await userEvent.selectOptions(
		await screen.findByLabelText("Source Asset Record"),
		"44444444-4444-4444-8444-444444444444"
	);
	await userEvent.selectOptions(
		await screen.findByLabelText("Production Experiment"),
		await screen.findByRole("option", { name: "Experiment" })
	);
	await userEvent.selectOptions(
		screen.getByLabelText("Trial"),
		"77777777-7777-4777-8777-777777777777"
	);
	await userEvent.click(screen.getByRole("button", { name: "Create recipe" }));
	expect(
		await screen.findByText("Production Recipe created.")
	).toBeInTheDocument();
	await userEvent.click(screen.getByRole("button", { name: "Create recipe" }));
	expect(await screen.findByText("Create failed")).toBeInTheDocument();
});

test("reports copy and use errors", async () => {
	fixtures.recipes = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			title: "Example",
			versions: [
				{
					versionNumber: 1,
					content: {
						instructionSkeleton: "Draw",
						expectedOutputStructure: "PNG",
						fields: [],
						referenceRoles: [],
					},
				},
			],
		},
	];
	fixtures.copy.mockRejectedValueOnce(new Error("Copy failed"));
	fixtures.use.mockRejectedValueOnce(new Error("Use failed"));
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="55555555-5555-4555-8555-555555555555" />
		</QueryClientProvider>
	);
	await userEvent.selectOptions(
		await screen.findByLabelText("Copy to project"),
		await screen.findByRole("option", { name: "Other project" })
	);
	await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
	expect(await screen.findByText("Copy failed")).toBeInTheDocument();
	await userEvent.selectOptions(
		screen.getByLabelText("Target Asset Record"),
		"44444444-4444-4444-8444-444444444444"
	);
	await userEvent.type(screen.getByLabelText("Target width"), "32");
	await userEvent.type(screen.getByLabelText("Target height"), "32");
	await userEvent.click(screen.getByRole("button", { name: "Use recipe" }));
	expect(await screen.findByText("Use failed")).toBeInTheDocument();
});

test("shows copy validation and clears locked versions when target changes", async () => {
	fixtures.recipes = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			title: "Example",
			versions: [
				{
					versionNumber: 1,
					content: {
						fields: [],
						referenceRoles: [],
						instructionSkeleton: "Draw",
						expectedOutputStructure: "PNG",
					},
				},
			],
		},
	];
	fixtures.use.mockResolvedValue({});
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<ProductionRecipesView projectId="55555555-5555-4555-8555-555555555555" />
		</QueryClientProvider>
	);
	await screen.findByLabelText("Copy to project");
	await userEvent.click(screen.getByRole("button", { name: "Copy recipe" }));
	expect(await screen.findByText("Choose a project.")).toBeInTheDocument();
	await userEvent.selectOptions(
		screen.getByLabelText("Target Asset Record"),
		"44444444-4444-4444-8444-444444444444"
	);
	await userEvent.click(
		await screen.findByRole("checkbox", { name: idlePattern })
	);
	await userEvent.selectOptions(
		screen.getByLabelText("Target Asset Record"),
		"88888888-8888-4888-8888-888888888888"
	);
	await userEvent.type(screen.getByLabelText("Target width"), "32");
	await userEvent.type(screen.getByLabelText("Target height"), "32");
	await userEvent.click(screen.getByRole("button", { name: "Use recipe" }));
	await screen.findByText("Generation Package created.");
	expect(fixtures.use).toHaveBeenLastCalledWith(
		expect.objectContaining({ lockedUnitVersionIds: [] }),
		expect.anything()
	);
});

test("preserves the editing draft and base when recipes refresh", async () => {
	const version = {
		versionNumber: 1,
		content: {
			fields: [],
			referenceRoles: [],
			instructionSkeleton: "Draw",
			expectedOutputStructure: "PNG",
		},
	};
	fixtures.recipes = [
		{
			id: "11111111-1111-4111-8111-111111111111",
			title: "Example",
			versions: [version],
		},
	];
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<ProductionRecipesView projectId="55555555-5555-4555-8555-555555555555" />
		</QueryClientProvider>
	);
	const input = await screen.findByLabelText("Instruction skeleton");
	await userEvent.type(input, " draft");
	client.setQueryData(
		["recipes"],
		[
			{
				...fixtures.recipes[0],
				versions: [version, { ...version, versionNumber: 2 }],
			},
		]
	);
	expect(await screen.findByText("Editing version 1")).toBeInTheDocument();
	expect(screen.getByLabelText("Instruction skeleton")).toHaveValue(
		"Draw draft"
	);
});
