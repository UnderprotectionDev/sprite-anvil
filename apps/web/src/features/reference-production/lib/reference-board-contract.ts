import type {
	ReferenceFeature,
	ReferenceRole,
} from "@sprite-anvil/api/asset-record-tracking";

export type {
	ReferenceFeature,
	ReferenceRole,
} from "@sprite-anvil/api/asset-record-tracking";
export {
	referenceFeatures,
	referenceRoles,
} from "@sprite-anvil/api/asset-record-tracking";

export const referenceRoleLabels: Record<ReferenceRole, string> = {
	identity: "Kimliği, silueti ve ayırt edici özellikleri korumak",
	pose: "Yalnızca poz veya hareket aktarmak",
	style: "Yalnızca çizim veya görüntüleme stilini aktarmak",
	palette: "Yalnızca paleti veya renk ilişkisini aktarmak",
	equipment: "Yalnızca ekipmanı veya malzeme tasarımını aktarmak",
	composition: "Yalnızca kompozisyonu, kamerayı veya yerleşimi aktarmak",
	theme: "Tema ve çevre dilini aktarmak",
	avoid: "Belirli özelliklerden kaçınmak",
	custom: "Özel kullanım amacı",
};

export const referenceFeatureLabels: Record<ReferenceFeature, string> = {
	identity: "Kimlik",
	pose: "Poz veya hareket",
	style: "Çizim veya görüntüleme stili",
	palette: "Palet veya renk ilişkisi",
	equipment: "Ekipman veya malzeme tasarımı",
	composition: "Kompozisyon, kamera veya yerleşim",
	theme: "Tema ve çevre dili",
};

const rolePresetFeatures: Partial<Record<ReferenceRole, ReferenceFeature[]>> = {
	identity: ["identity"],
	pose: ["pose"],
	style: ["style"],
	palette: ["palette"],
	equipment: ["equipment"],
	composition: ["composition"],
	theme: ["theme"],
};

export function defaultTransferredFeatures(role: ReferenceRole) {
	return rolePresetFeatures[role] ? [...rolePresetFeatures[role]] : [];
}

const base64PaddingPattern = /[=]+$/;

export function encodeMetadataHeader(value: unknown) {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = "";
	const chunkSize = 0x80_00;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(base64PaddingPattern, "");
}

export function localizedFeatureList(features: readonly ReferenceFeature[]) {
	return features.map((feature) => referenceFeatureLabels[feature]).join(", ");
}
