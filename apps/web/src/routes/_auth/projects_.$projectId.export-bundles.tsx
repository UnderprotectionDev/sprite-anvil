import { createFileRoute } from "@tanstack/react-router";
import { ExportBundleVerificationView } from "@/features/export-bundles/ui/views/export-bundle-verification-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/export-bundles"
)({ component: ExportBundleVerificationView });
