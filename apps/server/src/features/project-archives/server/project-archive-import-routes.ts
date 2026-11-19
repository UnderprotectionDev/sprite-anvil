import { IdempotencyConflictError } from "@sprite-anvil/api/record-publication";
import type { Hono } from "hono";
import { z } from "zod";
import { serializePublicApiError } from "../../../output-contracts";
import type { createProjectArchiveImportOperations } from "./project-archive-import-operations";

interface ImportDependencies {
	enabled: boolean;
	getSession: (headers: Headers) => Promise<{ user: { id: string } } | null>;
	operations:
		| ReturnType<typeof createProjectArchiveImportOperations>
		| undefined;
}
const projectSchema = z.uuid();
const keySchema = z.string().trim().min(1).max(128);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const nameSchema = z.string().trim().min(1).max(120);
const sizePattern = /^[1-9]\d*$/u;

export function mountProjectArchiveImportRoutes(
	app: Hono,
	dependencies: ImportDependencies
) {
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This boundary validates authentication, headers and upload errors together.
	app.post("/api/projects/:projectId/project-archives/import", async (c) => {
		c.header("Cache-Control", "private, no-store");
		const session = await dependencies.getSession(c.req.raw.headers);
		if (!session?.user) {
			return c.json(serializePublicApiError("Unauthorized"), 401);
		}
		const projectId = projectSchema.safeParse(c.req.param("projectId"));
		if (!projectId.success) {
			return c.json(serializePublicApiError("Not found"), 404);
		}
		if (!(dependencies.operations && dependencies.enabled)) {
			return c.json(
				serializePublicApiError("Project Archive import unavailable"),
				503
			);
		}
		const key = keySchema.safeParse(c.req.header("Idempotency-Key"));
		const shaHeader = c.req.header("X-Project-Archive-SHA256");
		const sha256 =
			shaHeader === undefined ? undefined : digestSchema.safeParse(shaHeader);
		const sizeHeader = c.req.header("X-Project-Archive-Size");
		const byteSize =
			sizeHeader && sizePattern.test(sizeHeader)
				? Number(sizeHeader)
				: Number.NaN;
		let name: unknown;
		try {
			name = decodeURIComponent(c.req.header("X-Project-Archive-Name") ?? "");
		} catch {
			name = null;
		}
		const parsedName = nameSchema.safeParse(name);
		if (
			!(
				key.success &&
				(sha256 === undefined || sha256.success) &&
				parsedName.success &&
				Number.isSafeInteger(byteSize)
			) ||
			byteSize <= 0 ||
			!c.req.raw.body
		) {
			return c.json(
				serializePublicApiError("Invalid Project Archive upload"),
				400
			);
		}
		try {
			const operation = await dependencies.operations.request(session.user.id, {
				projectId: projectId.data,
				idempotencyKey: key.data,
				sha256: sha256?.success ? sha256.data : undefined,
				byteSize,
				name: parsedName.data,
				body: c.req.raw.body,
			});
			if (!operation) {
				return c.json(serializePublicApiError("Not found"), 404);
			}
			return c.json(operation, 202);
		} catch (error) {
			if (error instanceof IdempotencyConflictError) {
				return c.json(
					serializePublicApiError(
						"Project Archive import idempotency conflict"
					),
					409
				);
			}
			return c.json(
				serializePublicApiError("Project Archive import failed"),
				503
			);
		}
	});
}
