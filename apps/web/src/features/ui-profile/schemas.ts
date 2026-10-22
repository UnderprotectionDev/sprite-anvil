import type { UiStateComparisonInput } from "@sprite-anvil/api/ui-state-comparisons";
import { uiStateComparisonInputSchema } from "@sprite-anvil/api/ui-state-comparisons";
import {
	uiStretchStateSchema,
	uiStretchTestInputSchema,
} from "@sprite-anvil/api/ui-stretch-tests";
import z from "zod";

export type UiStateComparisonDraftItem =
	UiStateComparisonInput["items"][number] & { key: string };

interface UiStateComparisonSubmitContext {
	assetFamilyId: string;
	contractRevisionId: string | undefined;
	projectId: string;
}

/**
 * Validates the state comparison form values against the API input contract:
 * draft keys are dropped, and a fresh operation id is minted for every parse.
 */
export function createUiStateComparisonSubmitSchema(
	context: UiStateComparisonSubmitContext
) {
	return z
		.object({
			screenAssetVersionId: z.string(),
			name: z.string(),
			familyStyleNotes: z.string(),
			stateDistinctionNotes: z.string(),
			outcome: z.string(),
			items: z.array(z.looseObject({ key: z.string() })),
		})
		.transform(
			(values) =>
				({
					id: crypto.randomUUID(),
					projectId: context.projectId,
					assetFamilyId: context.assetFamilyId,
					contractRevisionId: context.contractRevisionId,
					screenAssetVersionId: values.screenAssetVersionId,
					name: values.name,
					familyStyleNotes: values.familyStyleNotes,
					stateDistinctionNotes: values.stateDistinctionNotes,
					outcome: values.outcome,
					items: values.items.map(({ key: _key, ...item }) => item),
				}) as unknown as z.input<typeof uiStateComparisonInputSchema>
		)
		.pipe(uiStateComparisonInputSchema);
}

export const uiStretchBoundsFields = [
	["left", "Left margin"],
	["right", "Right margin"],
	["top", "Top margin"],
	["bottom", "Bottom margin"],
	["x", "Text area X"],
	["y", "Text area Y"],
	["width", "Text area width"],
	["height", "Text area height"],
] as const;

type UiStretchBoundsField = (typeof uiStretchBoundsFields)[number][0];

export type UiStretchStateDraft = {
	key: string;
	componentId: string;
	stateId: string;
	assetVersionId: string;
} & Record<UiStretchBoundsField, string>;

export interface UiStretchTargetDraft {
	height: string;
	key: string;
	width: string;
}

export interface UiStretchObservationDraft {
	notes: string;
	outcome: "passed" | "failed" | "inconclusive";
}

interface UiStretchAvailableVersion {
	assetRecordId: string;
	id: string;
	sourceImageDimensions?: { height: number; width: number } | null;
}

const uiStretchStateDraftSchema = z.object({
	key: z.string(),
	componentId: z.string(),
	stateId: z.string(),
	assetVersionId: z.string(),
	left: z.string(),
	right: z.string(),
	top: z.string(),
	bottom: z.string(),
	x: z.string(),
	y: z.string(),
	width: z.string(),
	height: z.string(),
});

/** Validates one state draft against its exact Asset Version's source size. */
export function createUiStretchStateSchema(
	available: readonly UiStretchAvailableVersion[]
) {
	return uiStretchStateDraftSchema
		.transform((draft) => {
			const version = available.find((v) => v.id === draft.assetVersionId);
			return {
				componentId: draft.componentId,
				stateId: draft.stateId,
				assetVersionId: draft.assetVersionId,
				assetRecordId: version?.assetRecordId ?? "",
				naturalSize: version?.sourceImageDimensions,
				stretchMargins: {
					left: Number(draft.left),
					right: Number(draft.right),
					top: Number(draft.top),
					bottom: Number(draft.bottom),
				},
				textSafeArea: {
					x: Number(draft.x),
					y: Number(draft.y),
					width: Number(draft.width),
					height: Number(draft.height),
				},
			};
		})
		.pipe(uiStretchStateSchema);
}

interface UiStretchConfigurationContext {
	assetFamilyId: string;
	available: readonly UiStretchAvailableVersion[];
	contractRevisionId: string;
	projectId: string;
	visualWorldId: string;
}

/**
 * Validates the stretch test setup (states, targets, sample text) against the
 * API input contract. A state that fails its own schema becomes `null` so the
 * contract rejects the whole configuration.
 */
export function createUiStretchConfigurationSchema(
	context: UiStretchConfigurationContext
) {
	const stateSchema = createUiStretchStateSchema(context.available);
	return z
		.object({
			screenVersion: z.string(),
			sampleText: z.string(),
			drafts: z.array(uiStretchStateDraftSchema),
			targets: z.array(
				z.object({ key: z.string(), width: z.string(), height: z.string() })
			),
		})
		.transform(
			(values) =>
				({
					id: crypto.randomUUID(),
					projectId: context.projectId,
					assetFamilyId: context.assetFamilyId,
					visualWorldId: context.visualWorldId,
					contractRevisionId: context.contractRevisionId,
					screen: values.screenVersion
						? {
								assetRecordId: context.available.find(
									(v) => v.id === values.screenVersion
								)?.assetRecordId,
								assetVersionId: values.screenVersion,
							}
						: undefined,
					states: values.drafts.map((draft) => {
						const parsed = stateSchema.safeParse(draft);
						return parsed.success ? parsed.data : null;
					}),
					targets: values.targets.map((t) => ({
						width: Number(t.width),
						height: Number(t.height),
					})),
					observations: [],
					sampleText: values.sampleText,
				}) as unknown as z.input<typeof uiStretchTestInputSchema>
		)
		.pipe(uiStretchTestInputSchema);
}
