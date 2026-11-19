import type {
	GameplayMetadataFrame,
	getGameplayMetadataFields,
} from "@sprite-anvil/api/gameplay-metadata";
import { gameplayMetadataFieldIds } from "@sprite-anvil/api/gameplay-metadata";
import z from "zod";

export interface GameplayMetadataFormSelection {
	contract: unknown;
	definitions: ReturnType<typeof getGameplayMetadataFields>;
	frame: GameplayMetadataFrame | undefined;
	sourcePivot: GameplayMetadataFrame["sourcePivots"][number] | undefined;
}

const gameplayMetadataFormValues = z.object({
	frame: z.string(),
	contractRevision: z.string(),
	useContext: z.string(),
	sourcePivot: z.string(),
	fieldValues: z.record(z.string(), z.string()),
});

export type GameplayMetadataFormValues = z.infer<
	typeof gameplayMetadataFormValues
>;

function isJson(text: string) {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

type FieldDefinition = GameplayMetadataFormSelection["definitions"][number];

function getFieldFailure(
	definition: FieldDefinition,
	values: GameplayMetadataFormValues,
	sourcePivot: GameplayMetadataFormSelection["sourcePivot"]
) {
	if (!gameplayMetadataFieldIds.some((id) => id === definition.id)) {
		return "Unsupported field.";
	}
	if (definition.id === "pivot" && sourcePivot) {
		return null;
	}
	const text = values.fieldValues[definition.id]?.trim();
	if (!text && definition.required) {
		return `${definition.label} is required.`;
	}
	if (text && !isJson(text)) {
		return "Enter valid JSON in the fields; empty optional fields remain Unknown.";
	}
	return null;
}

function getSelectionFailure(
	values: GameplayMetadataFormValues,
	{ contract, frame, sourcePivot }: GameplayMetadataFormSelection
) {
	if (!(frame && contract && values.useContext.trim())) {
		return "Select a frame, active profile, and usage context.";
	}
	if (values.sourcePivot && !sourcePivot) {
		return "The selected source is no longer available. Select the pivot source again.";
	}
	return null;
}

/**
 * Gameplay Metadata draft validation. Only the first failing rule is reported,
 * in the order the user resolves them: selection, finalized source, then each
 * contract field (support, required value, JSON syntax).
 */
export function gameplayMetadataFormSchema(
	resolve: (values: GameplayMetadataFormValues) => GameplayMetadataFormSelection
) {
	return gameplayMetadataFormValues.superRefine((values, context) => {
		const selection = resolve(values);
		const failure =
			getSelectionFailure(values, selection) ??
			selection.definitions
				.map((definition) =>
					getFieldFailure(definition, values, selection.sourcePivot)
				)
				.find((message) => message !== null) ??
			null;
		if (failure) {
			context.addIssue({ code: "custom", message: failure });
		}
	});
}
