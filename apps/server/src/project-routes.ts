import type { Hono } from "hono";

import { assetReadySchema, type PrivatePreview } from "./cloudflare";

export interface ProjectSession {
	user: { id: string };
}

export interface ProjectRecord {
	id: string;
	name: string;
	ownerUserId: string;
	previewKey: string | null;
}

export interface ProjectRouteDependencies {
	findOwnedProject: (
		projectId: string,
		ownerUserId: string
	) => Promise<ProjectRecord | null>;
	getPreview: (key: string) => Promise<PrivatePreview | null>;
	getSession: (headers: Headers) => Promise<ProjectSession | null>;
}

type ProjectAccess =
	| { ok: true; project: ProjectRecord; ownerUserId: string }
	| {
			ok: false;
			status: 401 | 404;
			error: "Unauthorized" | "Project not found";
	  };

const privateResponseHeaders = { "cache-control": "private, no-store" };

function privateErrorResponse(status: 401 | 404, error: string) {
	return Response.json({ error }, { status, headers: privateResponseHeaders });
}

async function resolveProjectAccess(
	projectId: string,
	headers: Headers,
	dependencies: ProjectRouteDependencies
): Promise<ProjectAccess> {
	const session = await dependencies.getSession(headers);
	if (!session?.user?.id) {
		return { ok: false, status: 401, error: "Unauthorized" };
	}

	const project = await dependencies.findOwnedProject(
		projectId,
		session.user.id
	);
	if (!project) {
		return { ok: false, status: 404, error: "Project not found" };
	}

	return { ok: true, project, ownerUserId: session.user.id };
}

function isOwnedPreviewKey(
	key: string | null,
	ownerUserId: string
): key is string {
	return (
		key !== null &&
		assetReadySchema.safeParse({ key }).success &&
		key.startsWith(`users/${ownerUserId}/`)
	);
}

export function mountProjectRoutes(
	app: Hono,
	dependencies: ProjectRouteDependencies
) {
	app.get("/api/projects/:projectId", async (c) => {
		const access = await resolveProjectAccess(
			c.req.param("projectId"),
			c.req.raw.headers,
			dependencies
		);
		if (!access.ok) {
			return privateErrorResponse(access.status, access.error);
		}
		const { project, ownerUserId } = access;

		return c.json(
			{
				id: project.id,
				name: project.name,
				previewUrl: isOwnedPreviewKey(project.previewKey, ownerUserId)
					? `/api/projects/${encodeURIComponent(project.id)}/preview`
					: null,
			},
			200,
			privateResponseHeaders
		);
	});

	app.get("/api/projects/:projectId/preview", async (c) => {
		const access = await resolveProjectAccess(
			c.req.param("projectId"),
			c.req.raw.headers,
			dependencies
		);
		if (!access.ok) {
			return privateErrorResponse(access.status, access.error);
		}
		const { project, ownerUserId } = access;

		if (!isOwnedPreviewKey(project.previewKey, ownerUserId)) {
			return privateErrorResponse(404, "Project not found");
		}

		const preview = await dependencies.getPreview(project.previewKey);
		if (!preview) {
			return privateErrorResponse(404, "Project not found");
		}

		return c.body(preview.body, 200, {
			...privateResponseHeaders,
			"content-type": preview.contentType,
			"x-content-type-options": "nosniff",
		});
	});
}
