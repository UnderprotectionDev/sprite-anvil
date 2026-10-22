import {
	vfxAppearanceFrameSchema,
	vfxAppearanceInputSchema,
} from "@sprite-anvil/api/vfx-appearance-reviews";
import { vfxSynchronizationInputSchema } from "@sprite-anvil/api/vfx-synchronization";
import z from "zod";

export const vfxAppearanceFormSchema = vfxAppearanceInputSchema;

export const vfxAppearancePreviewSchema = z.object({
	frames: z.array(vfxAppearanceFrameSchema),
	cell: z.object({ width: z.number().gt(0), height: z.number().gt(0) }),
	opacity: z.number().min(0).max(1),
	sceneAssetVersionId: z.string().min(1),
});

export const vfxReviewResultSchema = z.enum([
	"passed",
	"failed",
	"inconclusive",
]);

export const vfxSynchronizationFormSchema = vfxSynchronizationInputSchema;
