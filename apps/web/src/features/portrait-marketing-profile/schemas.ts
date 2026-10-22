import {
	portraitIdentityReviewInputSchema,
	portraitReviewItemSchema,
} from "@sprite-anvil/api/portrait-identity-reviews";
import { z } from "zod";

export const portraitIdentityReviewFormSchema = z.object({
	items: z
		.array(
			z.object({ key: z.string().min(1), value: portraitReviewItemSchema })
		)
		.min(2)
		.max(24),
	observations: portraitIdentityReviewInputSchema.shape.observations,
	rationale: portraitIdentityReviewInputSchema.shape.rationale,
});
