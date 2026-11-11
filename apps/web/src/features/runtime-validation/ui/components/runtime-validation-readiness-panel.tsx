import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoadErrorAlert } from "@/components/load-error-alert";
import { orpc } from "@/utils/orpc";
import { blockerLabels } from "../../lib/runtime-validation-labels";

interface BundleChoice {
	createdAt: string;
	id: string;
	manifestDigest: string;
}

function TargetReadiness({
	bundleId,
	name,
	projectId,
	revisionId,
	revisionNumber,
}: {
	bundleId: string;
	name: string;
	projectId: string;
	revisionId: string;
	revisionNumber: number;
}) {
	const readiness = useQuery({
		...orpc.runtimeValidation.deliveryTargetReadiness.queryOptions({
			input: { bundleId, projectId, revisionId },
		}),
		meta: { suppressGlobalErrorToast: true },
	});
	return (
		<li className="space-y-2 rounded border p-3">
			<p className="font-medium">
				{name} · revision {revisionNumber}
			</p>
			{readiness.isPending ? (
				<p aria-live="polite" role="status">
					Checking runtime validation…
				</p>
			) : null}
			{readiness.isError ? (
				<LoadErrorAlert
					message="Runtime validation readiness could not be loaded."
					onRetry={() => void readiness.refetch()}
				/>
			) : null}
			{readiness.isSuccess ? (
				<>
					<p role="status">
						{readiness.data.ready
							? "Runtime validation satisfied for this Export Bundle."
							: "Blocked: runtime validation is not satisfied for this Export Bundle."}
					</p>
					<ul className="space-y-1 text-sm">
						{readiness.data.environments.map((entry) => (
							<li
								key={`${entry.environment.gameBuild}|${entry.environment.engineVersion}|${entry.environment.adapterVersion ?? ""}`}
							>
								<strong>
									{entry.environment.gameBuild} on{" "}
									{entry.environment.engineVersion}
									{entry.environment.adapterVersion
										? `, adapter ${entry.environment.adapterVersion}`
										: ""}
								</strong>
								{": "}
								{entry.blocker ? blockerLabels[entry.blocker] : "Current Pass."}
							</li>
						))}
					</ul>
				</>
			) : null}
		</li>
	);
}

/** Shows, per active Delivery Target revision that requires runtime validation, whether the chosen Export Bundle meets it and each blocker. */
export function RuntimeValidationReadinessPanel({
	bundles,
	projectId,
}: {
	bundles: BundleChoice[];
	projectId: string;
}) {
	const [bundleId, setBundleId] = useState(bundles[0]?.id ?? "");
	const catalog = useQuery({
		...orpc.deliveryPlanning.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	const requiring = (catalog.data?.deliveryTargets ?? []).flatMap((target) =>
		target.activeRevision?.runtimeValidationCriterion
			? [{ name: target.name, revision: target.activeRevision }]
			: []
	);
	if (catalog.isSuccess && requiring.length === 0) {
		return null;
	}
	return (
		<section
			aria-label="Delivery Target readiness"
			className="space-y-3 rounded-lg border p-4"
		>
			<h2 className="font-semibold text-xl">Delivery Target readiness</h2>
			<p className="text-muted-foreground text-sm">
				A Delivery Target that requires runtime validation is satisfied only by
				a current Pass you finalized for the exact Export Bundle and
				environment.
			</p>
			{catalog.isError ? (
				<LoadErrorAlert
					message="Delivery Targets could not be loaded."
					onRetry={() => void catalog.refetch()}
				/>
			) : null}
			<div className="space-y-2">
				<Label htmlFor="runtime-validation-readiness-bundle">
					Export Bundle
				</Label>
				<NativeSelect
					className="w-full [&>select]:min-h-10"
					id="runtime-validation-readiness-bundle"
					onChange={(event) => setBundleId(event.target.value)}
					value={bundleId}
				>
					{bundles.map((bundle) => (
						<NativeSelectOption key={bundle.id} value={bundle.id}>
							{`${new Date(bundle.createdAt).toLocaleString()} · ${bundle.manifestDigest.slice(0, 12)}`}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</div>
			<ul
				aria-label="Delivery Targets requiring runtime validation"
				className="space-y-2"
			>
				{requiring.map(({ name, revision }) => (
					<TargetReadiness
						bundleId={bundleId}
						key={revision.id}
						name={name}
						projectId={projectId}
						revisionId={revision.id}
						revisionNumber={revision.revisionNumber}
					/>
				))}
			</ul>
		</section>
	);
}
