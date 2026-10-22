import { contextAgentScopes } from "@sprite-anvil/api/project-access-store";
import z from "zod";

export const createProjectFormSchema = z.object({
	name: z.string().trim().min(1),
	generalArtDirection: z.string().trim().min(1),
});

export const contextAgentPermissionFormSchema = z.object({
	purpose: z.string().trim().min(3),
	scopes: z.array(z.enum(contextAgentScopes)).min(1),
});

export type CreateProjectFormValues = z.input<typeof createProjectFormSchema>;
export type ContextAgentPermissionFormValues = z.input<
	typeof contextAgentPermissionFormSchema
>;
