import { z } from "zod";

/** The part of a cached project snapshot the offline view reads; the rest is kept as received. */
export const cachedProjectSchema = z.looseObject({
	id: z.string(),
	name: z.string(),
});

export type CachedProject = z.infer<typeof cachedProjectSchema>;

const wholeNumberPattern = /^\d+$/;
const hexColorPattern = /^#[0-9a-f]{6}$/i;

function coordinate(label: string, max: number) {
	return z
		.string()
		.trim()
		.regex(wholeNumberPattern, `${label}: use a whole number`)
		.transform(Number)
		.pipe(z.number().max(max, `${label}: use at most ${max}`));
}

/** One pixel edit on a staged Working Draft, kept inside the canvas it was staged with. */
export function stagedOperationFormSchema(size: {
	height: number;
	width: number;
}) {
	return z.object({
		tool: z.enum(["pen", "eraser", "fill"]),
		x: coordinate("Pixel x", size.width - 1),
		y: coordinate("Pixel y", size.height - 1),
		color: z.string().regex(hexColorPattern, "Choose a colour"),
	});
}

export type StagedOperationForm = z.infer<
	ReturnType<typeof stagedOperationFormSchema>
>;
