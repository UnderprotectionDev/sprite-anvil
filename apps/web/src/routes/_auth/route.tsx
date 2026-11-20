import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import {
	getSessionQueryClient,
	resetSessionQueryClient,
} from "@/utils/query-client";

export const Route = createFileRoute("/_auth")({
	component: AuthLayout,
	beforeLoad: async ({ abortController }) => {
		const session = await authClient.getSession();
		if (!session.data) {
			if (!(session.error || abortController.signal.aborted)) {
				resetSessionQueryClient();
			}
			throw redirect({
				to: "/login",
			});
		}
		const { data } = session;
		return {
			session: data,
			queryClient: abortController.signal.aborted
				? undefined
				: getSessionQueryClient(data.user.id, data.session.id),
		};
	},
});

function AuthLayout() {
	return <Outlet />;
}
