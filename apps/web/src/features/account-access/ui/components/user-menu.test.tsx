// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import UserMenu from "./user-menu";

const artistName = /Artist/u;
const account = vi.hoisted(() => ({
	session: null as null | { user: { name: string; email: string } },
	update: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ data: account.session, isPending: false }),
		signOut: vi.fn(),
		updateUser: account.update,
	},
}));
vi.mock("@tanstack/react-router", () => ({
	Link: ({ to, ...props }: ComponentProps<"a"> & { to: string }) => (
		<a href={to} {...props} />
	),
	useNavigate: () => vi.fn(),
}));

afterEach(() => {
	cleanup();
	account.session = null;
	account.update.mockReset();
});

test("offers sign-in as one keyboard-focusable link to the login route", () => {
	render(<UserMenu />);
	const link = screen.getByRole("link", { name: "Sign In" });
	expect(link).toHaveAttribute("href", "/login");
	expect(within(link).queryByRole("button")).toBeNull();
	expect(screen.queryByRole("button")).toBeNull();
});

test("account settings is a page link in the account menu", async () => {
	account.session = { user: { name: "Artist", email: "artist@example.test" } };
	render(<UserMenu />);
	fireEvent.click(screen.getByRole("button", { name: artistName }));
	expect(
		await screen.findByRole("menuitem", { name: "Account settings" })
	).toHaveAttribute("href", "/account-settings");
});
