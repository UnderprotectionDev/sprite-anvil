import { pixelEditorErrorSchema } from "@sprite-anvil/api/pixel-editor";
import { projectIdSchema } from "@sprite-anvil/api/project-id";
import type { Context } from "hono";
import type {
	Access,
	ErrorName,
	ErrorStatus,
	Outcome,
	PixelEditorRouteDependencies,
	Scope,
} from "./pixel-editor-context";

/** Hono previews share the same session and project access checks. */

export function fail(
	c: Context,
	error: ErrorName,
	status: ErrorStatus,
	detail?: string
) {
	c.header("Cache-Control", "private, no-store");
	return c.json(
		pixelEditorErrorSchema.parse({ error, ...(detail ? { detail } : {}) }),
		status
	);
}

export async function resolveAccess(
	c: Context,
	dependencies: PixelEditorRouteDependencies
): Promise<Access> {
	const session = await dependencies.getSession(c.req.raw.headers);
	if (!session?.user) {
		return { ok: false, error: "Unauthorized", status: 401 };
	}
	const projectId = projectIdSchema.safeParse(c.req.param("projectId"));
	if (!projectId.success) {
		return { ok: false, error: "Not found", status: 404 };
	}
	const project = await dependencies.getProjectForUser(
		session.user.id,
		projectId.data
	);
	if (!project) {
		return { ok: false, error: "Not found", status: 404 };
	}
	return { ok: true, projectId: projectId.data, userId: session.user.id };
}

async function runScoped<T>(
	c: Context,
	dependencies: PixelEditorRouteDependencies,
	run: (scope: Scope) => Promise<Outcome<T>>
): Promise<Outcome<T>> {
	const access = await resolveAccess(c, dependencies);
	if (!access.ok) {
		return access;
	}
	return run({
		access: { projectId: access.projectId, userId: access.userId },
		dependencies,
	});
}

/** Serves a private PNG after verifying the session and project scope. */
export async function handlePng(
	c: Context,
	dependencies: PixelEditorRouteDependencies,
	run: (scope: Scope) => Promise<Outcome<Uint8Array<ArrayBuffer>>>
) {
	const outcome = await runScoped(c, dependencies, run);
	if (!outcome.ok) {
		return fail(c, outcome.error, outcome.status, outcome.detail);
	}
	return c.body(outcome.value, 200, {
		"Cache-Control": "private, no-store",
		"Content-Type": "image/png",
		"X-Content-Type-Options": "nosniff",
	});
}
