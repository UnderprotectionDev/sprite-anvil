import type { Context as ApiContext } from "@sprite-anvil/api/context";
import type { Context as HonoContext } from "hono";
import { auth, projectAccess } from "./services";

export interface CreateContextOptions {
	context: HonoContext;
}

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		projectAccess,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
