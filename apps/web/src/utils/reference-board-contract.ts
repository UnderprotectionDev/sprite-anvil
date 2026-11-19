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
	identity: "Preserve identity, silhouette, and distinctive features",
	pose: "Transfer pose or motion only",
	style: "Transfer drawing or rendering style only",
	palette: "Transfer palette or color relationships only",
	equipment: "Transfer equipment or material design only",
	composition: "Transfer composition, camera, or layout only",
	theme: "Transfer theme and environmental language",
	avoid: "Avoid specific features",
	custom: "Custom usage purpose",
};

export const referenceFeatureLabels: Record<ReferenceFeature, string> = {
	identity: "Identity",
	pose: "Pose or motion",
	style: "Drawing or rendering style",
	palette: "Palette or color relationships",
	equipment: "Equipment or material design",
	composition: "Composition, camera, or layout",
	theme: "Theme and environmental language",
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

const base64PaddingPattern = /[=]+$/u;

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
