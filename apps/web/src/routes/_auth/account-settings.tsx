import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { signOutAccount } from "@/features/account-access/lib/sign-out-account";
import { AccountSettingsView } from "@/features/account-access/ui/views/account-settings-view";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/account-settings")({
	component: AccountSettingsRoute,
});

function AccountSettingsRoute() {
	const { data: session } = authClient.useSession();
	const navigate = useNavigate();
	if (!session) {
		return null;
	}
	return (
		<AccountSettingsView
			email={session.user.email}
			image={session.user.image}
			name={session.user.name}
			onSignOut={() => signOutAccount(() => navigate({ to: "/login" }))}
		/>
	);
}
