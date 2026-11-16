import type { Database } from "@sprite-anvil/db";
import {
	createBackgroundOperationLifecycle,
	type EnqueueRequest,
	type OperationHandler,
	PermanentOperationError,
	TransientOperationError,
} from "./features/background-operations/server/background-operation-lifecycle";
import type {
	OperationStorage,
	OperationTransport,
} from "./features/background-operations/server/operation-storage";
import {
	createErasureDeletionOperations,
	type ErasureDeletionOperationsOptions,
} from "./features/permanent-erasure/server/erasure-deletion-operations";
import {
	type ArchiveImportOptions,
	createProjectArchiveImportOperations,
} from "./features/project-archives/server/project-archive-import-operations";
import {
	createProjectArchiveRestoreOperations,
	type ProjectArchiveRestoreOperationsOptions,
} from "./features/project-archives/server/project-archive-restore-operations";

type ErasureOptions<T = ErasureDeletionOperationsOptions> =
	T extends ErasureDeletionOperationsOptions
		? Omit<T, "operations" | "permanentFailure" | "transientFailure">
		: never;

export function createManagedOperationServices(options: {
	db: Database;
	storage: OperationStorage;
	transport: OperationTransport;
	restoreOptions?: Omit<
		ProjectArchiveRestoreOperationsOptions,
		"operations" | "permanentFailure"
	>;
	importOptions?: Omit<ArchiveImportOptions, "operations" | "permanentFailure">;
	erasureOptions?: ErasureOptions;
}) {
	let lifecycle: ReturnType<typeof createBackgroundOperationLifecycle>;
	const operations = {
		enqueue: (request: EnqueueRequest) => lifecycle.enqueue(request),
	};
	const permanentFailure = (message: string) =>
		new PermanentOperationError(message);
	const restore =
		options.restoreOptions &&
		createProjectArchiveRestoreOperations(options.db, {
			...options.restoreOptions,
			operations,
			permanentFailure,
		});
	const archiveImport =
		options.importOptions &&
		createProjectArchiveImportOperations(options.db, {
			...options.importOptions,
			operations,
			permanentFailure,
		});
	const erasure =
		options.erasureOptions &&
		createErasureDeletionOperations({
			...options.erasureOptions,
			operations,
			permanentFailure,
			transientFailure: (message) => new TransientOperationError(message),
		});
	const handlers: Partial<Record<"restore" | "deletion", OperationHandler>> =
		{};
	if (restore || archiveImport) {
		handlers.restore = async (context) => {
			const { operation } = context;
			const importRequest =
				operation.scopeTargetId &&
				options.importOptions &&
				(await options.importOptions.requests.find(
					operation.projectId,
					operation.scopeTargetId
				));
			if (importRequest && archiveImport) {
				return archiveImport.execute(context);
			}
			if (restore) {
				return restore.execute(context);
			}
			throw permanentFailure("Restore request not found.");
		};
	}
	if (erasure) {
		handlers.deletion = erasure.execute;
	}
	lifecycle = createBackgroundOperationLifecycle({
		storage: options.storage,
		transport: options.transport,
		handlers,
	});
	return {
		lifecycle,
		projectArchiveRestoreOperations: restore,
		projectArchiveImportOperations: archiveImport,
		erasureApprovalOperations: erasure,
	};
}
