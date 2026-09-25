import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { showErrorToast } from "./error-notification";

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (query.meta?.suppressGlobalErrorToast === true) {
					return;
				}
				showErrorToast(error, {
					kind: "query",
					onRetry: () => {
						void query.fetch().catch(() => undefined);
					},
				});
			},
		}),
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				if (mutation.meta?.suppressGlobalErrorToast === true) {
					return;
				}
				if (mutation.meta?.errorOperationKind === "query") {
					showErrorToast(error, {
						kind: "query",
						onRetry: () => {
							void mutation
								.execute(mutation.state.variables)
								.catch(() => undefined);
						},
					});
					return;
				}
				showErrorToast(error, { kind: "mutation" });
			},
		}),
	});
}

export const queryClient = createQueryClient();
