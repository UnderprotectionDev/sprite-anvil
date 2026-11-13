import { z } from "zod";

export const platformEquivalenceRunFormSchema = z.object({
	bundleId: z.string().min(1, "Choose the Export Bundle this run used."),
});
