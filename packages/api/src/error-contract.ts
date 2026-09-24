import z from "zod";

export const supportReferenceSchema = z
	.string()
	.regex(/^SUP-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/);

export const internalServerErrorDataSchema = z
	.object({ supportReference: supportReferenceSchema })
	.strict();

export const internalServerErrorMap = {
	INTERNAL_SERVER_ERROR: {
		message: "Internal server error",
		data: internalServerErrorDataSchema,
	},
} as const;

export function createSupportReference() {
	return `SUP-${crypto.randomUUID().toUpperCase()}`;
}
