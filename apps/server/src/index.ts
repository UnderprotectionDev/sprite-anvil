import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createSupportReference } from "@sprite-anvil/api/error-contract";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getProjectForUser } from "@sprite-anvil/db";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
	createQueue,
	createStorage,
	requireCloudflareConfig,
	requireR2Config,
} from "./cloudflare";
import { createContext } from "./context";
import { desktopOrigins, ENV } from "./env.server";
import { mountAssetVersionRoutes } from "./features/asset-versions/server/asset-version-routes";
import { mountProjectRoutes } from "./features/projects/server/project-routes";
import {
	serializeHealthResponse,
	serializePublicApiError,
	serializeRpcInternalServerError,
} from "./output-contracts";
import {
	assetVersionStore,
	auth,
	createServerAssetVersionStorage,
	db,
} from "./services";

const app = new Hono();
const cloudflareConfig = () => requireCloudflareConfig(ENV);
const r2Config = () => requireR2Config(ENV);

app.onError((error, c) => {
	const supportReference = createSupportReference();
	const stack =
		error instanceof Error
			? error.stack?.split("\n").slice(1).join("\n")
			: undefined;
	console.error("Unhandled HTTP request", {
		supportReference,
		method: c.req.method,
		errorName: error instanceof Error ? error.name : "UnknownError",
		...(stack ? { stack } : {}),
	});
	const errorResponse =
		c.req.path === "/rpc" || c.req.path.startsWith("/rpc/")
			? serializeRpcInternalServerError(supportReference)
			: serializePublicApiError("Internal Server Error", supportReference);
	return c.json(errorResponse, 500);
});

app.use(logger());
app.use(
	"/*",
	cors({
		origin: [ENV.CORS_ORIGIN, ...desktopOrigins],
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"X-Asset-Version-Size",
			"Idempotency-Key",
		],
		credentials: true,
	})
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

app.get("/health", (c) => c.json(serializeHealthResponse()));

mountProjectRoutes(app, {
	getSession: (headers) => auth.api.getSession({ headers }),
	getProjectForUser: (userId, projectId) =>
		getProjectForUser(db, userId, projectId),
	cloudflareConfig,
	createQueue,
	createStorage,
});

mountAssetVersionRoutes(app, {
	assetVersionStore,
	getSession: (headers) => auth.api.getSession({ headers }),
	getProjectForUser: async (userId, projectId) =>
		getProjectForUser(db, userId, projectId),
	createStorage: createServerAssetVersionStorage,
});

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter);

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.use("/*", serveStatic({ root: "../web/dist" }));
app.get("/*", serveStatic({ path: "../web/dist/index.html" }));

export default app;
