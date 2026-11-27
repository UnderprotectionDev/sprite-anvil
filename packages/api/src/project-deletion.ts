import { z } from "zod";
import { backgroundOperationSchema } from "./background-operations";
export const projectDeletionImpactInputSchema = z
	.object({ projectId: z.string().min(1) })
	.strict();
export const projectDeletionCountsSchema = z
	.object({
		records: z.array(
			z.object({ kind: z.string(), count: z.number().int().nonnegative() })
		),
		managedObjects: z.number().int().nonnegative(),
		sharedObjects: z.number().int().nonnegative(),
	})
	.strict();
export const projectDeletionImpactSchema = projectDeletionCountsSchema
	.extend({
		projectId: z.string(),
		projectName: z.string(),
		scopeDigest: z.string(),
		blocked: z.boolean(),
	})
	.strict();
export type ProjectDeletionImpact = z.infer<typeof projectDeletionImpactSchema>;
export const projectDeletionApproveInputSchema =
	projectDeletionImpactInputSchema
		.extend({
			scopeDigest: z.string().length(64),
			confirmation: z.string(),
			idempotencyKey: z.uuid(),
		})
		.strict();
export type ProjectDeletionApproveInput = z.infer<
	typeof projectDeletionApproveInputSchema
>;
export const projectDeletionJobSchema = z
	.object({
		id: z.string(),
		projectId: z.string(),
		state: z.enum(["approved", "removing", "completed", "rejected"]),
		impact: projectDeletionCountsSchema,
		operation: backgroundOperationSchema.nullable(),
		completedAt: z.string().nullable(),
	})
	.strict();
export type ProjectDeletionJob = z.infer<typeof projectDeletionJobSchema>;
export interface ProjectDeletionStore {
	list: (ownerId: string) => Promise<ProjectDeletionJob[]>;
	prepare: (
		ownerId: string,
		projectId: string
	) => Promise<ProjectDeletionImpact | null>;
	read: (
		ownerId: string,
		projectId: string
	) => Promise<ProjectDeletionJob | null>;
	request: (
		ownerId: string,
		input: ProjectDeletionApproveInput
	) => Promise<ProjectDeletionJob | null>;
	retry: (ownerId: string, jobId: string) => Promise<ProjectDeletionJob | null>;
}
