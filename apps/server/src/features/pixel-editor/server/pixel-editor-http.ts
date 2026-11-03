import { pixelEditorErrorSchema } from "@sprite-anvil/api/pixel-editor";
import type { Context } from "hono";
import type { JSONValue } from "hono/utils/types";
import z from "zod";
import type {
	Access,
	ErrorName,
	ErrorStatus,
	Outcome,
	PixelEditorRouteDependencies,
	Scope,
} from "./pixel-editor-context";

/** Hono adapters: session and project access, JSON bodies and response mapping. */

const projectIdSchema = z.string().min(1).max(200);

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

/** JSON response that must never be cached: Working Draft state is private and mutable. */
export function noStoreJson(
	c: Context,
	body: JSONValue,
	status: 200 | 201 = 200
) {
	return c.body(JSON.stringify(body), status, {
		"Cache-Control": "private, no-store",
		"Content-Type": "application/json",
	});
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

export async function readJson(c: Context): Promise<unknown> {
	try {
		return await c.req.json();
	} catch {
		return null;
	}
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

/** Runs a behavior function for an authorised request and maps its Outcome to JSON. */
export async function handleJson<T extends JSONValue>(
	c: Context,
	dependencies: PixelEditorRouteDependencies,
	run: (scope: Scope) => Promise<Outcome<T>>
) {
	const outcome = await runScoped(c, dependencies, run);
	return outcome.ok
		? noStoreJson(c, outcome.value, outcome.status)
		: fail(c, outcome.error, outcome.status, outcome.detail);
}

/** Same as handleJson for a PNG body. */
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
