import type { Context as ApiContext } from "@sprite-anvil/api/context";
import type { Context as HonoContext } from "hono";
import {
	assetFamilyStore,
	auth,
	db,
	projectAccess,
	projectContextScopeStore,
	projectContextStore,
} from "./services";

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
		assetFamilyStore,
		projectAccess,
		projectContextScopeStore,
		db,
		projectContextStore,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
