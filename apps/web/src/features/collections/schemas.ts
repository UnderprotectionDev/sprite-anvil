import z from "zod";

export const collectionNameFormSchema = z.object({
	name: z.string().refine((name) => name.trim().length > 0),
});

export const collectionMembershipFormSchema = z.object({
	assetRecordId: z.string().min(1),
});
