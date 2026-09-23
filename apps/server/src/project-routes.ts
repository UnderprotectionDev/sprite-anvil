import type { Context, Hono } from "hono";
import z from "zod";

import {
	assetKeySchema,
	assetUploadContentTypeSchema,
	type CloudflareConfig,
	type createQueue,
	type createStorage,
} from "./cloudflare";

const projectIdSchema = z.string().uuid();
const assetIdSchema = z.string().uuid();

export interface ProjectSession {
	user: { id: string };
}

export interface ProjectRecord {
	id: string;
	name: string;
}

export interface ProjectRouteDependencies {
	cloudflareConfig: () => CloudflareConfig;
	createId?: () => string;
	createQueue: (
		config: CloudflareConfig
	) => Pick<ReturnType<typeof createQueue>, "send">;
	createStorage: (
		config: CloudflareConfig
	) => Pick<ReturnType<typeof createStorage>, "delete" | "get" | "put">;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<ProjectRecord | null>;
	getSession: (headers: Headers) => Promise<ProjectSession | null>;
}

type ProjectAccess =
	| { ok: true; project: ProjectRecord }
	| { ok: false; error: "Unauthorized"; status: 401 }
	| { ok: false; error: "Not found"; status: 404 };

async function resolveProjectAccess(
	headers: Headers,
	projectIdInput: string,
	dependencies: ProjectRouteDependencies
): Promise<ProjectAccess> {
	const session = await dependencies.getSession(headers);
	if (!session?.user) {
		return { ok: false, error: "Unauthorized", status: 401 };
	}

	const parsedProjectId = projectIdSchema.safeParse(projectIdInput);
	if (!parsedProjectId.success) {
		return { ok: false, error: "Not found", status: 404 };
	}

	const project = await dependencies.getProjectForUser(
		session.user.id,
		parsedProjectId.data
	);
	if (!project) {
		return { ok: false, error: "Not found", status: 404 };
	}

	return { ok: true, project };
}

function errorResponse(
	c: Context,
	access: Exclude<ProjectAccess, { ok: true }>
) {
	return c.json({ error: access.error }, access.status);
}

export function mountProjectRoutes(
	app: Hono,
	dependencies: ProjectRouteDependencies
) {
	app.get("/api/projects/:projectId", async (c) => {
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return errorResponse(c, access);
		}

		c.header("Cache-Control", "private, no-store");
		return c.json({ id: access.project.id, name: access.project.name });
	});

	app.post("/api/projects/:projectId/assets", async (c) => {
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return errorResponse(c, access);
		}

		const contentType = assetUploadContentTypeSchema.safeParse(
			c.req.header("content-type")?.split(";")[0]?.trim()
		);
		if (!contentType.success) {
			return c.json({ error: "Unsupported asset type" }, 415);
		}

		const { body } = c.req.raw;
		if (!body) {
			return c.json({ error: "Missing asset content" }, 400);
		}

		const rawLength = c.req.header("content-length");
		const contentLength =
			rawLength === undefined ? undefined : Number(rawLength);
		if (
			rawLength !== undefined &&
			(contentLength === undefined ||
				!Number.isSafeInteger(contentLength) ||
				contentLength <= 0)
		) {
			return c.json({ error: "Invalid asset content length" }, 400);
		}

		const assetId = (dependencies.createId ?? crypto.randomUUID)();
		const key = `projects/${access.project.id}/assets/${assetId}`;
		assetKeySchema.parse(key);

		const config = dependencies.cloudflareConfig();
		const storage = dependencies.createStorage(config);
		try {
			await storage.put(key, body, contentType.data, contentLength);
			await dependencies.createQueue(config).send(key);
		} catch {
			try {
				await storage.delete(key);
			} catch {
				// The upload still fails closed if cleanup is unavailable.
			}
			return c.json({ error: "Asset upload failed" }, 503);
		}

		return c.json({ assetId }, 201);
	});

	app.get("/api/projects/:projectId/assets/:assetId/preview", async (c) => {
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return errorResponse(c, access);
		}

		const assetId = assetIdSchema.safeParse(c.req.param("assetId"));
		if (!assetId.success) {
			return c.json({ error: "Not found" }, 404);
		}

		const object = await dependencies
			.createStorage(dependencies.cloudflareConfig())
			.get(`projects/${access.project.id}/assets/${assetId.data}`);
		if (!object) {
			return c.json({ error: "Not found" }, 404);
		}

		c.header("Cache-Control", "private, no-store");
		c.header("X-Content-Type-Options", "nosniff");
		const headers: Record<string, string> = {
			"Content-Type": object.contentType,
		};
		if (object.contentLength !== undefined) {
			headers["Content-Length"] = object.contentLength.toString();
		}
		return c.body(object.body, 200, headers);
	});
}
