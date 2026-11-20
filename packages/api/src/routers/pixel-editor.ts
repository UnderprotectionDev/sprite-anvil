import type { Router } from "@orpc/server";
import { ORPCError } from "@orpc/server";
import type { Context } from "../context";
import { implementProtected, o } from "../index";
import { pixelEditorContract } from "../pixel-editor-rpc";

const requirePixelEditorOperations = o.middleware(({ context, next }) => {
	if (!context.pixelEditorOperations) {
		throw new ORPCError("SERVICE_UNAVAILABLE");
	}
	return next({
		context: { pixelEditorOperations: context.pixelEditorOperations },
	});
});

const pixelEditorProcedure = implementProtected(pixelEditorContract).use(
	requirePixelEditorOperations
);

export const workingDraftsRouter: Router<
	typeof pixelEditorContract.workingDrafts,
	Context
> = {
	open: pixelEditorProcedure.workingDrafts.open.handler(({ context, input }) =>
		context.pixelEditorOperations.open(input, {
			context: { userId: context.session.user.id },
		})
	),
	read: pixelEditorProcedure.workingDrafts.read.handler(({ context, input }) =>
		context.pixelEditorOperations.read(input, {
			context: { userId: context.session.user.id },
		})
	),
	apply: pixelEditorProcedure.workingDrafts.apply.handler(
		({ context, input }) =>
			context.pixelEditorOperations.apply(input, {
				context: { userId: context.session.user.id },
			})
	),
	moveHistory: pixelEditorProcedure.workingDrafts.moveHistory.handler(
		({ context, input }) =>
			context.pixelEditorOperations.moveHistory(input, {
				context: { userId: context.session.user.id },
			})
	),
	previewColorReplace:
		pixelEditorProcedure.workingDrafts.previewColorReplace.handler(
			({ context, input }) =>
				context.pixelEditorOperations.previewColorReplace(input, {
					context: { userId: context.session.user.id },
				})
		),
	commit: pixelEditorProcedure.workingDrafts.commit.handler(
		({ context, input }) =>
			context.pixelEditorOperations.commit(input, {
				context: { userId: context.session.user.id },
			})
	),
	discard: pixelEditorProcedure.workingDrafts.discard.handler(
		({ context, input }) =>
			context.pixelEditorOperations.discard(input, {
				context: { userId: context.session.user.id },
			})
	),
	previewSlicing: pixelEditorProcedure.workingDrafts.previewSlicing.handler(
		({ context, input }) =>
			context.pixelEditorOperations.previewSlicing(input, {
				context: { userId: context.session.user.id },
			})
	),
	applySlicing: pixelEditorProcedure.workingDrafts.applySlicing.handler(
		({ context, input }) =>
			context.pixelEditorOperations.applySlicing(input, {
				context: { userId: context.session.user.id },
			})
	),
	readStructure: pixelEditorProcedure.workingDrafts.readStructure.handler(
		({ context, input }) =>
			context.pixelEditorOperations.readStructure(input, {
				context: { userId: context.session.user.id },
			})
	),
	applyFrameOperation:
		pixelEditorProcedure.workingDrafts.applyFrameOperation.handler(
			({ context, input }) =>
				context.pixelEditorOperations.applyFrameOperation(input, {
					context: { userId: context.session.user.id },
				})
		),
	commitStructure: pixelEditorProcedure.workingDrafts.commitStructure.handler(
		({ context, input }) =>
			context.pixelEditorOperations.commitStructure(input, {
				context: { userId: context.session.user.id },
			})
	),
};

export const offlineConflictsRouter: Router<
	typeof pixelEditorContract.offlineConflicts,
	Context
> = {
	reconcile: pixelEditorProcedure.offlineConflicts.reconcile.handler(
		({ context, input }) =>
			context.pixelEditorOperations.reconcile(input, {
				context: { userId: context.session.user.id },
			})
	),
	list: pixelEditorProcedure.offlineConflicts.list.handler(
		({ context, input }) =>
			context.pixelEditorOperations.list(input, {
				context: { userId: context.session.user.id },
			})
	),
	readConflict: pixelEditorProcedure.offlineConflicts.readConflict.handler(
		({ context, input }) =>
			context.pixelEditorOperations.readConflict(input, {
				context: { userId: context.session.user.id },
			})
	),
	requestAbandonConfirmation:
		pixelEditorProcedure.offlineConflicts.requestAbandonConfirmation.handler(
			({ context, input }) =>
				context.pixelEditorOperations.requestAbandonConfirmation(input, {
					context: { userId: context.session.user.id },
				})
		),
	resolve: pixelEditorProcedure.offlineConflicts.resolve.handler(
		({ context, input }) =>
			context.pixelEditorOperations.resolve(input, {
				context: { userId: context.session.user.id },
			})
	),
};
