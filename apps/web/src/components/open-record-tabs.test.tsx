// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { createOpenRecordStore } from "@/utils/open-records";
import { OpenRecordTabs } from "./open-record-tabs";

const routing = vi.hoisted(() => ({
	params: { projectId: "project", assetRecordId: "record-a" },
	navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
	useParams: () => routing.params,
	useSearch: () => ({}),
	useNavigate: () => routing.navigate,
	Link: ({
		children,
		to,
		...props
	}: React.PropsWithChildren<{ to: string }>) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		assetRecords: { get: { queryOptions: () => ({ queryKey: ["record"] }) } },
	},
}));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		isSuccess: true,
		data: {
			id: routing.params.assetRecordId,
			projectId: "project",
			name: routing.params.assetRecordId === "record-a" ? "Knight" : "Slime",
		},
	}),
}));
afterEach(() => {
	cleanup();
	routing.params.assetRecordId = "record-a";
	vi.clearAllMocks();
});

test("keeps opened records while navigating and closing the current record opens its neighbour", async () => {
	const store = createOpenRecordStore();
	const { rerender } = render(<OpenRecordTabs store={store} userId="owner" />);
	expect(await screen.findByRole("link", { name: "Knight" })).toBeTruthy();
	routing.params.assetRecordId = "record-b";
	rerender(<OpenRecordTabs store={store} userId="owner" />);
	expect(await screen.findByRole("link", { name: "Slime" })).toBeTruthy();
	expect(screen.getByRole("link", { name: "Knight" })).toBeTruthy();
	fireEvent.click(screen.getByRole("button", { name: "Close Slime" }));
	await waitFor(() =>
		expect(routing.navigate).toHaveBeenCalledWith(
			expect.objectContaining({
				params: { projectId: "project", assetRecordId: "record-a" },
			})
		)
	);
});

test("does not show another account's open records", async () => {
	const store = createOpenRecordStore();
	const { rerender } = render(<OpenRecordTabs store={store} userId="owner" />);
	await screen.findByRole("link", { name: "Knight" });
	routing.params.assetRecordId = "record-b";
	rerender(<OpenRecordTabs store={store} userId="other-owner" />);
	await screen.findByRole("link", { name: "Slime" });
	expect(screen.queryByRole("link", { name: "Knight" })).toBeNull();
});
