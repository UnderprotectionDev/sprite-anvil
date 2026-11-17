import { createFileRoute } from "@tanstack/react-router";
import { ExportCreationPanel } from "@/features/export-bundles/ui/components/export-creation-panel";
import { GodotOutputPanel } from "@/features/export-bundles/ui/components/godot-output-panel";
import { ExportBundleVerificationView } from "@/features/export-bundles/ui/views/export-bundle-verification-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/export-bundles"
)({ component: ExportBundlesRoute });

function ExportBundlesRoute() {
	const { projectId } = Route.useParams();
	return (
		<ExportBundleVerificationView projectId={projectId}>
			<ExportCreationPanel projectId={projectId} />
			<GodotOutputPanel projectId={projectId} />
		</ExportBundleVerificationView>
	);
}
