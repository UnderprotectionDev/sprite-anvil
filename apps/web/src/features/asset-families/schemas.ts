import z from "zod";

const nonBlankText = z.string().refine((value) => value.trim().length > 0);

export const subjectIdentityFormSchema = z.object({
	name: nonBlankText,
});

// Selection ids stay empty until the user picks; the form falls back to the
// first catalog entry, so only the typed text is validated here.
export const assetFamilyFormSchema = z.object({
	name: nonBlankText,
	subjectIdentityId: z.string(),
	useContext: nonBlankText,
	visualWorldId: z.string(),
});

export const assetRecordFormSchema = z.object({
	assetFamilyId: z.string(),
	identityCriteria: z
		.array(
			z.enum([
				"independent_product_meaning",
				"independent_lifecycle",
				"delivery_identity",
			])
		)
		.min(1),
	name: nonBlankText,
});
