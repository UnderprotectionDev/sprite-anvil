import { Readable } from "node:stream";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import z from "zod";

const uuidPattern =
	"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const projectKeySegmentPattern = "(?:[A-Za-z0-9_.!~*'()-]|%[0-9A-F]{2})+";

export const twoDVisualAssetUploadContentTypeSchema = z.enum([
	"image/png",
	"image/webp",
]);

export const twoDVisualAssetKeySchema = z
	.string()
	.regex(
		new RegExp(
			`^projects/${projectKeySegmentPattern}/2d-visual-assets/${uuidPattern}$`
		)
	);

export const assetVersionObjectKeySchema = z
	.string()
	.regex(
		new RegExp(
			`^projects/${projectKeySegmentPattern}/asset-records/${uuidPattern}/versions/${uuidPattern}$`
		)
	);

export const legacyAssetKeySchema = z
	.string()
	.regex(/^users\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.(png|webp)$/);

export function createProjectTwoDVisualAssetKey(
	projectId: string,
	twoDVisualAssetId: string
) {
	const projectKeySegment = encodeURIComponent(projectId);
	return twoDVisualAssetKeySchema.parse(
		`projects/${projectKeySegment}/2d-visual-assets/${twoDVisualAssetId}`
	);
}

export function createProjectAssetVersionObjectKey(
	projectId: string,
	assetRecordId: string,
	assetVersionId: string
) {
	const projectKeySegment = encodeURIComponent(projectId);
	return assetVersionObjectKeySchema.parse(
		`projects/${projectKeySegment}/asset-records/${assetRecordId}/versions/${assetVersionId}`
	);
}

const legacyQueueMessageSchema = z
	.object({
		version: z.literal(1),
		kind: z.literal("asset-uploaded"),
		key: legacyAssetKeySchema,
	})
	.strict();

const projectQueueMessageSchema = z
	.object({
		version: z.literal(2),
		kind: z.literal("2d-visual-asset-uploaded"),
		key: twoDVisualAssetKeySchema,
	})
	.strict();

export function serializeProjectQueueMessage(key: string) {
	return projectQueueMessageSchema.parse({
		version: 2,
		kind: "2d-visual-asset-uploaded",
		key,
	});
}

export const queueMessageSchema = z.discriminatedUnion("version", [
	legacyQueueMessageSchema,
	projectQueueMessageSchema,
]);

export interface R2Config {
	CLOUDFLARE_ACCOUNT_ID: string;
	R2_ACCESS_KEY_ID: string;
	R2_BUCKET: string;
	R2_SECRET_ACCESS_KEY: string;
	S3_API?: string;
}

export interface CloudflareQueueConfig {
	CLOUDFLARE_ACCOUNT_ID: string;
	CLOUDFLARE_QUEUE_ID: string;
	CLOUDFLARE_QUEUES_TOKEN: string;
}

export interface CloudflareConfig extends R2Config, CloudflareQueueConfig {}

type R2ConfigInput = Partial<R2Config> & { R2_ACCOUNT_ID?: string };

export function requireR2Config(config: R2ConfigInput): R2Config {
	const accountId = config.R2_ACCOUNT_ID ?? config.CLOUDFLARE_ACCOUNT_ID;
	const parsed = z
		.object({
			CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
			S3_API: z.url().optional(),
			R2_ACCESS_KEY_ID: z.string().min(1),
			R2_SECRET_ACCESS_KEY: z.string().min(1),
			R2_BUCKET: z.string().min(1),
		})
		.parse({
			CLOUDFLARE_ACCOUNT_ID: accountId,
			S3_API: config.S3_API,
			R2_ACCESS_KEY_ID: config.R2_ACCESS_KEY_ID,
			R2_SECRET_ACCESS_KEY: config.R2_SECRET_ACCESS_KEY,
			R2_BUCKET: config.R2_BUCKET,
		});
	if (parsed.S3_API) {
		const endpoint = new URL(parsed.S3_API);
		if (
			endpoint.protocol !== "https:" ||
			endpoint.hostname !==
				`${parsed.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com` ||
			endpoint.username ||
			endpoint.password ||
			(endpoint.pathname !== "" && endpoint.pathname !== "/") ||
			endpoint.search ||
			endpoint.hash
		) {
			throw new Error("S3_API must be the HTTPS R2 endpoint for R2_ACCOUNT_ID");
		}
	}
	return parsed;
}

export function requireCloudflareConfig(
	config: Partial<CloudflareConfig> & { R2_ACCOUNT_ID?: string }
): CloudflareConfig {
	const r2 = requireR2Config(config);
	const queues = z
		.object({
			CLOUDFLARE_QUEUE_ID: z.string().min(1),
			CLOUDFLARE_QUEUES_TOKEN: z.string().min(1),
		})
		.parse(config);
	return { ...r2, ...queues, CLOUDFLARE_ACCOUNT_ID: r2.CLOUDFLARE_ACCOUNT_ID };
}

export function createStorage(
	config: R2Config,
	endpoint = config.S3_API ??
		`https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
) {
	const client = new S3Client({
		region: "auto",
		endpoint,
		credentials: {
			accessKeyId: config.R2_ACCESS_KEY_ID,
			secretAccessKey: config.R2_SECRET_ACCESS_KEY,
		},
	});

	return {
		async exists(key: string) {
			await client.send(
				new HeadObjectCommand({ Bucket: config.R2_BUCKET, Key: key })
			);
		},
		async put(
			key: string,
			body: ReadableStream<Uint8Array>,
			contentType: "image/png" | "image/webp",
			contentLength?: number
		) {
			await client.send(
				new PutObjectCommand({
					Bucket: config.R2_BUCKET,
					Key: key,
					Body: Readable.fromWeb(body),
					ContentType: contentType,
					...(contentLength === undefined
						? {}
						: { ContentLength: contentLength }),
				})
			);
		},
		async get(key: string) {
			try {
				const result = await client.send(
					new GetObjectCommand({ Bucket: config.R2_BUCKET, Key: key })
				);
				if (!result.Body) {
					return null;
				}
				return {
					body: result.Body.transformToWebStream(),
					contentLength: result.ContentLength,
					contentType: result.ContentType ?? "application/octet-stream",
				};
			} catch (error) {
				if (isMissingObject(error)) {
					return null;
				}
				throw error;
			}
		},
		async delete(key: string) {
			await client.send(
				new DeleteObjectCommand({ Bucket: config.R2_BUCKET, Key: key })
			);
		},
	};
}

function isMissingObject(error: unknown) {
	if (!error || typeof error !== "object") {
		return false;
	}
	const candidate = error as {
		$metadata?: { httpStatusCode?: unknown };
		name?: unknown;
	};
	return (
		candidate.$metadata?.httpStatusCode === 404 ||
		candidate.name === "NoSuchKey" ||
		candidate.name === "NotFound"
	);
}

export function createQueue(
	config: CloudflareQueueConfig,
	fetcher: (input: string, init?: RequestInit) => Promise<Response> = fetch
) {
	const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/queues/${config.CLOUDFLARE_QUEUE_ID}/messages`;

	async function request(path: string, body: unknown): Promise<unknown> {
		const response = await fetcher(`${baseUrl}${path}`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${config.CLOUDFLARE_QUEUES_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
		});
		const result: unknown = await response.json();
		const envelope = z.object({ success: z.boolean() }).safeParse(result);
		if (!(response.ok && envelope.success && envelope.data.success)) {
			throw new Error(`Cloudflare Queues request failed: ${response.status}`);
		}
		return result;
	}

	return {
		async send(key: string) {
			const message = serializeProjectQueueMessage(key);
			await request("", {
				body: message,
			});
		},
		async pull() {
			const result = await request("/pull", {
				batch_size: 10,
				visibility_timeout_ms: 60_000,
			});
			return z
				.object({
					result: z.object({
						messages: z.array(
							z.object({ lease_id: z.string(), body: z.unknown() })
						),
					}),
				})
				.parse(result).result.messages;
		},
		async settle(acks: string[], retries: string[]) {
			await request("/ack", {
				acks: acks.map((lease_id) => ({ lease_id })),
				retries: retries.map((lease_id) => ({ lease_id })),
			});
		},
	};
}
