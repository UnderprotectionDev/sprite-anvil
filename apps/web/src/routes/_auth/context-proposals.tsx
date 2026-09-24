import { createFileRoute } from "@tanstack/react-router";
import { ContextProposalsView } from "@/features/project-context/ui/views/context-proposals-view";

export const Route = createFileRoute("/_auth/context-proposals")({
	component: ContextProposalsView,
});
