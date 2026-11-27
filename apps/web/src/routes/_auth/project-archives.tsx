import { createFileRoute } from "@tanstack/react-router";
import { AccountProjectArchivesView } from "@/features/project-archives/ui/views/account-project-archives-view";

export const Route = createFileRoute("/_auth/project-archives")({
	component: AccountProjectArchivesView,
});
