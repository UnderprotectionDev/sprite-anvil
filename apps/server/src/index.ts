import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { mountAssetRoutes } from "./asset-routes";
import {
	createQueue,
	createStorage,
	requireCloudflareConfig,
} from "./cloudflare";
import { createContext } from "./context";
import { desktopOrigins, ENV } from "./env.server";
import { findOwnedProject } from "./project-repository";
import { mountProjectRoutes } from "./project-routes";
import { auth, db } from "./services";

const app = new Hono();
const cloudflareConfig = () => requireCloudflareConfig(ENV);

app.use(logger());
app.use(
	"/*",
	cors({
		origin: [ENV.CORS_ORIGIN, ...desktopOrigins],
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => auth.handler(c.req.raw));

app.get("/health", (c) => c.json({ status: "ok" }));

mountAssetRoutes(app, {
	getSession: (headers) => auth.api.getSession({ headers }),
	cloudflareConfig,
	createQueue,
	createStorage,
});

mountProjectRoutes(app, {
	getSession: (headers) => auth.api.getSession({ headers }),
	findOwnedProject: (projectId, ownerUserId) =>
		findOwnedProject(db, projectId, ownerUserId),
	getPreview: (key) => createStorage(cloudflareConfig()).getPreview(key),
});

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

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
