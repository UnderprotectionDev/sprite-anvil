import { z } from "zod";
import {
	type GameplayMetadataFrame,
	type GameplayMetadataRecord,
	getGameplayMetadataFields,
} from "./gameplay-metadata";
import type { SpecializedProfileContract } from "./specialized-profile-contracts";

export function canonicalGameplayMetadataJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalGameplayMetadataJson).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		return `{${Object.entries(value)
			.filter(([, entry]) => entry !== undefined)
			.sort(([left], [right]) => (left < right ? -1 : Number(left > right)))
			.map(
				([key, entry]) =>
					`${JSON.stringify(key)}:${canonicalGameplayMetadataJson(entry)}`
			)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

export function isGameplayMetadataValueValid(
	field: SpecializedProfileContract["metadataFields"][number],
	value: unknown
) {
	if (value === null) {
		return !field.required;
	}
	const validators = {
		identifier: z.string().min(1).max(512),
		text: z.string().min(1).max(4096),
		text_list: z.array(z.string().min(1).max(512)).max(256),
		integer: z.number().int(),
		number: z.number(),
		boolean: z.boolean(),
		json: z.json(),
	};
	return validators[field.type].safeParse(value).success;
}

export function getGameplayMetadataIntegrityErrors(
	record: GameplayMetadataRecord,
	frames: GameplayMetadataFrame[],
	contract = record.contractSnapshot
): string[] {
	const errors: string[] = [];
	const frame = frames.find(
		(candidate) =>
			candidate.assetVersionId === record.assetVersionId &&
			candidate.frameKey === record.frameKey
	);
	if (!frame) {
		errors.push("Kare kimliği veya kesin sürüm bağlantısı kayboldu.");
	}
	if (!contract || contract.profileId !== record.profileId) {
		errors.push("Kesin özel profil sözleşmesi yeniden okunamadı.");
		return errors;
	}
	const definitions = getGameplayMetadataFields(contract);
	if (
		new Set(record.fields.map((field) => field.fieldId)).size !==
		record.fields.length
	) {
		errors.push("Oyun içi bilgi alan kimlikleri yineleniyor.");
	}
	for (const definition of definitions) {
		const field = record.fields.find(
			(candidate) => candidate.fieldId === definition.id
		);
		if (
			!(field && isGameplayMetadataValueValid(definition, field.value)) ||
			field.unit !== definition.unit ||
			field.coordinateSystem !== definition.coordinateSystem
		) {
			errors.push(
				`${definition.label}: alan veya zorunlu bağlantı korunamadı.`
			);
		}
	}
	for (const field of record.fields) {
		if (!definitions.some((definition) => definition.id === field.fieldId)) {
			errors.push(`${field.fieldId}: sözleşme alanı bulunamadı.`);
		}
		if ((field.value === null) !== (field.source.kind === "unknown")) {
			errors.push(`${field.fieldId}: değer ve kaynak bilgisi çelişiyor.`);
		}
		if (field.source.kind === "finalized_source") {
			const { source } = field;
			const pivot = frame?.sourcePivots.find(
				(candidate) =>
					candidate.proposalId === source.proposalId &&
					candidate.sourceEntryId === source.sourceEntryId &&
					candidate.sourcePath === source.sourcePath
			);
			if (
				field.fieldId !== "pivot" ||
				!pivot ||
				canonicalGameplayMetadataJson(pivot.value) !==
					canonicalGameplayMetadataJson(field.value)
			) {
				errors.push(
					`${field.fieldId}: kesinleştirilmiş kaynak bağlantısı kayboldu.`
				);
			}
		}
	}
	return errors;
}

export function getGameplayMetadataReviewSourceErrors(
	record: GameplayMetadataRecord,
	records: GameplayMetadataRecord[]
): string[] {
	if (!record.review) {
		return [];
	}
	const source = records.find(
		(candidate) => candidate.id === record.review?.sourceRecordId
	);
	if (!source || source.review) {
		return ["İncelemenin kaynak kayıt bağlantısı korunamadı."];
	}
	const {
		id: _reviewId,
		createdAt: _reviewedAt,
		review: _review,
		contractSnapshot: snapshot,
		...reviewedContent
	} = record;
	const {
		id: _sourceId,
		createdAt: _sourceCreatedAt,
		contractSnapshot: sourceSnapshot,
		...sourceContent
	} = source;
	if (
		canonicalGameplayMetadataJson(sourceContent) !==
			canonicalGameplayMetadataJson(reviewedContent) ||
		(sourceSnapshot &&
			canonicalGameplayMetadataJson(sourceSnapshot) !==
				canonicalGameplayMetadataJson(snapshot))
	) {
		return ["İncelemenin kaynak kayıt bağlantısı korunamadı."];
	}
	return [];
}
