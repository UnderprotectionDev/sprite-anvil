import { assetVersionFileNameSchema } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetVersionStore } from "@sprite-anvil/api/asset-versions";
import {
	type UnitVersionCorrectionInput,
	unitVersionCorrectionInputSchema,
} from "@sprite-anvil/api/asset-versions";
import type { Context, Hono } from "hono";
import z from "zod";
import type {
	createStorage,
	TwoDVisualAssetStorage,
} from "../../../cloudflare";
import {
	assetVersionObjectKeySchema,
	createProjectAssetVersionObjectKey,
	twoDVisualAssetUploadContentTypeSchema,
} from "../../../cloudflare";
import {
	serializeAssetVersionUploadResponse,
	serializePublicApiError,
	serializeUnitVersionCorrectionUploadResponse,
} from "../../../output-contracts";
import {
	AssetVersionContentLengthError,
	AssetVersionIntegrityError,
	createAssetVersionIntegrityTransform,
	verifyAssetVersionStream,
} from "./asset-version-integrity";

const projectIdSchema = z.string().min(1).max(200);
const assetRecordIdSchema = z.string().uuid();
const assetVersionIdSchema = z.string().uuid();
const uploadLengthHeader = "x-asset-version-size";
const fileNameHeader = "x-asset-version-file-name";
const idempotencyKeySchema = z.string().trim().min(1).max(128);
const sourceAssetVersionHeader = "x-source-asset-version-id";
const unitVersionTypeHeader = "x-unit-version-type";
const unitVersionKeyHeader = "x-unit-version-key";
const sourceKindHeader = "x-asset-version-source-kind";
const candidateSourceKindSchema = z.enum([
	"manual_import",
	"external_working_file_edit",
]);
const uploadLengthPattern = /^[1-9]\d*$/;

type StoredObject = NonNullable<
	Awaited<ReturnType<ReturnType<typeof createStorage>["get"]>>
>;

export interface AssetVersionSession {
	user: { id: string };
}

export interface AssetVersionRouteDependencies {
	assetVersionStore: AssetVersionStore;
	createId?: () => string;
	createStorage: () => TwoDVisualAssetStorage;
	getProjectForUser: (
		userId: string,
		projectId: string
	) => Promise<{ id: string } | null>;
	getSession: (headers: Headers) => Promise<AssetVersionSession | null>;
}

type ProjectAccess =
	| { ok: true; ownerUserId: string }
	| { ok: false; error: "Unauthorized" | "Not found"; status: 401 | 404 };

async function resolveProjectAccess(
	headers: Headers,
	projectIdInput: string,
	dependencies: AssetVersionRouteDependencies
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
	return { ok: true, ownerUserId: session.user.id };
}

function errorResponse(
	c: Context,
	access: Exclude<ProjectAccess, { ok: true }>
) {
	c.header("Cache-Control", "private, no-store");
	return c.json(serializePublicApiError(access.error), access.status);
}

