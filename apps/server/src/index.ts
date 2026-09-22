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
import {
	assetReadySchema,
	assetUploadSchema,
	createQueue,
	createStorage,
	requireCloudflareConfig,
} from "./cloudflare";
import { createContext } from "./context";
import { desktopOrigins, ENV } from "./env.server";
import { auth } from "./services";

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

app.post("/api/assets/upload-url", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const input = assetUploadSchema.safeParse(await c.req.json());
	if (!input.success) {
		return c.json({ error: "Invalid upload request" }, 400);
	}
	return c.json(
		await createStorage(cloudflareConfig()).signUpload(
			session.user.id,
			input.data.contentType
		)
	);
});

app.post("/api/assets/complete", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	const input = assetReadySchema.safeParse(await c.req.json());
	if (
		!(input.success && input.data.key.startsWith(`users/${session.user.id}/`))
	) {
		return c.json({ error: "Invalid asset key" }, 400);
	}
	const config = cloudflareConfig();
	await createStorage(config).exists(input.data.key);
	await createQueue(config).send(input.data.key);
	return c.json({ queued: true });
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

app.get("/", (c) => c.redirect("/studio"));

app.use("/*", serveStatic({ root: "../web/dist" }));
app.get("/*", serveStatic({ path: "../web/dist/index.html" }));

export default app;
