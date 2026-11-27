// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { signOutAccount } from "./sign-out-account";

const mocks = vi.hoisted(() => ({ signOut: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
	authClient: { signOut: mocks.signOut },
}));
vi.mock("@/utils/query-client", () => ({
	resetSessionQueryClient: mocks.reset,
}));
test("expired sessions return to sign in but server failures keep the session and page", async () => {
	const navigate = vi.fn();
	mocks.signOut.mockResolvedValueOnce({ error: { status: 500 } });
	await expect(signOutAccount(navigate)).rejects.toThrow("Could not sign out");
	expect(navigate).not.toHaveBeenCalled();
	expect(mocks.reset).not.toHaveBeenCalled();
	mocks.signOut.mockResolvedValueOnce({ error: { status: 401 } });
	await signOutAccount(navigate);
	expect(navigate).toHaveBeenCalledOnce();
	expect(mocks.reset).toHaveBeenCalledOnce();
});
