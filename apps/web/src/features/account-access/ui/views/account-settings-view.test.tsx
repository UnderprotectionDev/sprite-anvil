// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountSettingsView } from "./account-settings-view";

const account = vi.hoisted(() => ({
	session: null as null | { user: { name: string; email: string } },
	update: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
	authClient: { updateUser: account.update },
}));
afterEach(() => {
	cleanup();
	account.update.mockReset();
});
test("account settings saves a trimmed display name and keeps email read only", async () => {
	account.session = { user: { name: "Artist", email: "artist@example.test" } };
	account.update.mockResolvedValue({ data: { status: true }, error: null });
	render(
		<AccountSettingsView
			email="artist@example.test"
			name="Artist"
			onSignOut={vi.fn()}
		/>
	);
	const name = await screen.findByLabelText("Display name");
	expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
	fireEvent.change(name, { target: { value: " Pixel Artist " } });
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	expect(await screen.findByRole("status")).toHaveTextContent(
		"Display name saved."
	);
	expect(account.update).toHaveBeenCalledWith({ name: "Pixel Artist" });
});

test("keeps an edited display name after an expired session rejects the save", async () => {
	account.session = { user: { name: "Artist", email: "artist@example.test" } };
	account.update.mockResolvedValue({ data: null, error: { status: 401 } });
	render(
		<AccountSettingsView
			email="artist@example.test"
			name="Artist"
			onSignOut={vi.fn()}
		/>
	);
	const name = await screen.findByLabelText("Display name");
	fireEvent.change(name, { target: { value: "New artist" } });
	fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not save your changes"
	);
	expect(name).toHaveValue("New artist");
	expect(name).toHaveAttribute("aria-invalid", "true");
	expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

test("keeps the screen open and reports a rejected sign out", async () => {
	const onSignOut = vi.fn().mockRejectedValue(new Error("network"));
	render(
		<AccountSettingsView
			email="artist@example.test"
			name="Artist"
			onSignOut={onSignOut}
		/>
	);
	fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not sign out"
	);
	expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
});
