import { createHash } from "node:crypto";
import type {
	AssetVersionFileRecord,
	AssetVersionStore,
} from "@sprite-anvil/api/asset-versions";
import type { OfflineConflictStore } from "@sprite-anvil/api/offline-conflict";
import type {
	PixelDraftRecord,
	PixelDraftUpdateResult,
	PixelEditorStore,
	pixelEditorErrorSchema,
} from "@sprite-anvil/api/pixel-editor";
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

/**
 * Transport-free request model shared by the Working Draft and frame
 * structure behavior modules. Behavior returns an Outcome; the Hono adapters
 * in pixel-editor-http.ts turn it into a response.
 */

export const draftIdSchema = z.string().uuid();

export interface PixelEditorSession {
	user: { id: string };
}

/** What loading and storing a Working Draft needs; no session or project lookup. */
export interface DraftDependencies {
	assetVersionStore: Pick<
		AssetVersionStore,
		"createCandidateVersion" | "createCompositeVersion" | "getFileRecord"
	>;
	createId?: () => string;
	createStorage: () => TwoDVisualAssetStorage;
	offlineConflictStore: OfflineConflictStore;
	pixelEditorStore: PixelEditorStore;
}

export interface PixelEditorRouteDependencies extends DraftDependencies {
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<PixelEditorSession | null>;
}

export type ErrorName = z.infer<typeof pixelEditorErrorSchema>["error"];
export type ErrorStatus = 400 | 401 | 404 | 409 | 422 | 502 | 503;

export interface ProjectAccess {
	projectId: string;
	userId: string;
}

export type Access =
	| ({ ok: true } & ProjectAccess)
	| { error: ErrorName; ok: false; status: 401 | 404 };

export interface Failure {
	detail?: string;
	error: ErrorName;
	ok: false;
	status: ErrorStatus;
}

export type Outcome<T> = Failure | { ok: true; status: 200 | 201; value: T };

export function failure(
	error: ErrorName,
	status: ErrorStatus,
	detail?: string
): Failure {
	return { ok: false, error, status, ...(detail ? { detail } : {}) };
}

export function success<T>(value: T, status: 200 | 201 = 200): Outcome<T> {
	return { ok: true, status, value };
}

/**
 * Maps a frame structure rule failure to its error; null for other errors.
 * `operationError` names the failure of a rule that is neither a slicing nor a
 * protection rule, which differs between sheet pixel edits and frame edits.
 */
export function structureFailure(
	error: unknown,
	operationError: ErrorName = "Invalid frame operation"
): Failure | null {
	if (!(error instanceof SheetStructureError)) {
		return null;
	}
	switch (error.kind) {
		case "slicing":
			return failure("Invalid slicing parameters", 422, error.message);
		case "protected":
			return failure("Protected frame", 409, error.message);
		default:
			return failure(operationError, 422, error.message);
	}
}

export function updateFailure(
	result: PixelDraftUpdateResult | null
): Failure | null {
	if (!result) {
		return failure("Not found", 404);
	}
	if (result.kind === "conflict") {
		return failure("Working Draft revision conflict", 409);
	}
	if (result.kind === "not-open") {
		return failure("Working Draft is not open", 409);
	}
	return null;
}

/** Who is acting on which project, and through which services. */
export interface Scope {
	access: ProjectAccess;
	dependencies: DraftDependencies;
}

export function newId(dependencies: DraftDependencies) {
	return dependencies.createId ? dependencies.createId() : crypto.randomUUID();
}

export async function readSourceRaster(
	dependencies: DraftDependencies,
	file: AssetVersionFileRecord
): Promise<Raster | null> {
	if (!(file.integrityVerified && file.contentDigest)) {
		return null;
	}
	const object = await dependencies.createStorage().get(file.objectKey);
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

/** A Working Draft read once, with its source and replayed raster, plus who is acting on it. */
export interface DraftContext extends Scope {
	applied: Raster;
	clipboard: EditState["clipboard"];
	draft: PixelDraftRecord;
	source: Raster;
	sourceFile: AssetVersionFileRecord;
}

export async function loadDraft(
	scope: Scope,
	draftIdInput: string
): Promise<Outcome<DraftContext>> {
	const { access, dependencies } = scope;
	const draftId = draftIdSchema.safeParse(draftIdInput);
	if (!draftId.success) {
		return failure("Not found", 404);
	}
	const draft = await dependencies.pixelEditorStore.getDraft(
		access.userId,
		access.projectId,
		draftId.data
	);
	if (!draft) {
		return failure("Not found", 404);
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
		return failure("Source Asset Version image unavailable", 502);
	}
	try {
		const { raster: applied, clipboard } = replayOperations(
			source,
			draft.operations.slice(0, draft.appliedOperationCount)
		);
		return success({
			...scope,
			applied,
			clipboard,
			draft,
			source,
			sourceFile,
		});
	} catch (error) {
		if (error instanceof PixelOperationError) {
			return failure("Invalid pixel operation", 422, error.message);
		}
		throw error;
	}
}
