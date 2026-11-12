import { z } from "zod";

/** Search parameters of the Delivery Diff page: the Delivery Target whose Fulfilments are compared. */
export const deliveryDiffSearchSchema = z.object({
	deliveryTargetId: z.string().optional(),
});
