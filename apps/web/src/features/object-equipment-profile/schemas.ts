import z from "zod";

const maxComparedVersions = 100;
const maxObservationLength = 1000;

const observationSchema = z.string().trim().min(1).max(maxObservationLength);

export const assetFamilyComparisonFormSchema = z.object({
	selectedRecordIds: z.array(z.string()).min(2).max(maxComparedVersions),
	observations: z.object({
		scale: observationSchema,
		perspective: observationSchema,
		materialLanguage: observationSchema,
		stateDirectionDistinction: observationSchema,
	}),
});

export const maxComparedVersionCount = maxComparedVersions;
