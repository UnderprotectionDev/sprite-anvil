import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import {
	serializePrivateDataResponse,
	serializeRpcHealthResponse,
} from "../output-contracts";
import { projectsRouter } from "./projects";

export const appRouter = {
	healthCheck: publicProcedure.handler(() => serializeRpcHealthResponse()),
	projects: projectsRouter,
	privateData: protectedProcedure.handler(({ context }) =>
		serializePrivateDataResponse(context.session?.user)
	),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
