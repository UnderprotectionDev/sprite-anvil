import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { DeliveryTargetCard } from "../components/delivery-target-card";
import { DeliveryTargetFormLoader } from "../components/delivery-target-form-loader";

type FormState =
	| { kind: "closed" }
	| { kind: "new" }
	| { kind: "revision"; targetId: string };

export function DeliveryTargetsView({ projectId }: { projectId: string }) {
	const catalog = useQuery({
		...orpc.deliveryPlanning.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const [formState, setFormState] = useState<FormState>({ kind: "closed" });
	const targets = catalog.data?.deliveryTargets ?? [];
	const revisingTarget =
		formState.kind === "revision"
			? (targets.find((target) => target.id === formState.targetId) ?? null)
			: null;
	const close = () => setFormState({ kind: "closed" });

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Delivery Targets</h1>
				<p className="text-muted-foreground text-sm">
					A Delivery Target pins what a delivery needs across several Asset
					Families: the Context Revision, each family's Required Items List
					revision, usage tests, and the Production Evidence and Rights Evidence
					policies. Activating a revision does not change Target Readiness and
					never replaces a family's Required Items List.
				</p>
				<Button
					className="min-h-11"
					disabled={formState.kind !== "closed"}
					onClick={() => setFormState({ kind: "new" })}
					type="button"
				>
					New Delivery Target
				</Button>
			</header>

			{formState.kind === "new" ? (
				<DeliveryTargetFormLoader
					onClose={close}
					projectId={projectId}
					target={null}
				/>
			) : null}
			{formState.kind === "revision" && revisingTarget ? (
				<DeliveryTargetFormLoader
					key={revisingTarget.id}
					onClose={close}
					projectId={projectId}
					target={revisingTarget}
				/>
			) : null}

			{catalog.isPending ? (
				<p aria-live="polite" role="status">
					Loading Delivery Targets…
				</p>
			) : null}
			{catalog.isError ? (
				<div className="space-y-2" role="alert">
					<p>Delivery Targets could not be loaded.</p>
					<Button
						className="min-h-11"
						onClick={() => void catalog.refetch()}
						type="button"
						variant="outline"
					>
						Retry
					</Button>
				</div>
			) : null}
			{catalog.isSuccess && targets.length === 0 ? (
				<p className="text-muted-foreground">
					This project has no Delivery Targets yet.
				</p>
			) : null}
			<div className="space-y-6">
				{targets.map((target) => (
					<DeliveryTargetCard
						key={target.id}
						onNewRevision={() =>
							setFormState({ kind: "revision", targetId: target.id })
						}
						projectId={projectId}
						target={target}
					/>
				))}
			</div>
		</main>
	);
}
