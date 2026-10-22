import z from "zod";

export const visualWorldFormSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
});

export const themeFormSchema = z.object({
	visualWorldId: z.string(),
	name: z.string().min(1),
	description: z.string(),
});

export type VisualWorldFormValues = z.input<typeof visualWorldFormSchema>;
export type ThemeFormValues = z.input<typeof themeFormSchema>;
