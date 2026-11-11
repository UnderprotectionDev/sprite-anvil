import { FirstApplyForm } from "../forms/first-apply-form";
import { RefreshDeliveryForm } from "../forms/refresh-delivery-form";

export function DeliveryRefreshView({ projectId }: { projectId: string }) {
	return (
		<main className="mx-auto w-full max-w-3xl space-y-10 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Delivery Refresh</h1>
				<p className="text-muted-foreground text-sm">
					Deliver an Export Bundle to a destination folder, then refresh it from
					a new bundle. Only files the previous Delivery Refresh Lock owns are
					compared; files Sprite Anvil did not write are never read, changed or
					deleted. A refresh is one-way, starts only when you ask, and never
					changes the previous lock or its bundle.
				</p>
			</header>
			<FirstApplyForm projectId={projectId} />
			<RefreshDeliveryForm projectId={projectId} />
		</main>
	);
}
