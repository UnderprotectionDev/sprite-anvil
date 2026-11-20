import { ORPCError } from "@orpc/server";
import type { PixelEditorOperations } from "@sprite-anvil/api/pixel-editor-rpc";
import { createAbandonConfirmations } from "./abandon-confirmation";
import {
	applyFrameEdit,
	applySlicing,
	commitStructure,
	previewSlicing,
	readStructureView,
} from "./frame-structure";
import {
	listOfflineConflicts,
	readOfflineConflict,
} from "./offline-conflict-reads";
import {
	resolveOfflineConflict,
	serveAbandonConfirmation,
} from "./offline-conflict-resolution";
import { reconcileStagedDraft } from "./offline-reconcile";
import type {
	ErrorStatus,
	Outcome,
	PixelEditorRouteDependencies,
	Scope,
} from "./pixel-editor-context";
import {
	applyDraftOperation,
	commitDraft,
	discardDraft,
	moveHistory,
	openDraft,
	previewColorReplace,
	readDraftView,
} from "./working-draft";

const errorCodes = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	404: "NOT_FOUND",
	409: "CONFLICT",
	422: "UNPROCESSABLE_CONTENT",
	502: "BAD_GATEWAY",
	503: "SERVICE_UNAVAILABLE",
} as const satisfies Record<ErrorStatus, string>;

export function createPixelEditorOperations(
	dependencies: PixelEditorRouteDependencies
): PixelEditorOperations {
	const confirmations = createAbandonConfirmations(dependencies);

	async function run<T>(
		userId: string,
		projectId: string,
		operation: (scope: Scope) => Promise<Outcome<T>>
	): Promise<T> {
		if (!(await dependencies.getProjectForUser(userId, projectId))) {
			throw new ORPCError("NOT_FOUND");
		}
		const outcome = await operation({
			access: { projectId, userId },
			dependencies,
		});
		if (!outcome.ok) {
			throw new ORPCError(errorCodes[outcome.status], {
				status: outcome.status,
				message: outcome.detail
					? `${outcome.error}: ${outcome.detail}`
					: outcome.error,
			});
		}
		return outcome.value;
	}

	return {
		open(input, { context: { userId } }) {
			const { projectId, ...body } = input;
			return run(userId, projectId, (scope) => openDraft(scope, body));
		},
		read: (input, { context: { userId } }) =>
			run(userId, input.projectId, (scope) =>
				readDraftView(scope, input.draftId)
			),
		apply(input, { context: { userId } }) {
			const { projectId, draftId: _draftId, ...body } = input;
			return run(userId, projectId, (scope) =>
				applyDraftOperation(scope, input.draftId, body)
			);
		},
		moveHistory(input, { context: { userId } }) {
			const {
				projectId,
				draftId: _draftId,
				direction: _direction,
				...body
			} = input;
			return run(userId, projectId, (scope) =>
				moveHistory(scope, input.draftId, body, input.direction)
			);
		},
		previewColorReplace(input, { context: { userId } }) {
			const { projectId, draftId: _draftId, ...body } = input;
			return run(userId, projectId, (scope) =>
				previewColorReplace(scope, input.draftId, body)
			);
		},
		commit(input, { context: { userId } }) {
			const { projectId, draftId: _draftId, ...body } = input;
			return run(userId, projectId, (scope) =>
				commitDraft(scope, input.draftId, body)
			);
		},
		discard: (input, { context: { userId } }) =>
			run(userId, input.projectId, (scope) =>
				discardDraft(scope, input.draftId)
			),
		previewSlicing(input, { context: { userId } }) {
			const { projectId, draftId: _draftId, ...body } = input;
			return run(userId, projectId, (scope) =>
				previewSlicing(scope, input.draftId, body)
			);
		},
		applySlicing(input, { context: { userId } }) {
			const { projectId, draftId: _draftId, ...body } = input;
			return run(userId, projectId, (scope) =>
				applySlicing(scope, input.draftId, body)
			);
		},
		readStructure: (input, { context: { userId } }) =>
			run(userId, input.projectId, (scope) =>
				readStructureView(scope, input.draftId)
			),
		applyFrameOperation(input, { context: { userId } }) {
			const { projectId, draftId: _draftId, ...body } = input;
			return run(userId, projectId, (scope) =>
				applyFrameEdit(scope, input.draftId, body)
			);
		},
		commitStructure(input, { context: { userId } }) {
			const { projectId, draftId: _draftId, ...body } = input;
			return run(userId, projectId, (scope) =>
				commitStructure(scope, input.draftId, body)
			);
		},
		reconcile: (input, { context: { userId } }) =>
			run(userId, input.projectId, (scope) =>
				reconcileStagedDraft(scope, input.reconcile)
			),
		list: (input, { context: { userId } }) =>
			run(userId, input.projectId, (scope) => listOfflineConflicts(scope)),
		readConflict: (input, { context: { userId } }) =>
			run(userId, input.projectId, (scope) =>
				readOfflineConflict(scope, input.conflictId)
			),
		requestAbandonConfirmation: (input, { context: { userId } }) =>
			run(userId, input.projectId, (scope) =>
				serveAbandonConfirmation(scope, confirmations, input.conflictId)
			),
		resolve(input, { context: { userId } }) {
			const { projectId, conflictId: _conflictId, ...body } = input;
			return run(userId, projectId, (scope) =>
				resolveOfflineConflict(scope, confirmations, input.conflictId, body)
			);
		},
	};
}
