import { createFileRoute } from "@tanstack/react-router";
import { MeasurementView } from "@/features/product-measurement/ui/views/measurement-view";

export const Route = createFileRoute("/_auth/measurements")({
	component: MeasurementView,
});
