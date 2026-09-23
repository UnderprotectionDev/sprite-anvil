import type { Hono } from "hono";

import {
	assetReadySchema,
	assetUploadSchema,
	type CloudflareConfig,
	type createQueue,
	type createStorage,
} from "./cloudflare";

async function readJsonBody(request: Request) {
	try {
		return { ok: true as const, value: await request.json() };
	} catch {
		return { ok: false as const };
	}
}

export interface AssetSession {
	user: { id: string };
}

export interface AssetRouteDependencies {
	cloudflareConfig: () => CloudflareConfig;
	createQueue: (
		config: CloudflareConfig
	) => Pick<ReturnType<typeof createQueue>, "send">;
	createStorage: (
		config: CloudflareConfig
	) => Pick<ReturnType<typeof createStorage>, "exists" | "signUpload">;
	getSession: (headers: Headers) => Promise<AssetSession | null>;
}

export function mountAssetRoutes(
	app: Hono,
	dependencies: AssetRouteDependencies
) {
	app.post("/api/assets/upload-url", async (c) => {
		const session = await dependencies.getSession(c.req.raw.headers);
		if (!session?.user) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const body = await readJsonBody(c.req.raw);
		if (!body.ok) {
			return c.json({ error: "Invalid upload request" }, 400);
		}
		const input = assetUploadSchema.safeParse(body.value);
		if (!input.success) {
			return c.json({ error: "Invalid upload request" }, 400);
		}
		return c.json(
			await dependencies
				.createStorage(dependencies.cloudflareConfig())
				.signUpload(session.user.id, input.data.contentType)
		);
	});

	app.post("/api/assets/complete", async (c) => {
		const session = await dependencies.getSession(c.req.raw.headers);
		if (!session?.user) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		const body = await readJsonBody(c.req.raw);
		if (!body.ok) {
			return c.json({ error: "Invalid asset key" }, 400);
		}
		const input = assetReadySchema.safeParse(body.value);
		if (
			!(input.success && input.data.key.startsWith(`users/${session.user.id}/`))
		) {
			return c.json({ error: "Invalid asset key" }, 400);
		}
		const config = dependencies.cloudflareConfig();
		await dependencies.createStorage(config).exists(input.data.key);
		await dependencies.createQueue(config).send(input.data.key);
		return c.json({ queued: true });
	});
}
