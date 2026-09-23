import type { Session } from "@sprite-anvil/auth";
import z from "zod";

const sessionUserResponseSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
		image: z.string().nullable(),
		createdAt: z.date(),
		updatedAt: z.date(),
	})
	.strict();

export const privateDataResponseSchema = z
	.object({
		message: z.literal("This is private"),
		user: sessionUserResponseSchema.nullable(),
	})
	.strict();

export function serializePrivateDataResponse(
	user: Session["user"] | null | undefined
) {
	return privateDataResponseSchema.parse({
		message: "This is private",
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
					emailVerified: user.emailVerified,
					image: user.image ?? null,
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				}
			: null,
	});
}

const rpcHealthResponseSchema = z.literal("OK");

export function serializeRpcHealthResponse() {
	return rpcHealthResponseSchema.parse("OK");
}
