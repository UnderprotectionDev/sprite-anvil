import z from "zod";

export const generationPackageFormSchema = z.object({
	avoidConstraints: z.string().max(15_000),
	changeConstraints: z.string().max(15_000),
	expectedOutputStructure: z.string().min(1).max(2000),
	lockedUnitVersionIds: z.array(z.string()),
	preserveConstraints: z.string().max(15_000),
	targetHeight: z.string().min(1),
	targetTask: z.string().min(1).max(2000),
	targetWidth: z.string().min(1),
});
