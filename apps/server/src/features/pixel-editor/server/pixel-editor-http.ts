import { createHash } from "node:crypto";
import type {
	AssetVersionFileRecord,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import {
	type PixelDraftRecord,
	type PixelDraftUpdateResult,
	type PixelEditorStore,
	pixelEditorErrorSchema,
} from "@sprite-anvil/api/pixel-editor";
import type { Context } from "hono";
import z from "zod";
import type { TwoDVisualAssetStorage } from "../../../cloudflare";
import {
	type EditState,
	PixelOperationError,
	type Raster,
	replayOperations,
} from "./pixel-operations";
import { readRasterFromPng } from "./pixel-raster-codec";
import { SheetStructureError } from "./sheet-structure";

const projectIdSchema = z.string().min(1).max(200);
export const draftIdSchema = z.string().uuid();

export interface PixelEditorSession {
	user: { id: string };
}

export interface PixelEditorRouteDependencies {
	assetVersionStore: Pick<
		AssetVersionStore,
		"createCandidateVersion" | "createCompositeVersion" | "getFileRecord"
	>;
	createId?: () => string;
	createStorage: () => TwoDVisualAssetStorage;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<PixelEditorSession | null>;
	pixelEditorStore: PixelEditorStore;
}

export type ErrorName = z.infer<typeof pixelEditorErrorSchema>["error"];
export type ErrorStatus = 400 | 401 | 404 | 409 | 422 | 502 | 503;

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
	body: unknown,
	status: 200 | 201 = 200
) {
	c.header("Cache-Control", "private, no-store");
	return c.json(body as never, status);
}

/**
 * Maps a frame structure rule failure to its HTTP error; null for other
 * errors. `operationError` names the failure of a rule that is neither a
 * slicing nor a protection rule, which differs between sheet pixel edits and
 * frame edits.
 */
export function structureFailure(
	c: Context,
	error: unknown,
	operationError: ErrorName = "Invalid frame operation"
) {
	if (!(error instanceof SheetStructureError)) {
		return null;
	}
	switch (error.kind) {
		case "slicing":
			return fail(c, "Invalid slicing parameters", 422, error.message);
		case "protected":
			return fail(c, "Protected frame", 409, error.message);
		default:
			return fail(c, operationError, 422, error.message);
	}
}

export function mapUpdateFailure(
	c: Context,
	result: PixelDraftUpdateResult | null
) {
	if (!result) {
		return fail(c, "Not found", 404);
	}
	if (result.kind === "conflict") {
		return fail(c, "Working Draft revision conflict", 409);
	}
	if (result.kind === "not-open") {
		return fail(c, "Working Draft is not open", 409);
	}
	return null;
}

export type Access =
	| { ok: true; projectId: string; userId: string }
	| { ok: false; error: ErrorName; status: 401 | 404 };

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

export async function readSourceRaster(
	dependencies: PixelEditorRouteDependencies,
	file: AssetVersionFileRecord
): Promise<Raster | null> {
	if (!(file.integrityVerified && file.contentDigest)) {
		return null;
	}
	const object = await dependencies
		.createStorage()
		.get(file.objectKey as never);
	if (!object) {
		return null;
	}
	const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
	const digest = createHash("sha256").update(bytes).digest("hex");
	if (
		bytes.byteLength !== file.contentLength ||
		digest !== file.contentDigest
	) {
		return null;
	}
	try {
		return await readRasterFromPng(bytes);
	} catch {
		return null;
	}
}

export interface LoadedDraft {
	applied: Raster;
	clipboard: EditState["clipboard"];
	draft: PixelDraftRecord;
	source: Raster;
	sourceFile: AssetVersionFileRecord;
}

export async function loadDraft(
	c: Context,
	access: Extract<Access, { ok: true }>,
	dependencies: PixelEditorRouteDependencies,
	draftIdInput = c.req.param("draftId")
): Promise<LoadedDraft | Response> {
	const draftId = draftIdSchema.safeParse(draftIdInput);
	if (!draftId.success) {
		return fail(c, "Not found", 404);
	}
	const draft = await dependencies.pixelEditorStore.getDraft(
		access.userId,
		access.projectId,
		draftId.data
	);
	if (!draft) {
		return fail(c, "Not found", 404);
	}
	const sourceFile = await dependencies.assetVersionStore.getFileRecord(
		access.userId,
		access.projectId,
		draft.sourceAssetVersionId
	);
	const source = sourceFile
		? await readSourceRaster(dependencies, sourceFile)
		: null;
	if (!(sourceFile && source)) {
		return fail(c, "Source Asset Version image unavailable", 502);
	}
	try {
		const { raster: applied, clipboard } = replayOperations(
			source,
			draft.operations.slice(0, draft.appliedOperationCount)
		);
		return { applied, clipboard, draft, source, sourceFile };
	} catch (error) {
		if (error instanceof PixelOperationError) {
			return fail(c, "Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
}
