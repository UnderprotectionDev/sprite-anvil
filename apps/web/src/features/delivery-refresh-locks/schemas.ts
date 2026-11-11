import { deliveryRefreshDecisionKinds } from "@sprite-anvil/api/delivery-refresh-classification";
import { deliveryDestinationLabelSchema } from "@sprite-anvil/api/delivery-refresh-locks";
import { z } from "zod";
import type { ChosenFolder } from "./lib/read-target-folder";

const folderSchema = z.custom<ChosenFolder | null>(
	(value) => value !== null && typeof value === "object",
	"Choose a folder."
);

export const firstApplyFormSchema = z.object({
	bundleId: z.string().min(1, "Choose a bundle."),
	destinationLabel: deliveryDestinationLabelSchema,
	folder: folderSchema,
});

export const refreshFormSchema = z.object({
	bundleId: z.string().min(1, "Choose a bundle."),
	decided: z.record(z.string(), z.enum(deliveryRefreshDecisionKinds)),
	lockId: z.string().min(1, "Choose a lock."),
	target: z.custom<ChosenFolder | null>(),
	updated: folderSchema,
});
