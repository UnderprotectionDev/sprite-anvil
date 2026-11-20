import type { ContractRouterClient } from "@orpc/contract";
import { oc } from "@orpc/contract";
import z from "zod";
import { internalServerErrorMap } from "./error-contract";
import {
	offlineAbandonConfirmationSchema,
	offlineConflictListSchema,
	offlineConflictResolveInputSchema,
	offlineConflictResolveResponseSchema,
	offlineConflictViewSchema,
	offlineReconcileInputSchema,
	offlineReconcileResponseSchema,
} from "./offline-conflict";
import {
	pixelColorReplacePreviewInputSchema,
	pixelColorReplacePreviewSchema,
	pixelDraftCommitInputSchema,
	pixelDraftCommitResponseSchema,
	pixelDraftHistoryInputSchema,
	pixelDraftOpenInputSchema,
	pixelDraftOperationInputSchema,
	pixelDraftSchema,
} from "./pixel-editor";
import {
	frameOperationInputSchema,
	frameStructureCommitInputSchema,
	frameStructureCommitResponseSchema,
	sheetSlicingApplyInputSchema,
	sheetSlicingPreviewInputSchema,
	sheetSlicingPreviewSchema,
	sheetStructureViewSchema,
} from "./pixel-editor-structure";
import { projectIdSchema } from "./project-id";

const projectInput = z.strictObject({ projectId: projectIdSchema });
const draftIdInput = projectInput.extend({ draftId: z.uuid() });
const conflictIdInput = projectInput.extend({ conflictId: z.uuid() });
const draftHistoryInput = draftIdInput
	.extend(pixelDraftHistoryInputSchema.shape)
	.extend({ direction: z.enum(["undo", "redo"]) });

const procedure = oc.errors(internalServerErrorMap);

export const pixelEditorContract = {
	workingDrafts: {
		open: procedure
			.input(pixelDraftOpenInputSchema.extend(projectInput.shape))
			.output(pixelDraftSchema),
		read: procedure.input(draftIdInput).output(pixelDraftSchema),
		apply: procedure
			.input(pixelDraftOperationInputSchema.extend(draftIdInput.shape))
			.output(pixelDraftSchema),
		moveHistory: procedure.input(draftHistoryInput).output(pixelDraftSchema),
		previewColorReplace: procedure
			.input(pixelColorReplacePreviewInputSchema.extend(draftIdInput.shape))
			.output(pixelColorReplacePreviewSchema),
		commit: procedure
			.input(pixelDraftCommitInputSchema.extend(draftIdInput.shape))
			.output(pixelDraftCommitResponseSchema),
		discard: procedure.input(draftIdInput).output(pixelDraftSchema),
		previewSlicing: procedure
			.input(sheetSlicingPreviewInputSchema.extend(draftIdInput.shape))
			.output(sheetSlicingPreviewSchema),
		applySlicing: procedure
			.input(sheetSlicingApplyInputSchema.extend(draftIdInput.shape))
			.output(sheetStructureViewSchema),
		readStructure: procedure
			.input(draftIdInput)
			.output(sheetStructureViewSchema),
		applyFrameOperation: procedure
			.input(frameOperationInputSchema.extend(draftIdInput.shape))
			.output(sheetStructureViewSchema),
		commitStructure: procedure
			.input(frameStructureCommitInputSchema.extend(draftIdInput.shape))
			.output(frameStructureCommitResponseSchema),
	},
	offlineConflicts: {
		reconcile: procedure
			.input(projectInput.extend({ reconcile: offlineReconcileInputSchema }))
			.output(offlineReconcileResponseSchema),
		list: procedure.input(projectInput).output(offlineConflictListSchema),
		readConflict: procedure
			.input(conflictIdInput)
			.output(offlineConflictViewSchema),
		requestAbandonConfirmation: procedure
			.input(conflictIdInput)
			.output(offlineAbandonConfirmationSchema),
		resolve: procedure
			.input(offlineConflictResolveInputSchema.extend(conflictIdInput.shape))
			.output(offlineConflictResolveResponseSchema),
	},
};

type Contracts = typeof pixelEditorContract.workingDrafts &
	typeof pixelEditorContract.offlineConflicts;
export type PixelEditorOperations = ContractRouterClient<
	Contracts,
	{ userId: string }
>;
