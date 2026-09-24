import { createFileRoute } from "@tanstack/react-router";
import { ProjectsView } from "@/features/projects/ui/views/projects-view";

export const Route = createFileRoute("/_auth/projects")({
	component: ProjectsView,
});
