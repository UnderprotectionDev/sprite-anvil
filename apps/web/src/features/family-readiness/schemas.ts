import { z } from "zod";

export const usageVariantSchema = z
	.string()
	.trim()
	.min(1, "Kullanım çeşidi boşluklardan oluşamaz.");

export const cellDimensionSchema = z
	.string()
	.transform((value) => Number(value))
	.pipe(
		z
			.number()
			.refine((dimension) => Number.isInteger(dimension))
			.min(1)
	);

export const pixelDimensionSchema = z
	.string()
	.transform((value) => Number(value))
	.pipe(z.number().int().positive().max(2_147_483_647));
