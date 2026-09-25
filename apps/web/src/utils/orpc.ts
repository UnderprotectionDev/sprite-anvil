import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@sprite-anvil/api/routers/index";
import { ENV } from "../env";

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
