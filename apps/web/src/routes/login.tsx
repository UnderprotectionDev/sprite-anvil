import { createFileRoute } from "@tanstack/react-router";
import { LoginView } from "@/features/account-access/ui/views/login-view";

export const Route = createFileRoute("/login")({
	component: LoginView,
});
