// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import UserMenu from "./user-menu";

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ data: null, isPending: false }),
		signOut: vi.fn(),
	},
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => (
		<a href={to} {...props} />
	),
	useNavigate: () => vi.fn(),
}));

afterEach(cleanup);

test("offers sign-in as one keyboard-focusable link to the login route", () => {
	render(<UserMenu />);
	const link = screen.getByRole("link", { name: "Sign In" });
	expect(link).toHaveAttribute("href", "/login");
	expect(within(link).queryByRole("button")).toBeNull();
	expect(screen.queryByRole("button")).toBeNull();
});
