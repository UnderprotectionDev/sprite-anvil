import { describe, expect, it } from "bun:test";

import { createQueue, queueMessageSchema } from "./cloudflare";

const config = {
	CLOUDFLARE_ACCOUNT_ID: "account",
	CLOUDFLARE_QUEUE_ID: "queue",
	CLOUDFLARE_QUEUES_TOKEN: "token",
	R2_ACCESS_KEY_ID: "access",
	R2_SECRET_ACCESS_KEY: "secret",
	R2_BUCKET: "assets",
};

describe("Cloudflare Queues HTTP transport", () => {
	it("publishes, pulls, and settles leased messages through the documented endpoints", async () => {
		const calls: { url: string; body: unknown }[] = [];
		const fetcher = (input: string, init?: RequestInit) => {
			calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
			const result = String(input).endsWith("/pull")
				? {
						success: true,
						result: {
							messages: [
								{
									lease_id: "lease-1",
									body: {
										kind: "asset-uploaded",
										version: 2,
										key: "projects/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002",
									},
								},
							],
						},
					}
				: { success: true };
			return Promise.resolve(Response.json(result));
		};
		const queue = createQueue(config, fetcher);

		await queue.send(
			"projects/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002"
		);
		const messages = await queue.pull();
		expect(messages).toHaveLength(1);
		await queue.settle([messages[0]?.lease_id ?? ""], []);

		expect(calls.map((call) => call.url)).toEqual([
			"https://api.cloudflare.com/client/v4/accounts/account/queues/queue/messages",
			"https://api.cloudflare.com/client/v4/accounts/account/queues/queue/messages/pull",
			"https://api.cloudflare.com/client/v4/accounts/account/queues/queue/messages/ack",
		]);
		expect(calls.at(0)?.body).toEqual({
			body: {
				version: 2,
				kind: "asset-uploaded",
				key: "projects/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002",
			},
		});
		expect(calls.at(2)?.body).toEqual({
			acks: [{ lease_id: "lease-1" }],
			retries: [],
		});
	});

	it("accepts legacy version 1 messages and rejects secret-bearing version 2 messages", () => {
		expect(
			queueMessageSchema.parse({
				version: 1,
				kind: "asset-uploaded",
				key: "users/user-a/asset.png",
			})
		).toEqual({
			version: 1,
			kind: "asset-uploaded",
			key: "users/user-a/asset.png",
		});
		expect(
			queueMessageSchema.safeParse({
				version: 2,
				kind: "asset-uploaded",
				key: "projects/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002",
				accessToken: "must-not-enter-queue",
			}).success
		).toBe(false);
	});

	it("rejects unsuccessful API envelopes", async () => {
		const queue = createQueue(config, () =>
			Promise.resolve(Response.json({ success: false }, { status: 403 }))
		);
		await expect(
			queue.send(
				"projects/00000000-0000-4000-8000-000000000001/assets/00000000-0000-4000-8000-000000000002"
			)
		).rejects.toThrow("Cloudflare Queues request failed: 403");
	});
});
