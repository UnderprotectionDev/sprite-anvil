import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@sprite-anvil/api/routers/index";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ENV } from "../env";
import { showErrorToast } from "./error-notification";

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (query.meta?.errorPresentation === "inline") {
					return;
				}
				showErrorToast(error, {
					kind: "query",
					onRetry: () => {
						void query.fetch().catch(() => undefined);
					},
				});
			},
		}),
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				if (mutation.meta?.errorPresentation === "inline") {
					return;
				}
				showErrorToast(error, { kind: "mutation" });
			},
		}),
	});
}

export const queryClient = createQueryClient();

export const link = new RPCLink({
	url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/rpc`,
	fetch(_url, options) {
		return fetch(_url, {
			...options,
			credentials: "include",
		});
	},
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
