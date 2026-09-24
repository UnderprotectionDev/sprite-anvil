import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";
import {
	createSupportReference,
	internalServerErrorMap,
} from "./error-contract";

export const o = os.$context<Context>().errors(internalServerErrorMap);

const attachSupportReference = o.middleware(async ({ errors, next, path }) => {
	try {
		return await next();
	} catch (error) {
		if (error instanceof ORPCError && error.status < 500) {
			throw error;
		}

		const supportReference = createSupportReference();
		const stack =
			error instanceof Error
				? error.stack?.split("\n").slice(1).join("\n")
				: undefined;
		console.error("Unhandled API operation", {
			supportReference,
			operation: path.join("."),
			errorName: error instanceof Error ? error.name : "UnknownError",
			...(stack ? { stack } : {}),
		});

		throw errors.INTERNAL_SERVER_ERROR({
			data: { supportReference },
			cause: error,
		});
	}
});

export const publicProcedure = o.use(attachSupportReference);

const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return await next({
		context: {
			session: context.session,
		},
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);
