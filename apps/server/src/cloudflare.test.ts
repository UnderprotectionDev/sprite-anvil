import { describe, expect, it } from "bun:test";

import { createQueue } from "./cloudflare";

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
										version: 1,
										key: "users/u/a.png",
									},
								},
							],
						},
					}
				: { success: true };
			return Promise.resolve(Response.json(result));
		};
		const queue = createQueue(config, fetcher);

		await queue.send("users/u/a.png");
		const messages = await queue.pull();
		expect(messages).toHaveLength(1);
		await queue.settle([messages[0]?.lease_id ?? ""], []);

		expect(calls.map((call) => call.url)).toEqual([
			"https://api.cloudflare.com/client/v4/accounts/account/queues/queue/messages",
			"https://api.cloudflare.com/client/v4/accounts/account/queues/queue/messages/pull",
			"https://api.cloudflare.com/client/v4/accounts/account/queues/queue/messages/ack",
		]);
		expect(calls.at(2)?.body).toEqual({
			acks: [{ lease_id: "lease-1" }],
			retries: [],
		});
	});

	it("rejects unsuccessful API envelopes", async () => {
		const queue = createQueue(config, () =>
			Promise.resolve(Response.json({ success: false }, { status: 403 }))
		);
		await expect(queue.send("users/u/a.png")).rejects.toThrow(
			"Cloudflare Queues request failed: 403"
		);
	});
});
