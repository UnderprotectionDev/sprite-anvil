import { createHash } from "node:crypto";
import type {
	AssetVersionFileRecord,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import {
	type PixelDraftRecord,
	type PixelEditorStore,
	pixelEditorErrorSchema,
} from "@sprite-anvil/api/pixel-editor";
import type { Context } from "hono";
import z from "zod";
import type { TwoDVisualAssetStorage } from "../../../cloudflare";
import {
	applyOperations,
	PixelOperationError,
	type Raster,
} from "./pixel-operations";
import { readRasterFromPng } from "./pixel-raster-codec";

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
		const applied = applyOperations(
			source,
			draft.operations.slice(0, draft.appliedOperationCount)
		);
		return { applied, draft, source, sourceFile };
	} catch (error) {
		if (error instanceof PixelOperationError) {
			return fail(c, "Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
}
