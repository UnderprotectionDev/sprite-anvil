import { createFileRoute } from "@tanstack/react-router";
import { GodotOutputPanel } from "@/features/export-bundles/ui/components/godot-output-panel";
import { ExportBundleVerificationView } from "@/features/export-bundles/ui/views/export-bundle-verification-view";

export const Route = createFileRoute(
	"/_auth/projects_/$projectId/export-bundles"
)({ component: ExportBundlesRoute });

function ExportBundlesRoute() {
	const { projectId } = Route.useParams();
	return (
		<ExportBundleVerificationView>
			<GodotOutputPanel projectId={projectId} />
		</ExportBundleVerificationView>
	);
}
