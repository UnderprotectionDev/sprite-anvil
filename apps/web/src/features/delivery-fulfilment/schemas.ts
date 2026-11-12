import { z } from "zod";

/** One entry per conflicting requirement, in draft order; "" is the unchosen starting value. */
export const fulfilmentFinalizeFormSchema = z.object({
	bundleIds: z.array(
		z.string().min(1, "Pick an Export Bundle for this requirement.")
	),
});
