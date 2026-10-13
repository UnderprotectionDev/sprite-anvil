// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { LoginView } from "./login-view";

const auth = vi.hoisted(() => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: () => ({ isPending: false }),
		signIn: { email: auth.signIn },
		signUp: { email: auth.signUp },
	},
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

afterEach(() => {
	cleanup();
	auth.signIn.mockReset();
	auth.signUp.mockReset();
});

test("signs in with the values entered in the labelled account fields", async () => {
	const user = userEvent.setup();
	render(<LoginView />);
	expect(screen.getByLabelText("Email")).toHaveAttribute(
		"autocomplete",
		"email"
	);
	expect(screen.getByLabelText("Password")).toHaveAttribute(
		"autocomplete",
		"current-password"
	);
	await user.type(screen.getByLabelText("Email"), "artist@example.test");
	await user.type(screen.getByLabelText("Password"), "correct-password");
	await user.click(screen.getByRole("button", { name: "Sign In" }));
	expect(auth.signIn).toHaveBeenCalledWith(
		{ email: "artist@example.test", password: "correct-password" },
		expect.any(Object)
	);
});

test("switches to sign up and submits name, email and a new password", async () => {
	const user = userEvent.setup();
	render(<LoginView />);
	await user.click(
		screen.getByRole("button", { name: "Need an account? Sign Up" })
	);
	expect(screen.getByLabelText("Name")).toHaveAttribute("autocomplete", "name");
	expect(screen.getByLabelText("Password")).toHaveAttribute(
		"autocomplete",
		"new-password"
	);
	await user.type(screen.getByLabelText("Name"), "Pixel Artist");
	await user.type(screen.getByLabelText("Email"), "artist@example.test");
	await user.type(screen.getByLabelText("Password"), "new-password");
	await user.click(screen.getByRole("button", { name: "Sign Up" }));
	expect(auth.signUp).toHaveBeenCalledWith(
		{
			name: "Pixel Artist",
			email: "artist@example.test",
			password: "new-password",
		},
		expect.any(Object)
	);
});

test("shows the validation error and does not send a short password", async () => {
	const user = userEvent.setup();
	render(<LoginView />);
	await user.type(screen.getByLabelText("Email"), "artist@example.test");
	await user.type(screen.getByLabelText("Password"), "short");
	await user.click(screen.getByRole("button", { name: "Sign In" }));
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Password must be at least 8 characters"
	);
	expect(auth.signIn).not.toHaveBeenCalled();
});
