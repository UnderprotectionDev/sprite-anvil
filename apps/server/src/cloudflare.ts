import {
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import z from "zod";

export const assetUploadSchema = z.object({
	name: z.string().min(1).max(200),
	contentType: z.enum(["image/png", "image/webp"]),
});

export const assetReadySchema = z.object({
	key: z.string().regex(/^users\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.(png|webp)$/),
});

export const queueMessageSchema = z.object({
	version: z.literal(1),
	kind: z.literal("asset-uploaded"),
	key: assetReadySchema.shape.key,
});

export interface CloudflareConfig {
	CLOUDFLARE_ACCOUNT_ID: string;
	CLOUDFLARE_QUEUE_ID: string;
	CLOUDFLARE_QUEUES_TOKEN: string;
	R2_ACCESS_KEY_ID: string;
	R2_BUCKET: string;
	R2_SECRET_ACCESS_KEY: string;
}

export function requireCloudflareConfig(
	config: Partial<CloudflareConfig>
): CloudflareConfig {
	return z
		.object({
			CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
			CLOUDFLARE_QUEUE_ID: z.string().min(1),
			CLOUDFLARE_QUEUES_TOKEN: z.string().min(1),
			R2_ACCESS_KEY_ID: z.string().min(1),
			R2_SECRET_ACCESS_KEY: z.string().min(1),
			R2_BUCKET: z.string().min(1),
		})
		.parse(config);
}

export function createStorage(config: CloudflareConfig) {
	const client = new S3Client({
		region: "auto",
		endpoint: `https://${config.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: config.R2_ACCESS_KEY_ID,
			secretAccessKey: config.R2_SECRET_ACCESS_KEY,
		},
	});

	return {
		async signUpload(userId: string, contentType: "image/png" | "image/webp") {
			const extension = contentType === "image/png" ? "png" : "webp";
			const key = `users/${userId}/${crypto.randomUUID()}.${extension}`;
			const url = await getSignedUrl(
				client,
				new PutObjectCommand({
					Bucket: config.R2_BUCKET,
					Key: key,
					ContentType: contentType,
				}),
				{ expiresIn: 300 }
			);
			return { key, url };
		},
		async exists(key: string) {
			await client.send(
				new HeadObjectCommand({ Bucket: config.R2_BUCKET, Key: key })
			);
		},
	};
}

export function createQueue(
	config: CloudflareConfig,
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
			await request("", {
				body: { version: 1, kind: "asset-uploaded", key },
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
