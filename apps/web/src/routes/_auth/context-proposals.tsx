import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContextProposalsView } from "@/features/project-context/ui/views/context-proposals-view";

export const Route = createFileRoute("/_auth/context-proposals")({
	validateSearch: z.object({ projectId: z.string().optional() }),
	component: ContextProposalsView,
});
