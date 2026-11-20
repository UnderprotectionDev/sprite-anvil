import { serveStatic } from "@hono/bun";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createSupportReference } from "@sprite-anvil/api/error-contract";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { getProjectForUser } from "@sprite-anvil/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
	createQueue,
	createStorage,
	requireCloudflareConfig,
} from "./cloudflare";
import {
	createContext,
	measurementSurface,
	pixelEditorDependencies,
} from "./context";
import { desktopOrigins, ENV } from "./env.server";
import { createAssetVersionIntegrityTransform } from "./features/asset-versions/server/asset-version-integrity";
import { mountAssetVersionRoutes } from "./features/asset-versions/server/asset-version-routes";
import { mountImportInboxRoutes } from "./features/imports/server/import-inbox-routes";
import { mountImportInboxRpcGuards } from "./features/imports/server/import-inbox-rpc-guards";
import {
	guardPixelEditorRpcRequest,
	mountPixelEditorRoutes,
} from "./features/pixel-editor/server/pixel-editor-routes";
import { mountManagedSnapshotRoutes } from "./features/production-provenance/server/managed-snapshot-routes";
import { mountProjectArchiveDownloadRoutes } from "./features/project-archives/server/project-archive-download-routes";
import { mountProjectArchiveImportRoutes } from "./features/project-archives/server/project-archive-import-routes";
import { mountProjectRoutes } from "./features/projects/server/project-routes";
import { mountReferenceProductionRoutes } from "./features/reference-production/server/reference-production-routes";
import { mountRightsRecordEvidenceRoutes } from "./features/rights-evidence/server/rights-record-evidence-routes";
import { mountRuntimeValidationEvidenceRoutes } from "./features/runtime-validation/server/runtime-validation-evidence-routes";
import {
	serializeHealthResponse,
	serializePublicApiError,
	serializeRpcInternalServerError,
} from "./output-contracts";
import {
	archiveObjectStorage,
	assetVersionStore,
	auth,
	createServerAssetVersionStorage,
	db,
	importInboxStore,
	managedOperationServices,
	managedSnapshotStore,
	productMeasurementRecorder,
	projectArchiveImportManifestLimit,
	projectArchiveStorage,
	referenceProductionStore,
	rightsRecordStore,
	runtimeValidationStore,
} from "./services";

const app = new Hono();
const cloudflareConfig = () => requireCloudflareConfig(ENV);

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
			"X-Asset-Version-File-Name",
			"X-Asset-Version-Source-Kind",
			"X-Managed-Snapshot-Size",
			"X-Managed-Snapshot-File-Name",
			"X-Reference-Board-Size",
			"X-Reference-Board-File-Name",
			"X-Reference-Board-Metadata",
			"X-Import-Inbox-Size",
			"X-Import-Inbox-File-Name",
			"X-Import-Inbox-Source-Type",
			"X-Source-Asset-Version-Id",
			"X-Unit-Version-Type",
			"X-Unit-Version-Key",
			"Idempotency-Key",
			"X-Project-Archive-SHA256",
			"X-Project-Archive-Size",
			"X-Project-Archive-Name",
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

mountPixelEditorRoutes(app, pixelEditorDependencies);

mountProjectArchiveImportRoutes(app, {
	operations: managedOperationServices?.projectArchiveImportOperations,
	enabled: projectArchiveImportManifestLimit !== undefined,
	getSession: (headers) => auth.api.getSession({ headers }),
});

mountProjectArchiveDownloadRoutes(app, {
	archives: projectArchiveStorage,
	objects: archiveObjectStorage,
	getSession: (headers) => auth.api.getSession({ headers }),
	getProjectForUser: (userId, projectId) =>
		getProjectForUser(db, userId, projectId),
});

mountManagedSnapshotRoutes(app, {
	managedSnapshotStore,
	getSession: (headers) => auth.api.getSession({ headers }),
	getProjectForUser: async (userId, projectId) =>
		getProjectForUser(db, userId, projectId),
	createStorage: createServerAssetVersionStorage,
});

mountReferenceProductionRoutes(app, {
	createAssetVersionIntegrityTransform,
	referenceProductionStore,
	getSession: (headers) => auth.api.getSession({ headers }),
	getProjectForUser: async (userId, projectId) =>
		getProjectForUser(db, userId, projectId),
	createStorage: createServerAssetVersionStorage,
});

mountImportInboxRpcGuards(app);

mountImportInboxRoutes(app, {
	productMeasurementRecorder,
	measurementSurface: (headers) =>
		measurementSurface(headers.get("origin") ?? undefined),
	importInboxStore,
	getSession: (headers) => auth.api.getSession({ headers }),
	getProjectForUser: async (userId, projectId) =>
		getProjectForUser(db, userId, projectId),
	createStorage: createServerAssetVersionStorage,
});

mountRightsRecordEvidenceRoutes(app, {
	rightsRecordStore,
	getSession: (headers) => auth.api.getSession({ headers }),
	createStorage: createServerAssetVersionStorage,
});

mountRuntimeValidationEvidenceRoutes(app, {
	runtimeValidationStore,
	getSession: (headers) => auth.api.getSession({ headers }),
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
	const { path } = c.req;
	if (
		!(
			path === "/rpc" ||
			path.startsWith("/rpc/") ||
			path === "/api-reference" ||
			path.startsWith("/api-reference/")
		)
	) {
		await next();
		return;
	}
	const context = await createContext({ context: c });

	return guardPixelEditorRpcRequest(
		c,
		Boolean(context.session?.user),
		async () => {
			const rpcResult = await rpcHandler.handle(c.req.raw, {
				prefix: "/rpc",
				context,
			});

			if (rpcResult.matched) {
				c.res = c.newResponse(rpcResult.response.body, rpcResult.response);
				return;
			}

			const apiResult = await apiHandler.handle(c.req.raw, {
				prefix: "/api-reference",
				context,
			});

			if (apiResult.matched) {
				c.res = c.newResponse(apiResult.response.body, apiResult.response);
				return;
			}

			await next();
		}
	);
});

app.use("/*", serveStatic({ root: "../web/dist" }));
app.get("/*", serveStatic({ path: "../web/dist/index.html" }));

export default app;
