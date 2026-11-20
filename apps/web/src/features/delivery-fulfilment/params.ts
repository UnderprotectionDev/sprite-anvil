import { z } from "zod";

/** Persist the Delivery Target and the exact Fulfilments selected for comparison. */
export const deliveryDiffSearchSchema = z.object({
	deliveryTargetId: z.string().optional(),
	fromId: z.uuid().optional().catch(undefined),
	toId: z.uuid().optional().catch(undefined),
});
