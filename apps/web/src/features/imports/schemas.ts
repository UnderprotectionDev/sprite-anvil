import z from "zod";

export const sourceMetadataMappingFinalizationFormSchema = z.object({
	assetRecordId: z.string().min(1),
	decisions: z.record(z.string(), z.string()),
});
