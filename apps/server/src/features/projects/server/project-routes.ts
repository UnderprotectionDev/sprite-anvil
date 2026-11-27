import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { ProjectRecord as ProjectAccessRecord } from "@sprite-anvil/api/project-access-store";
import { projectRecordResponseSchema } from "@sprite-anvil/api/project-access-store";
import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import { projectContextCreateInputSchema } from "@sprite-anvil/api/project-context";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import sharp from "sharp";
import z from "zod";
import type {
	CloudflareConfig,
	createQueue,
	createStorage,
} from "../../../cloudflare";
import {
	createProjectTwoDVisualAssetKey,
	legacyAssetKeySchema,
	twoDVisualAssetUploadContentTypeSchema,
} from "../../../cloudflare";
import {
	serializeProjectSummaryResponse,
	serializePublicApiError,
	serializeTwoDVisualAssetAcceptedResponse,
} from "../../../output-contracts";

const projectIdSchema = z.string().min(1).max(200);
const twoDVisualAssetIdSchema = z.uuid();

type StoredObject = NonNullable<
	Awaited<ReturnType<ReturnType<typeof createStorage>["get"]>>
>;

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
	cloudflareConfig: () => CloudflareConfig;
	createId?: () => string;
	createPreviewStorage?: () => Pick<
		ReturnType<typeof createStorage>,
		"delete" | "get" | "put"
	>;
	createProjectWithLook?: (
		ownerId: string,
		input: ProjectContextCreateInput,
		key: string,
		requestId: string
	) => Promise<ProjectAccessRecord>;
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
	setPreviewKey?: (
		ownerId: string,
		projectId: string,
		key: string
	) => Promise<boolean>;
}

type ProjectAccess =
	| { ok: true; project: ProjectRecord; ownerUserId: string }
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

	return { ok: true, project, ownerUserId: session.user.id };
}

function isOwnedLegacyPreviewKey(
	key: string | null,
	ownerUserId: string
): key is string {
	return (
		key !== null &&
		legacyAssetKeySchema.safeParse(key).success &&
		key.startsWith(`users/${ownerUserId}/`)
	);
}

function errorResponse(
	c: Context,
	access: Exclude<ProjectAccess, { ok: true }>
) {
	c.header("Cache-Control", "private, no-store");
	return c.json(serializePublicApiError(access.error), access.status);
}

async function twoDVisualAssetPreviewResponse(
	c: Context,
	object: StoredObject | null
) {
	c.header("Cache-Control", "private, no-store");
	if (!object) {
		return c.json(serializePublicApiError("Not found"), 404);
	}
	if (
		object.contentType !== "image/png" &&
		object.contentType !== "image/webp"
	) {
		await object.body.cancel();
		return c.json(serializePublicApiError("Not found"), 404);
	}

	c.header("X-Content-Type-Options", "nosniff");
	const headers: Record<string, string> = {
		"Content-Type": object.contentType,
	};
	if (object.contentLength !== undefined) {
		headers["Content-Length"] = object.contentLength.toString();
	}
	return c.body(object.body, 200, headers);
}

async function decodeProjectLook(c: Context): Promise<
	| { png: Buffer }
	| {
			error: "Unsupported image type" | "Invalid project image";
			status: 415 | 400;
	  }
> {
	const contentType = c.req.header("content-type")?.split(";")[0];
	if (!["image/png", "image/jpeg", "image/webp"].includes(contentType ?? "")) {
		return { error: "Unsupported image type", status: 415 } as const;
	}
	try {
		const decoder = sharp(await c.req.arrayBuffer(), {
			limitInputPixels: 16_000_000,
			failOn: "warning",
		});
		const metadata = await decoder.metadata();
		if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) {
			return { error: "Invalid project image", status: 400 } as const;
		}
		return { png: await decoder.autoOrient().png().toBuffer() } as const;
	} catch {
		return { error: "Invalid project image", status: 400 } as const;
	}
}

