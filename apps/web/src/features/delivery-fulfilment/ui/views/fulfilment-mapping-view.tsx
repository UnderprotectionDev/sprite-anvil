import { Button } from "@sprite-anvil/ui/components/button";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { LoadErrorAlert } from "@/components/load-error-alert";
import { orpc } from "@/utils/orpc";
import { useIdempotentSubmit } from "../../hooks/use-idempotent-submit";
import { usePrepareFulfilmentMapping } from "../../hooks/use-prepare-fulfilment-mapping";
import { DeliveryFulfilmentList } from "../components/delivery-fulfilment-list";
import { FulfilmentMappingDraftPanel } from "../components/fulfilment-mapping-draft";
import { HistoricalRiskNoticeList } from "../components/historical-risk-notice-list";
import { FulfilmentFinalizeForm } from "../forms/fulfilment-finalize-form";

function TargetMapping({
	deliveryTargetId,
	name,
	projectId,
}: {
	deliveryTargetId: string;
	name: string;
	projectId: string;
}) {
	const drafts = useQuery({
		...orpc.deliveryFulfilment.listMappings.queryOptions({
			input: { deliveryTargetId, projectId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	const fulfilments = useQuery({
		...orpc.deliveryFulfilment.listFulfilments.queryOptions({
			input: { deliveryTargetId, projectId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	const notices = useQuery({
		...orpc.historicalRiskNotices.list.queryOptions({
			input: { deliveryTargetId, projectId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	const prepare = usePrepareFulfilmentMapping();
	const { failure, submit } = useIdempotentSubmit(
		`The mapping for ${name} could not be prepared. Try again.`
	);
	const latest = drafts.data?.drafts[0];

	const onPrepare = () =>
		submit((idempotencyKey) =>
			prepare.mutateAsync({ deliveryTargetId, idempotencyKey, projectId })
		);

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<Button
					className="min-h-11"
					disabled={prepare.isPending}
					onClick={() => void onPrepare()}
					type="button"
				>
					Prepare mapping
				</Button>
				{failure ? <p role="alert">{failure}</p> : null}
			</div>
			{drafts.isPending ? (
				<p aria-live="polite" role="status">
					Loading mapping drafts…
				</p>
			) : null}
			{drafts.isError ? (
				<LoadErrorAlert
					message="Mapping drafts could not be loaded."
					onRetry={() => void drafts.refetch()}
				/>
			) : null}
			{drafts.isSuccess && !latest ? (
				<p className="text-muted-foreground">
					No mapping has been prepared for {name} yet.
				</p>
			) : null}
			{latest ? (
				<>
					<FulfilmentMappingDraftPanel draft={latest} />
					<FulfilmentFinalizeForm
						deliveryTargetId={deliveryTargetId}
						draft={latest}
						key={latest.id}
					/>
				</>
			) : null}
			<section aria-label="Delivery Fulfilments" className="space-y-3">
				<h2 className="font-semibold text-lg">Delivery Fulfilments</h2>
				{fulfilments.isPending ? (
					<p aria-live="polite" role="status">
						Loading Delivery Fulfilments…
					</p>
				) : null}
				{fulfilments.isError ? (
					<LoadErrorAlert
						message="Delivery Fulfilments could not be loaded."
						onRetry={() => void fulfilments.refetch()}
					/>
				) : null}
				{fulfilments.isSuccess ? (
					<DeliveryFulfilmentList fulfilments={fulfilments.data.fulfilments} />
				) : null}
			</section>
			<section aria-label="Historical Risk Notices" className="space-y-3">
				<h2 className="font-semibold text-lg">Historical Risk Notices</h2>
				{notices.isPending ? (
					<p aria-live="polite" role="status">
						Loading Historical Risk Notices…
					</p>
				) : null}
				{notices.isError ? (
					<LoadErrorAlert
						message="Historical Risk Notices could not be loaded."
						onRetry={() => void notices.refetch()}
					/>
				) : null}
				{notices.isSuccess ? (
					<HistoricalRiskNoticeList notices={notices.data.notices} />
				) : null}
			</section>
		</div>
	);
}

export function FulfilmentMappingView({
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
				<h1 className="font-semibold text-2xl">Fulfilment mapping</h1>
				<p className="text-muted-foreground text-sm">
					Maps each required item of a Ready Delivery Target to the exact Export
					Bundles and Asset Versions that meet it. Missing and conflicting items
					are shown; the system proposes, only you pick between conflicting
					bundles.
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
						<TargetMapping
							deliveryTargetId={selected.id}
							name={selected.name}
							projectId={projectId}
						/>
					) : (
						<p className="text-muted-foreground">
							{selected.name} has no activated revision, so there is nothing to
							map. Activate a draft revision first.
						</p>
					)}
				</div>
			) : null}
		</main>
	);
}
