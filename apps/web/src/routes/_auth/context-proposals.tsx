import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ContextProposalsView } from "@/features/project-context/ui/views/context-proposals-view";

export const Route = createFileRoute("/_auth/context-proposals")({
	validateSearch: z.object({ projectId: z.string().optional() }),
	loaderDeps: ({ search }) => ({ projectId: search.projectId }),
	loader: async ({ context, deps }) => {
		if (deps.projectId !== undefined || !context.queryClient) {
			return;
		}
		const projects = await context.queryClient
			.ensureQueryData(context.orpc.projectContexts.list.queryOptions())
			.catch(() => undefined);
		const projectId = projects?.[0]?.id;
		if (projectId) {
			throw redirect({
				to: "/context-proposals",
				search: { projectId },
				replace: true,
			});
		}
	},
	component: ContextProposalsView,
});
