import type { Database } from "@sprite-anvil/db";
import { projectDeletionScopeSummary } from "@sprite-anvil/db/project-access";
import type {
	EnqueueRequest,
	OperationHandler,
} from "./features/background-operations/server/background-operation-lifecycle";
import { createBackgroundOperationLifecycle } from "./features/background-operations/server/background-operation-lifecycle";
import type {
	OperationStorage,
	OperationTransport,
} from "./features/background-operations/server/operation-storage";
import { PermanentOperationError } from "./features/background-operations/server/permanent-operation-error";
import { TransientOperationError } from "./features/background-operations/server/transient-operation-error";
import type { ErasureDeletionOperationsOptions } from "./features/permanent-erasure/server/erasure-deletion-operations";
import { createErasureDeletionOperations } from "./features/permanent-erasure/server/erasure-deletion-operations";
import type { ArchiveImportOptions } from "./features/project-archives/server/project-archive-import-operations";
import { createProjectArchiveImportOperations } from "./features/project-archives/server/project-archive-import-operations";
import type { ProjectArchiveOperationsOptions } from "./features/project-archives/server/project-archive-operations";
import { createProjectArchiveOperations } from "./features/project-archives/server/project-archive-operations";
import type { ProjectArchiveRestoreOperationsOptions } from "./features/project-archives/server/project-archive-restore-operations";
import { createProjectArchiveRestoreOperations } from "./features/project-archives/server/project-archive-restore-operations";
import { createRestoreOperationResultReader } from "./features/project-archives/server/restore-operation-result";
import type { ProjectDeletionServiceOptions } from "./features/projects/server/project-deletion-service";
import { createProjectDeletionService } from "./features/projects/server/project-deletion-service";

type ErasureOptions<T = ErasureDeletionOperationsOptions> =
	T extends ErasureDeletionOperationsOptions
		? Omit<T, "operations" | "permanentFailure" | "transientFailure">
		: never;

export function createManagedOperationServices(options: {
	db: Database;
	storage: OperationStorage;
	transport: OperationTransport;
	archiveOptions?: Omit<
		ProjectArchiveOperationsOptions,
		"operations" | "permanentFailure"
	>;
	restoreOptions?: Omit<
		ProjectArchiveRestoreOperationsOptions,
		"operations" | "permanentFailure"
	>;
	importOptions?: Omit<ArchiveImportOptions, "operations" | "permanentFailure">;
	erasureOptions?: ErasureOptions;
	projectDeletionOptions?: Omit<
		ProjectDeletionServiceOptions,
		"permanentFailure" | "operationStorage"
	>;
}) {
	let lifecycle: ReturnType<typeof createBackgroundOperationLifecycle>;
	const operations = {
		enqueue: (request: EnqueueRequest) => lifecycle.enqueue(request),
	};
	const permanentFailure = (message: string) =>
		new PermanentOperationError(message);
	const archive =
		options.archiveOptions &&
		createProjectArchiveOperations(options.db, {
			...options.archiveOptions,
			operations,
			permanentFailure,
		});
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
	const projectDeletion =
		options.projectDeletionOptions &&
		createProjectDeletionService({
			...options.projectDeletionOptions,
			permanentFailure,
			operationStorage: options.storage,
		});
	const handlers: Partial<
		Record<"archive" | "restore" | "deletion", OperationHandler>
	> = {};
	if (archive) {
		handlers.archive = archive.execute;
	}
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
	if (erasure || projectDeletion) {
		handlers.deletion = (context) => {
			if (context.operation.scopeSummary === projectDeletionScopeSummary) {
				if (!projectDeletion) {
					throw permanentFailure("Project deletion service unavailable.");
				}
				return projectDeletion.execute(context);
			}
			if (!erasure) {
				throw permanentFailure("Asset erasure service unavailable.");
			}
			return erasure.execute(context);
		};
	}
	lifecycle = createBackgroundOperationLifecycle({
		storage: options.storage,
		transport: options.transport,
		handlers,
	});
	const resultStore = options.restoreOptions?.store;
	return {
		lifecycle,
		projectArchiveOperations: archive,
		projectDeletion,
		projectArchiveRestoreOperations: restore,
		projectArchiveRestoreResult: resultStore
			? createRestoreOperationResultReader({
					managedRequests: options.restoreOptions?.requests,
					importRequests: options.importOptions?.requests,
					store: resultStore,
				})
			: undefined,
		projectArchiveImportOperations: archiveImport,
		erasureApprovalOperations: erasure,
	};
}