async function removePreviousProjectLook(
	storage: Pick<ReturnType<typeof createStorage>, "delete">,
	access: Extract<ProjectAccess, { ok: true }>,
	key: string
) {
	const oldKey = access.project.previewKey;
	if (
		isOwnedLegacyPreviewKey(oldKey, access.ownerUserId) &&
		oldKey.startsWith(`users/${access.ownerUserId}/project-look-`) &&
		oldKey !== key
	) {
		await storage.delete(oldKey).catch(() => undefined);
	}
}

function readProjectMetadata(c: Context) {
	try {
		return projectContextCreateInputSchema.safeParse({
			name: decodeURIComponent(c.req.header("X-Project-Name") ?? ""),
			generalArtDirection: decodeURIComponent(
				c.req.header("X-Project-Art-Direction") ?? ""
			),
		});
	} catch {
		return null;
	}
}

async function createProjectWithLook(
	c: Context,
	dependencies: ProjectRouteDependencies
) {
	c.header("Cache-Control", "private, no-store");
	const session = await dependencies.getSession(c.req.raw.headers);
	if (!session?.user) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	if (!dependencies.createProjectWithLook) {
		return c.json({ error: "Project preview upload unavailable" }, 503);
	}
	const metadata = readProjectMetadata(c);
	if (!metadata?.success) {
		return c.json({ error: "Invalid project metadata" }, 400);
	}
	const decoded = await decodeProjectLook(c);
	if ("error" in decoded) {
		return c.json(serializePublicApiError(decoded.error), decoded.status);
	}
	const requestId = z
		.uuid()
		.safeParse(c.req.header("X-Project-Id") ?? crypto.randomUUID());
	if (!requestId.success) {
		return c.json({ error: "Invalid project creation identity" }, 400);
	}
	const digest = createHash("sha256").update(decoded.png).digest("hex");
	const key = legacyAssetKeySchema.parse(
		`users/${session.user.id}/project-look-${requestId.data}-${digest}.png`
	);

	const storage =
		dependencies.createPreviewStorage?.() ??
		dependencies.createStorage(dependencies.cloudflareConfig());
	try {
		await storage.put(
			key,
			new Blob([new Uint8Array(decoded.png)]).stream(),
			"image/png",
			decoded.png.byteLength
		);
	} catch {
		return c.json({ error: "Project look could not be saved" }, 503);
	}
	try {
		const record = await dependencies.createProjectWithLook(
			session.user.id,
			metadata.data,
			key,
			requestId.data
		);
		return c.json(projectRecordResponseSchema.parse(record), 201);
	} catch (error) {
		if (error instanceof ORPCError && error.code === "CONFLICT") {
			const existing = await dependencies
				.getProjectForUser(session.user.id, requestId.data)
				.catch(() => undefined);
			if (existing !== undefined && existing?.previewKey !== key) {
				await storage.delete(key).catch(() => undefined);
			}
			return c.json({ error: "A project with this name already exists." }, 409);
		}
		// Publication is ambiguous: do not delete bytes which a committed project may reference.
		return c.json({ error: "Project creation outcome is unknown." }, 503);
	}
}

