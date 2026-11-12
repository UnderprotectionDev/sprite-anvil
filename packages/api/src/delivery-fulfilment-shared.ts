import { z } from "zod";
import { requiredSetItemKindSchema } from "./family-readiness";

export const idSchema = z.uuid();

/** Input that names one Delivery Target of one project; the list endpoints take exactly this. */
export const deliveryTargetScopeInputSchema = z
	.object({ deliveryTargetId: idSchema, projectId: idSchema })
	.strict();

/** The fields a draft requirement and a Fulfilment requirement record share: which required item of which pinned family. */
export const fulfilmentRequirementIdentityShape = {
	assetFamilyId: z.string(),
	assetFamilyName: z.string(),
	itemId: z.string(),
	itemKind: requiredSetItemKindSchema,
	itemName: z.string(),
	requiredSetRevisionId: z.string(),
};
