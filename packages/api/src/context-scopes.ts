import { z } from "zod";

const recordIdSchema = z.string().trim().min(1).max(128);
const nameSchema = z.string().trim().min(1).max(120);
const descriptionSchema = z.string().trim().max(1000);

export const visualWorldRecordSchema = z
	.object({
		id: recordIdSchema,
		projectId: recordIdSchema,
		name: nameSchema,
		description: descriptionSchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const themeRecordSchema = z
	.object({
		id: recordIdSchema,
		projectId: recordIdSchema,
		visualWorldId: recordIdSchema,
		name: nameSchema,
		description: descriptionSchema,
		createdAt: z.string().datetime(),
	})
	.strict();

export const projectContextScopeCatalogSchema = z
	.object({
		visualWorlds: z.array(visualWorldRecordSchema),
		themes: z.array(themeRecordSchema),
	})
	.strict();

export const projectContextScopeListInputSchema = z
	.object({ projectId: recordIdSchema })
	.strict();

const namedScopeFields = {
	name: nameSchema,
	description: descriptionSchema.optional(),
};

export const visualWorldCreateInputSchema = z
	.object({
		projectId: recordIdSchema,
		...namedScopeFields,
	})
	.strict();

export const themeCreateInputSchema = z
	.object({
		projectId: recordIdSchema,
		visualWorldId: recordIdSchema,
		...namedScopeFields,
	})
	.strict();

export type VisualWorldRecord = z.infer<typeof visualWorldRecordSchema>;
export type ThemeRecord = z.infer<typeof themeRecordSchema>;
export type ProjectContextScopeCatalog = z.infer<
	typeof projectContextScopeCatalogSchema
>;
export type VisualWorldCreateInput = z.infer<
	typeof visualWorldCreateInputSchema
>;
export type ThemeCreateInput = z.infer<typeof themeCreateInputSchema>;

export interface ProjectContextScopeStore {
	createTheme: (
		userId: string,
		input: ThemeCreateInput
	) => Promise<ThemeRecord | null>;
	createVisualWorld: (
		userId: string,
		input: VisualWorldCreateInput
	) => Promise<VisualWorldRecord | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<ProjectContextScopeCatalog | null>;
}
