import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { LoadErrorAlert } from "@/components/load-error-alert";
import { errorCodeOf } from "@/utils/error-code";
import { getSupportReference } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import { ReadinessPlanPanel } from "../components/readiness-plan-panel";

function NoActiveRevision({ name }: { name: string }) {
	return (
		<p className="text-muted-foreground">
			{name} has no activated revision, so it has no Readiness Plan yet.
			Activate a draft revision first.
		</p>
	);
}

function PlanSection({
	deliveryTargetId,
	name,
	projectId,
}: {
	deliveryTargetId: string;
	name: string;
	projectId: string;
}) {
	const query = useQuery({
		...orpc.readinessPlans.get.queryOptions({
			input: { deliveryTargetId, projectId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	if (query.isPending) {
		return (
			<p aria-live="polite" role="status">
				Loading Readiness Plan…
			</p>
		);
	}
	if (query.isError) {
		const code = errorCodeOf(query.error);
		if (code === "CONFLICT") {
			return <NoActiveRevision name={name} />;
		}
		return (
			<LoadErrorAlert
				message={
					code === "NOT_FOUND"
						? "This Delivery Target was not found."
						: "The Readiness Plan could not be loaded."
				}
				onRetry={() => void query.refetch()}
				supportReference={getSupportReference(query.error)}
			/>
		);
	}
	return (
		<ReadinessPlanPanel
			onReload={() => void query.refetch()}
			plan={query.data}
			projectId={projectId}
		/>
	);
}

export function ReadinessPlanView({
	deliveryTargetId,
	onSelectTarget,
	projectId,
}: {
	deliveryTargetId: string | undefined;
	onSelectTarget: (deliveryTargetId: string) => void;
	projectId: string;
}) {
	const catalog = useQuery({
		...orpc.deliveryPlanning.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const targets = catalog.data?.deliveryTargets ?? [];
	const selected =
		targets.find((target) => target.id === deliveryTargetId) ??
		targets.find((target) => target.activeRevision !== null) ??
		targets[0];

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Readiness Plan</h1>
				<p className="text-muted-foreground text-sm">
					What stands between a Delivery Target and Ready, and the work each fix
					opens. The plan explains; it does not start production, approve, or
					activate anything.
				</p>
			</header>
			{catalog.isPending ? (
				<p aria-live="polite" role="status">
					Loading Delivery Targets…
				</p>
			) : null}
			{catalog.isError ? (
				<LoadErrorAlert
					message="Delivery Targets could not be loaded."
					onRetry={() => void catalog.refetch()}
					supportReference={getSupportReference(catalog.error)}
				/>
			) : null}
			{catalog.isSuccess && !selected ? (
				<p className="text-muted-foreground">
					This project has no Delivery Targets yet.
				</p>
			) : null}
			{selected ? (
				<div className="space-y-6">
					<label className="block max-w-sm space-y-1 text-sm" htmlFor="target">
						<span className="font-medium">Delivery Target</span>
						<NativeSelect
							className="w-full"
							id="target"
							onChange={(event) => onSelectTarget(event.target.value)}
							value={selected.id}
						>
							{targets.map((target) => (
								<NativeSelectOption key={target.id} value={target.id}>
									{target.name}
									{target.activeRevision
										? ` (revision ${target.activeRevision.revisionNumber})`
										: " (not activated)"}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</label>
					{selected.activeRevision ? (
						<PlanSection
							deliveryTargetId={selected.id}
							name={selected.name}
							projectId={projectId}
						/>
					) : (
						<NoActiveRevision name={selected.name} />
					)}
				</div>
			) : null}
		</main>
	);
}
