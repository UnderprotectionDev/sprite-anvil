import {
	type FrameOperation,
	frameStructureCommitResponseSchema,
	type SheetSlicing,
	type SheetStructureView,
	sheetSlicingPreviewSchema,
	sheetStructureViewSchema,
} from "@sprite-anvil/api/pixel-editor-structure";
import { ENV } from "@/env";
import { draftsUrl, getJson, post } from "./pixel-editor-api";

const trailingSlashPattern = /\/$/;

function structureUrl(projectId: string, draftId: string) {
	return `${draftsUrl(projectId)}/${draftId}/structure`;
}

export function frameImageUrl(
	view: SheetStructureView,
	frame: SheetStructureView["frames"][number]
) {
	const serverUrl = ENV.VITE_SERVER_URL.replace(trailingSlashPattern, "");
	return `${serverUrl}${frame.previewUrl}?revision=${view.draftRevision}`;
}

export async function previewSheetSlicing(
	projectId: string,
	draftId: string,
	slicing: SheetSlicing
) {
	return sheetSlicingPreviewSchema.parse(
		await post(`${draftsUrl(projectId)}/${draftId}/slicing-preview`, {
			slicing,
		})
	);
}

export async function readFrameStructure(projectId: string, draftId: string) {
	return sheetStructureViewSchema.parse(
		await getJson(structureUrl(projectId, draftId))
	);
}

export async function applySheetSlicing(
	projectId: string,
	draftId: string,
	expectedRevision: number,
	slicing: SheetSlicing
) {
	return sheetStructureViewSchema.parse(
		await post(`${structureUrl(projectId, draftId)}/slicing`, {
			expectedRevision,
			slicing,
		})
	);
}

export async function applyFrameOperation(
	projectId: string,
	view: SheetStructureView,
	operation: FrameOperation
) {
	return sheetStructureViewSchema.parse(
		await post(`${structureUrl(projectId, view.draftId)}/operations`, {
			expectedRevision: view.draftRevision,
			operation,
		})
	);
}

export async function commitFrameStructure(
	projectId: string,
	view: SheetStructureView
) {
	return frameStructureCommitResponseSchema.parse(
		await post(`${structureUrl(projectId, view.draftId)}/commit`, {
			expectedRevision: view.draftRevision,
		})
	);
}
