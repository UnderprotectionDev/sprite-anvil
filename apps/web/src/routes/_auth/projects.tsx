import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProjectsView } from "@/features/projects/ui/views/projects-view";

export const Route = createFileRoute("/_auth/projects")({
	validateSearch: z.object({
		selected: z.string().optional().catch(undefined),
	}),
	component: ProjectsView,
});