function parseUploadLength(value: string | undefined) {
	if (!(value && uploadLengthPattern.test(value))) {
		return null;
	}
	const contentLength = Number(value);
	return Number.isSafeInteger(contentLength) ? contentLength : null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Upload validation, storage cleanup, and response mapping stay within one failure boundary.
async function uploadAssetVersion(
	c: Context,
	projectId: string,
	assetRecordId: string,
	ownerUserId: string,
	dependencies: AssetVersionRouteDependencies,
	unitCorrection?: UnitVersionCorrectionInput,
	sourceKind: "manual_import" | "external_working_file_edit" = "manual_import"
) {
	const assetRecord =
		await dependencies.assetVersionStore.getAssetRecordForUpload(
			ownerUserId,
			projectId,
			assetRecordId
		);
	if (!assetRecord) {
		return c.json(serializePublicApiError("Not found"), 404);
	}

	const contentType = twoDVisualAssetUploadContentTypeSchema.safeParse(
		c.req.header("content-type")?.split(";")[0]?.trim()
	);
	if (!contentType.success) {
		return c.json(
			serializePublicApiError("Unsupported Asset Version type"),
			415
		);
	}
	const contentLength = parseUploadLength(c.req.header(uploadLengthHeader));
	if (contentLength === null) {
		return c.json(
			serializePublicApiError("Invalid Asset Version content length"),
			400
		);
	}
	const encodedFileName = c.req.header(fileNameHeader);
	let decodedFileName: string | undefined;
	try {
		decodedFileName = encodedFileName
			? decodeURIComponent(encodedFileName)
			: undefined;
	} catch {
		return c.json(
			serializePublicApiError("Invalid Asset Version file name"),
			400
		);
	}
	const fileName = assetVersionFileNameSchema.safeParse(decodedFileName);
	if (!fileName.success) {
		return c.json(
			serializePublicApiError("Invalid Asset Version file name"),
			400
		);
	}
	const idempotencyKey = idempotencyKeySchema.safeParse(
		c.req.header("idempotency-key")
	);
	if (!idempotencyKey.success) {
		return c.json(
			serializePublicApiError("Missing Asset Version idempotency key"),
			400
		);
	}

	const { body } = c.req.raw;
	if (!body) {
		return c.json(
			serializePublicApiError("Missing Asset Version content"),
			400
		);
	}

	const id = dependencies.createId
		? dependencies.createId()
		: crypto.randomUUID();
	const objectKey = createProjectAssetVersionObjectKey(
		assetRecord.projectId,
		assetRecord.assetRecordId,
		id
	);
	const integrity = createAssetVersionIntegrityTransform(
		contentType.data,
		contentLength
	);

	let storage:
		| ReturnType<AssetVersionRouteDependencies["createStorage"]>
		| undefined;
	let persistenceAttempted = false;
	try {
		storage = dependencies.createStorage();
		await storage.put(
			objectKey,
			body.pipeThrough(integrity.body),
			contentType.data,
			contentLength
		);
		const contentDigest = integrity.getContentDigest();
		if (!contentDigest) {
			throw new AssetVersionIntegrityError();
		}

		persistenceAttempted = true;
		const result = await dependencies.assetVersionStore.createCandidateVersion(
			ownerUserId,
			{
				id,
				...assetRecord,
				objectKey,
				contentType: contentType.data,
				contentLength,
				fileName: fileName.data,
				contentDigest,
				idempotencyKey: idempotencyKey.data,
				integrityVerified: true,
				...(unitCorrection ? { unitCorrection } : {}),
				...(unitCorrection ? {} : { sourceKind }),
			}
		);
		if (!result) {
			await storage.delete(objectKey);
			return c.json(serializePublicApiError("Not found"), 404);
		}
		if (result.kind === "idempotency-conflict") {
			await storage.delete(objectKey);
			return c.json(
				serializePublicApiError("Asset Version idempotency conflict"),
				409
			);
		}
		if (result.kind === "invalid-unit-source") {
			await storage.delete(objectKey);
			return c.json(
				serializePublicApiError("Unit Version source does not match"),
				400
			);
		}
		if (result.kind === "existing") {
			await storage.delete(objectKey);
		}
		if (unitCorrection) {
			return c.json(
				serializeUnitVersionCorrectionUploadResponse(
					result.version,
					result.unitVersion
				),
				result.kind === "created" ? 201 : 200
			);
		}
		return c.json(
			serializeAssetVersionUploadResponse(result.version),
			result.kind === "created" ? 201 : 200
		);
	} catch (error) {
		if (!persistenceAttempted) {
			try {
				if (storage) {
					await storage.delete(objectKey);
				}
			} catch {
				// The upload remains failed closed when storage cleanup is unavailable.
			}
		}
		if (error instanceof AssetVersionContentLengthError) {
			return c.json(
				serializePublicApiError("Invalid Asset Version content length"),
				400
			);
		}
		if (error instanceof AssetVersionIntegrityError) {
			return c.json(
				serializePublicApiError("Invalid Asset Version image content"),
				422
			);
		}
		return c.json(serializePublicApiError("Asset Version upload failed"), 503);
	}
}

async function handleAssetVersionUploadRequest(
	c: Context,
	dependencies: AssetVersionRouteDependencies,
	unitCorrectionRequired: boolean
) {
	c.header("Cache-Control", "private, no-store");
	const projectIdInput = c.req.param("projectId") ?? "";
	const access = await resolveProjectAccess(
		c.req.raw.headers,
		projectIdInput,
		dependencies
	);
	if (!access.ok) {
		return errorResponse(c, access);
	}
	const projectId = projectIdSchema.parse(projectIdInput);

	const parsedAssetRecordId = assetRecordIdSchema.safeParse(
		c.req.param("assetRecordId")
	);
	if (!parsedAssetRecordId.success) {
		return c.json(serializePublicApiError("Not found"), 404);
	}

	let unitCorrection: UnitVersionCorrectionInput | undefined;
	let sourceKind: "manual_import" | "external_working_file_edit" =
		"manual_import";
	if (unitCorrectionRequired) {
		if (c.req.header(sourceKindHeader) !== undefined) {
			return c.json(
				serializePublicApiError("Invalid Asset Version source kind"),
				400
			);
		}
		const parsedCorrection = unitVersionCorrectionInputSchema.safeParse({
			sourceAssetVersionId: c.req.header(sourceAssetVersionHeader),
			unitType: c.req.header(unitVersionTypeHeader),
			unitKey: c.req.header(unitVersionKeyHeader),
		});
		if (!parsedCorrection.success) {
			return c.json(
				serializePublicApiError("Invalid Unit Version correction"),
				400
			);
		}
		unitCorrection = parsedCorrection.data;
	} else {
		const parsedSourceKind = candidateSourceKindSchema.safeParse(
			c.req.header(sourceKindHeader) ?? "manual_import"
		);
		if (!parsedSourceKind.success) {
			return c.json(
				serializePublicApiError("Invalid Asset Version source kind"),
				400
			);
		}
		sourceKind = parsedSourceKind.data;
	}

	return uploadAssetVersion(
		c,
		projectId,
		parsedAssetRecordId.data,
		access.ownerUserId,
		dependencies,
		unitCorrection,
		sourceKind
	);
}

async function assetVersionPreviewResponse(
	c: Context,
	object: StoredObject | null,
	contentType: "image/png" | "image/webp",
	contentLength: number,
	contentDigest: string | null,
	integrityVerified: boolean
) {
	c.header("Cache-Control", "private, no-store");
	if (!object) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	if (
		object.contentType !== contentType ||
		(object.contentLength !== undefined &&
			object.contentLength !== contentLength) ||
		!integrityVerified ||
		!contentDigest
	) {
		await object.body.cancel();
		return c.json(
			serializePublicApiError("Asset Version integrity check failed"),
			502
		);
	}

	c.header("X-Content-Type-Options", "nosniff");
	const verifiedObject = verifyAssetVersionStream(
		object.body,
		contentType,
		contentLength,
		contentDigest
	);
	return c.body(verifiedObject.body, 200, {
		"Content-Type": contentType,
		"Content-Length": contentLength.toString(),
	});
}

export function mountAssetVersionRoutes(
	app: Hono,
	dependencies: AssetVersionRouteDependencies
) {
	app.post(
		"/api/projects/:projectId/asset-records/:assetRecordId/versions",
		(c) => handleAssetVersionUploadRequest(c, dependencies, false)
	);

	app.post(
		"/api/projects/:projectId/asset-records/:assetRecordId/unit-versions",
		(c) => handleAssetVersionUploadRequest(c, dependencies, true)
	);

	app.get(
		"/api/projects/:projectId/asset-versions/:assetVersionId/preview",
		async (c) => {
			c.header("Cache-Control", "private, no-store");
			const access = await resolveProjectAccess(
				c.req.raw.headers,
				c.req.param("projectId"),
				dependencies
			);
			if (!access.ok) {
				return errorResponse(c, access);
			}

			const assetVersionId = assetVersionIdSchema.safeParse(
				c.req.param("assetVersionId")
			);
			if (!assetVersionId.success) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			const fileRecord = await dependencies.assetVersionStore.getFileRecord(
				access.ownerUserId,
				c.req.param("projectId"),
				assetVersionId.data
			);
			if (!fileRecord) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			const objectKey = assetVersionObjectKeySchema.parse(fileRecord.objectKey);
			const object = await dependencies.createStorage().get(objectKey);
			return assetVersionPreviewResponse(
				c,
				object,
				fileRecord.contentType,
				fileRecord.contentLength,
				fileRecord.contentDigest,
				fileRecord.integrityVerified
			);
		}
	);
}
