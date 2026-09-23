import { expect, test } from "bun:test";
import {
	privateDataResponseSchema,
	serializePrivateDataResponse,
	serializeRpcHealthResponse,
} from "@sprite-anvil/api/output-contracts";

const createdAt = new Date("2026-09-23T10:00:00.000Z");
const secretFieldPattern =
	/accessToken|refreshToken|encryptionKey|provider-access-token|project-encryption-key/i;

test("RPC response serializers use strict allowlisted output contracts", () => {
	const user = {
		id: "user-1",
		name: "Pixel Artist",
		email: "artist@example.test",
		emailVerified: true,
		image: null,
		createdAt,
		updatedAt: createdAt,
		accessToken: "provider-access-token",
		refreshToken: "provider-refresh-token",
		encryptionKey: "project-encryption-key",
	};
	const response = serializePrivateDataResponse(user);

	expect(response).toEqual({
		message: "This is private",
		user: {
			id: "user-1",
			name: "Pixel Artist",
			email: "artist@example.test",
			emailVerified: true,
			image: null,
			createdAt,
			updatedAt: createdAt,
		},
	});
	expect(JSON.stringify(response)).not.toMatch(secretFieldPattern);
	expect(
		privateDataResponseSchema.safeParse({
			user: {
				id: "user-1",
				name: "Pixel Artist",
				email: "artist@example.test",
				emailVerified: true,
				image: null,
				createdAt,
				updatedAt: createdAt,
				accessToken: "provider-access-token",
			},
			message: "This is private",
		}).success
	).toBe(false);
	expect(serializeRpcHealthResponse()).toBe("OK");
});
