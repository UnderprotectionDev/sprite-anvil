import { sceneQaRoles } from "@sprite-anvil/api/scene-qa";
import z from "zod";

export const sceneQaPlacementFormSchema = z.object({
	role: z.enum(sceneQaRoles),
	usageTestId: z.string(),
	versionId: z.string().min(1),
});
