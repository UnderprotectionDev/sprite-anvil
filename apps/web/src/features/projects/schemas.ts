import { contextAgentScopes } from "@sprite-anvil/api/project-access-store";
import z from "zod";

export const contextAgentPermissionFormSchema = z.object({
	purpose: z.string().trim().min(3),
	scopes: z.array(z.enum(contextAgentScopes)).min(1),
});

export type ContextAgentPermissionFormValues = z.input<
	typeof contextAgentPermissionFormSchema
>;
