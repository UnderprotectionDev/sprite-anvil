// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { WorkbenchSearch } from "./workbench-search";

globalThis.ResizeObserver = class {
	// biome-ignore lint/style/useThisInClassMethods: fake mirrors the ResizeObserver instance API
	observe() {
		/* jsdom has no layout observer. */
	}
	// biome-ignore lint/style/useThisInClassMethods: fake mirrors the ResizeObserver instance API
	unobserve() {
		/* jsdom has no layout observer. */
	}
	// biome-ignore lint/style/useThisInClassMethods: fake mirrors the ResizeObserver instance API
	disconnect() {
		/* jsdom has no layout observer. */
	}
};
Element.prototype.scrollIntoView = () => {
	/* jsdom has no scrolling. */
};

const mocks = vi.hoisted(() => ({
	navigate: vi.fn(),
	query: vi.fn(),
	options: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mocks.navigate,
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/assets">{children}</a>
	),
}));
vi.mock("@tanstack/react-query", () => ({
	useQuery: (options: unknown) => mocks.query(options),
}));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		assetRecords: {
			search: { queryOptions: (options: unknown) => mocks.options(options) },
		},
	},
}));
afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});
test("opens, searches and navigates to a selected record", async () => {
	mocks.options.mockReturnValue({});
	mocks.query.mockReturnValue({
		data: { records: [{ record: { id: "a1", name: "Knight" } }] },
	});
	render(<WorkbenchSearch projectId="p1" />);
	fireEvent.click(screen.getByRole("button", { name: "Search Asset Records" }));
	fireEvent.change(await screen.findByRole("combobox"), {
		target: { value: " Knight " },
	});
	await waitFor(() =>
		expect(mocks.options).toHaveBeenCalledWith({
			input: {
				projectId: "p1",
				name: "Knight",
				pagination: { limit: 20, offset: 0 },
			},
		})
	);
	fireEvent.click(screen.getByText("Knight"));
	expect(mocks.navigate).toHaveBeenCalledWith({
		to: "/projects/$projectId/assets/$assetRecordId",
		params: { projectId: "p1", assetRecordId: "a1" },
	});
});
test("shows search errors inline", async () => {
	mocks.options.mockReturnValue({});
	mocks.query.mockReturnValue({ isError: true });
	render(<WorkbenchSearch projectId="p1" />);
	fireEvent.click(screen.getByRole("button", { name: "Search Asset Records" }));
	fireEvent.change(await screen.findByRole("combobox"), {
		target: { value: "Knight" },
	});
	expect(await screen.findByRole("alert")).toBeTruthy();
});
