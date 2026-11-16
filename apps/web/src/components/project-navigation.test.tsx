// @vitest-environment jsdom

import {
	Sidebar,
	SidebarProvider,
	SidebarTrigger,
} from "@sprite-anvil/ui/components/sidebar";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ProjectNavigation } from "./project-navigation";

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: { name: "Demo" } }),
}));
vi.mock("@/utils/orpc", () => ({
	orpc: { projects: { get: { queryOptions: () => ({}) } } },
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));
afterEach(cleanup);
window.matchMedia = vi
	.fn()
	.mockReturnValue({ addEventListener: vi.fn(), removeEventListener: vi.fn() });

test("renders grouped project links and the sidebar trigger", () => {
	render(
		<SidebarProvider>
			<Sidebar>
				<ProjectNavigation projectId="p1" />
			</Sidebar>
			<SidebarTrigger />
		</SidebarProvider>
	);
	expect(screen.getByText("Library")).toBeTruthy();
	expect(screen.getByText("Context")).toBeTruthy();
	expect(screen.getByText("Delivery")).toBeTruthy();
	expect(
		screen
			.getByRole("link", { name: "Production Experiments" })
			.getAttribute("href")
	).toContain("production-experiments");
	expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Permanent Erasure" }).getAttribute("href")
	).toContain("permanent-erasure");
});

test("opens the mobile sidebar with its trigger", async () => {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: 390,
	});
	render(
		<SidebarProvider>
			<Sidebar>
				<ProjectNavigation projectId="p1" />
			</Sidebar>
			<SidebarTrigger />
		</SidebarProvider>
	);
	fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
	expect(
		await screen.findByRole("link", { name: "Production Experiments" })
	).toBeTruthy();
});
