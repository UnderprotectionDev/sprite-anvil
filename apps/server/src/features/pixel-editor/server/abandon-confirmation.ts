import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Confirmation of an irreversible abandon. The server issues a short-lived
 * token only when it serves the affected local content; the abandon request
 * must present it. The token is an HMAC bound to the user, project, record
 * and local digest, so it cannot be forged, reused for another record or
 * kept past its lifetime. Nothing is stored.
 */

const lifetimeMs = 10 * 60 * 1000;
const tokenPattern = /^(\d+)\.([0-9a-f]{64})$/;

export interface AbandonConfirmationConfig {
	abandonConfirmationSecret: string;
	now?: () => number;
}

export interface AbandonBinding {
	conflictId: string;
	localDigest: string;
	projectId: string;
	userId: string;
}

export type AbandonTokenCheck = "expired" | "invalid" | "valid";

export function createAbandonConfirmations(config: AbandonConfirmationConfig) {
	const now = () => (config.now ? config.now() : Date.now());
	const sign = (binding: AbandonBinding, expiresAt: number) =>
		createHmac("sha256", config.abandonConfirmationSecret)
			.update(
				JSON.stringify([
					"offline-conflict-abandon",
					binding.userId,
					binding.projectId,
					binding.conflictId,
					binding.localDigest,
					expiresAt,
				])
			)
			.digest("hex");
	return {
		issue(binding: AbandonBinding) {
			const expiresAt = now() + lifetimeMs;
			return {
				token: `${expiresAt}.${sign(binding, expiresAt)}`,
				expiresAt: new Date(expiresAt).toISOString(),
			};
		},
		check(
			binding: AbandonBinding,
			token: string | undefined
		): AbandonTokenCheck {
			const match = token ? tokenPattern.exec(token) : null;
			if (!match) {
				return "invalid";
			}
			const expiresAt = Number(match[1]);
			const expected = Buffer.from(sign(binding, expiresAt));
			const given = Buffer.from(match[2] ?? "");
			if (
				expected.length !== given.length ||
				!timingSafeEqual(expected, given)
			) {
				return "invalid";
			}
			return now() > expiresAt ? "expired" : "valid";
		},
	};
}

export type AbandonConfirmations = ReturnType<
	typeof createAbandonConfirmations
>;
