import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import {
	serializePrivateDataResponse,
	serializeRpcHealthResponse,
} from "../output-contracts";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => serializeRpcHealthResponse()),
	privateData: protectedProcedure.handler(({ context }) =>
		serializePrivateDataResponse(context.session?.user)
	),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