export function mountProjectRoutes(
	app: Hono,
	dependencies: ProjectRouteDependencies
) {
	app.post(
		"/api/projects/with-look",
		bodyLimit({ maxSize: 16 * 1024 * 1024 }),
		(c) => createProjectWithLook(c, dependencies)
	);

	app.get("/api/projects/:projectId", async (c) => {
		c.header("Cache-Control", "private, no-store");
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return errorResponse(c, access);
		}

		const previewUrl = isOwnedLegacyPreviewKey(
			access.project.previewKey,
			access.ownerUserId
		)
			? `/api/projects/${encodeURIComponent(access.project.id)}/preview`
			: null;
		return c.json(
			serializeProjectSummaryResponse({ ...access.project, previewUrl })
		);
	});

	app.post("/api/projects/:projectId/2d-visual-assets", async (c) => {
		c.header("Cache-Control", "private, no-store");
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return errorResponse(c, access);
		}

		const contentType = twoDVisualAssetUploadContentTypeSchema.safeParse(
			c.req.header("content-type")?.split(";")[0]?.trim()
		);
		if (!contentType.success) {
			return c.json(
				serializePublicApiError("Unsupported 2D Visual Asset type"),
				415
			);
		}

		const { body } = c.req.raw;
		if (!body) {
			return c.json(
				serializePublicApiError("Missing 2D Visual Asset content"),
				400
			);
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
			return c.json(
				serializePublicApiError("Invalid 2D Visual Asset content length"),
				400
			);
		}

		const twoDVisualAssetId = dependencies.createId?.() ?? crypto.randomUUID();
		const acceptedResponse =
			serializeTwoDVisualAssetAcceptedResponse(twoDVisualAssetId);
		const key = createProjectTwoDVisualAssetKey(
			access.project.id,
			twoDVisualAssetId
		);

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
			return c.json(
				serializePublicApiError("2D Visual Asset upload failed"),
				503
			);
		}

		return c.json(acceptedResponse, 201);
	});

	app.get(
		"/api/projects/:projectId/2d-visual-assets/:twoDVisualAssetId/preview",
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

			const twoDVisualAssetId = twoDVisualAssetIdSchema.safeParse(
				c.req.param("twoDVisualAssetId")
			);
			if (!twoDVisualAssetId.success) {
				return c.json(serializePublicApiError("Not found"), 404);
			}

			const object = await dependencies
				.createStorage(dependencies.cloudflareConfig())
				.get(
					createProjectTwoDVisualAssetKey(
						access.project.id,
						twoDVisualAssetId.data
					)
				);
			return twoDVisualAssetPreviewResponse(c, object);
		}
	);

	app.post(
		"/api/projects/:projectId/preview",
		bodyLimit({ maxSize: 16 * 1024 * 1024 }),
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
			if (!dependencies.setPreviewKey) {
				return c.json(
					serializePublicApiError("Project preview upload unavailable"),
					503
				);
			}
			const decoded = await decodeProjectLook(c);
			if ("error" in decoded) {
				return c.json(serializePublicApiError(decoded.error), decoded.status);
			}
			const { png } = decoded;
			const key = legacyAssetKeySchema.parse(
				`users/${access.ownerUserId}/project-look-${dependencies.createId?.() ?? crypto.randomUUID()}.png`
			);
			const storage =
				dependencies.createPreviewStorage?.() ??
				dependencies.createStorage(dependencies.cloudflareConfig());
			try {
				await storage.put(
					key,
					new Blob([new Uint8Array(png)]).stream(),
					"image/png",
					png.byteLength
				);
				if (
					!(await dependencies.setPreviewKey(
						access.ownerUserId,
						access.project.id,
						key
					))
				) {
					await storage.delete(key);
					return c.json(serializePublicApiError("Not found"), 404);
				}
			} catch {
				// A database response can be ambiguous; re-read before removing a stored object.
				const current = await dependencies
					.getProjectForUser(access.ownerUserId, access.project.id)
					.catch(() => undefined);
				if (current?.previewKey === key) {
					return c.json({ saved: true });
				}
				if (current !== undefined) {
					await storage.delete(key).catch(() => undefined);
				}
				return c.json(
					serializePublicApiError("Project look could not be saved"),
					503
				);
			}
			await removePreviousProjectLook(storage, access, key);
			return c.json({ saved: true });
		}
	);

	app.get("/api/projects/:projectId/preview", async (c) => {
		c.header("Cache-Control", "private, no-store");
		const access = await resolveProjectAccess(
			c.req.raw.headers,
			c.req.param("projectId"),
			dependencies
		);
		if (!access.ok) {
			return errorResponse(c, access);
		}
		if (
			!isOwnedLegacyPreviewKey(access.project.previewKey, access.ownerUserId)
		) {
			return c.json(serializePublicApiError("Not found"), 404);
		}

		const storage =
			dependencies.createPreviewStorage?.() ??
			dependencies.createStorage(dependencies.cloudflareConfig());
		const object = await storage.get(access.project.previewKey);
		return twoDVisualAssetPreviewResponse(c, object);
	});
}
