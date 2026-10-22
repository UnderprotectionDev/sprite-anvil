import {
	type GameplayMetadataFrame,
	gameplayMetadataFieldIds,
	type getGameplayMetadataFields,
} from "@sprite-anvil/api/gameplay-metadata";
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
		return "Desteklenmeyen alan.";
	}
	if (definition.id === "pivot" && sourcePivot) {
		return null;
	}
	const text = values.fieldValues[definition.id]?.trim();
	if (!text && definition.required) {
		return `${definition.label} zorunludur.`;
	}
	if (text && !isJson(text)) {
		return "Alanlara geçerli JSON girin; boş isteğe bağlı alanlar Bilinmiyor kalır.";
	}
	return null;
}

function getSelectionFailure(
	values: GameplayMetadataFormValues,
	{ contract, frame, sourcePivot }: GameplayMetadataFormSelection
) {
	if (!(frame && contract && values.useContext.trim())) {
		return "Kare, etkin profil ve kullanım bağlamı seçin.";
	}
	if (values.sourcePivot && !sourcePivot) {
		return "Seçili kaynak artık kullanılamıyor. Dönüş noktası kaynağını yeniden seçin.";
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
