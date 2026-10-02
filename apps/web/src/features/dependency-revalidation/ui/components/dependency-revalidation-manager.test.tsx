// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { DependencyCatalog } from "@sprite-anvil/api/dependency-revalidation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DependencyRevalidationManager } from "./dependency-revalidation-manager";

const transport = vi.hoisted(() => ({
	catalog: {
		dependencyLinks: [],
		changeImpacts: [],
		revalidationRequiredVersionIds: [],
		contextRevisions: [],
	} as DependencyCatalog,
	failRead: false,
	failWrite: false,
}));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		dependencyRevalidation: {
			list: {
				queryOptions: () => ({
					queryKey: ["dependency-revalidation"],
					queryFn: () => {
						if (transport.failRead) {
							return Promise.reject(new Error("Read unavailable"));
						}
						return Promise.resolve(structuredClone(transport.catalog));
					},
				}),
			},
		},
	},
	client: {
		dependencyRevalidation: {
			determine: (input: {
				projectId: string;
				source: { kind: "canonical_design"; id: string };
				facets: string[];
			}) => {
				if (transport.failWrite) {
					return Promise.reject(new Error("Write failed"));
				}
				const result = {
					...input,
					id: "change-1",
					createdAt: "2026-10-02T12:00:00.000Z",
					affectedVersions: [
						{
							assetVersionId: "east-version",
							assetRecordId: "east",
							status: "revalidation_required" as const,
							reason: "matching_dependency" as const,
							dependencySourceId: "base-version",
						},
					],
				};
				transport.catalog = {
					...transport.catalog,
					changeImpacts: [result],
					revalidationRequiredVersionIds: ["east-version"],
				};
				return Promise.resolve(result);
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	transport.catalog = {
		dependencyLinks: [],
		changeImpacts: [],
		revalidationRequiredVersionIds: [],
		contextRevisions: [],
	};
	transport.failRead = false;
	transport.failWrite = false;
});

function openManager() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<DependencyRevalidationManager
				canonicalVersionIds={["base-version"]}
				projectId="project-1"
				records={[
					{ id: "base", name: "Ash Knight base" },
					{ id: "east", name: "Ash Knight east" },
				]}
				versions={[
					{ id: "base-version", assetRecordId: "base", versionNumber: 1 },
					{ id: "east-version", assetRecordId: "east", versionNumber: 1 },
				]}
			/>
		</QueryClientProvider>
	);
}

test("user confirms a palette Change Facet and sees persisted Revalidation Required after reopening", async () => {
	const view = openManager();
	await screen.findByLabelText("Değişen kaynak");
	fireEvent.change(screen.getByLabelText("Değişen kaynak"), {
		target: { value: "base-version" },
	});
	const [, paletteCheckbox] = screen.getAllByLabelText("Palet");
	if (!paletteCheckbox) {
		throw new Error("The Change Facet palette control is missing.");
	}
	fireEvent.click(paletteCheckbox);
	fireEvent.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	await screen.findByText("Değişiklik etkisi kaydedildi.");
	expect(
		screen.getByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
	view.unmount();
	openManager();
	expect(
		await screen.findByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
});

test("a catalog error disables mutation and exposes a retry control", async () => {
	transport.failRead = true;
	openManager();
	await screen.findByRole("alert");
	expect(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	).toBeDisabled();
	transport.failRead = false;
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(screen.queryByRole("alert")).not.toBeInTheDocument()
	);
});

test("a failed write requires a persisted status check before another mutation", async () => {
	transport.failWrite = true;
	openManager();
	await screen.findByLabelText("Değişen kaynak");
	fireEvent.change(screen.getByLabelText("Değişen kaynak"), {
		target: { value: "base-version" },
	});
	const [, paletteCheckbox] = screen.getAllByLabelText("Palet");
	if (!paletteCheckbox) {
		throw new Error("The Change Facet palette control is missing.");
	}
	fireEvent.click(paletteCheckbox);
	fireEvent.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	await screen.findByText(
		"İşlem tamamlanamadı veya sonucu doğrulanamadı. Yeniden kaydetmeden önce durumu kontrol edin."
	);
	expect(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	).toBeDisabled();
	expect(
		screen.queryByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).not.toBeInTheDocument();
	transport.failWrite = false;
	fireEvent.click(screen.getByRole("button", { name: "Durumu kontrol et" }));
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
		).toBeEnabled()
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Değişiklik Etkisini Belirle" })
	);
	expect(
		await screen.findByText("Ash Knight east · v1: Yeniden Doğrulama Gerekli")
	).toBeInTheDocument();
});
