import { authClient } from "@/lib/auth-client";
import { resetSessionQueryClient } from "@/utils/query-client";
export async function signOutAccount(onSignedOut: () => void | Promise<void>) {
	const response = await authClient.signOut();
	if (response.error && response.error.status !== 401) {
		throw new Error("Could not sign out.");
	}
	resetSessionQueryClient();
	await onSignedOut();
}
