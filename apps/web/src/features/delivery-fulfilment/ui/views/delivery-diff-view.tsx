import type { DeliveryFulfilment } from "@sprite-anvil/api/delivery-fulfilment-records";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { LoadErrorAlert } from "@/components/load-error-alert";
import { getSupportReference } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import { shortId } from "../../lib/short-id";
import { DeliveryDiffPanel } from "../components/delivery-diff-panel";

const fulfilmentLabel = (fulfilment: DeliveryFulfilment) =>
	`Revision ${fulfilment.revisionNumber} · ${new Date(fulfilment.createdAt).toLocaleString()} · ${shortId(fulfilment.id)}${fulfilment.isCurrent ? " (current)" : ""}`;

function FulfilmentSelect({
	fulfilments,
	label,
	onChange,
	value,
}: {
	fulfilments: DeliveryFulfilment[];
	label: string;
	onChange: (id: string) => void;
	value: string;
}) {
	const id = useId();
	return (
		<div className="space-y-1 text-sm">
			<label className="block font-medium" htmlFor={id}>
				{label}
			</label>
			<NativeSelect
				className="w-full"
				id={id}
				onChange={(event) => onChange(event.target.value)}
				value={value}
			>
				<NativeSelectOption value="">Select a Fulfilment</NativeSelectOption>
				{fulfilments.map((fulfilment) => (
					<NativeSelectOption key={fulfilment.id} value={fulfilment.id}>
						{fulfilmentLabel(fulfilment)}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</div>
	);
}

function Comparison({
	fromFulfilmentId,
	projectId,
	toFulfilmentId,
}: {
	fromFulfilmentId: string;
	projectId: string;
	toFulfilmentId: string;
}) {
	const comparison = useQuery({
		...orpc.deliveryFulfilment.compareFulfilments.queryOptions({
			input: { fromFulfilmentId, projectId, toFulfilmentId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	if (comparison.isPending) {
		return (
			<p aria-live="polite" role="status">
				Comparing Delivery Fulfilments…
			</p>
		);
	}
	if (comparison.isError) {
		return (
			<LoadErrorAlert
				message="The comparison could not be loaded."
				onRetry={() => void comparison.refetch()}
				supportReference={getSupportReference(comparison.error)}
			/>
		);
	}
	return <DeliveryDiffPanel diff={comparison.data} />;
}

function TargetComparison({
	deliveryTargetId,
	projectId,
}: {
	deliveryTargetId: string;
	projectId: string;
}) {
	const fulfilments = useQuery({
		...orpc.deliveryFulfilment.listFulfilments.queryOptions({
			input: { deliveryTargetId, projectId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	const [fromId, setFromId] = useState("");
	const [toId, setToId] = useState("");

	if (fulfilments.isPending) {
		return (
			<p aria-live="polite" role="status">
				Loading Delivery Fulfilments…
			</p>
		);
	}
	if (fulfilments.isError) {
		return (
			<LoadErrorAlert
				message="Delivery Fulfilments could not be loaded."
				onRetry={() => void fulfilments.refetch()}
				supportReference={getSupportReference(fulfilments.error)}
			/>
		);
	}
	const list = fulfilments.data.fulfilments;
	if (list.length < 2) {
		return (
			<p className="text-muted-foreground">
				This Delivery Target has fewer than two Delivery Fulfilments, so there
				is nothing to compare yet.
			</p>
		);
	}
	const ready = fromId !== "" && toId !== "" && fromId !== toId;
	let hint = "Pick two Delivery Fulfilments to compare.";
	if (fromId !== "" && fromId === toId) {
		hint = "Pick two different Delivery Fulfilments to compare.";
	}
	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2">
				<FulfilmentSelect
					fulfilments={list}
					label="Compare from"
					onChange={setFromId}
					value={fromId}
				/>
				<FulfilmentSelect
					fulfilments={list}
					label="Compare to"
					onChange={setToId}
					value={toId}
				/>
			</div>
			{ready ? (
				<Comparison
					fromFulfilmentId={fromId}
					projectId={projectId}
					toFulfilmentId={toId}
				/>
			) : (
				<p className="text-muted-foreground">{hint}</p>
			)}
		</div>
	);
}

export function DeliveryDiffView({
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
		targets.find((target) => target.id === deliveryTargetId) ?? targets[0];

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Delivery Diff</h1>
				<p className="text-muted-foreground text-sm">
					Compares two immutable Delivery Fulfilments of a Delivery Target.
					Comparing is read-only: it creates no Delivery Fulfilment and never
					changes a Delivered status.
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
					<div className="max-w-sm space-y-1 text-sm">
						<label className="block font-medium" htmlFor="delivery-target">
							Delivery Target
						</label>
						<NativeSelect
							className="w-full"
							id="delivery-target"
							onChange={(event) => onSelectTarget(event.target.value)}
							value={selected.id}
						>
							{targets.map((target) => (
								<NativeSelectOption key={target.id} value={target.id}>
									{target.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
					<TargetComparison
						deliveryTargetId={selected.id}
						key={selected.id}
						projectId={projectId}
					/>
				</div>
			) : null}
		</main>
	);
}
