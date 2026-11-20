import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { showErrorToast } from "./error-notification";

export function createQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (query.meta?.errorPresentation === "inline") {
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
				if (mutation.meta?.errorPresentation === "inline") {
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

let privateSession:
	| { client: QueryClient; sessionId: string; userId: string }
	| undefined;

export function resetSessionQueryClient() {
	privateSession?.client.clear();
	privateSession = undefined;
}

export function getSessionQueryClient(userId: string, sessionId: string) {
	if (
		privateSession?.userId === userId &&
		privateSession.sessionId === sessionId
	) {
		return privateSession.client;
	}
	resetSessionQueryClient();
	const client = createQueryClient();
	privateSession = { client, sessionId, userId };
	return client;
}
