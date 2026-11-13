import {
	buildDeliveryChangePackage,
	renderDeliveryChangePackage,
} from "@sprite-anvil/api/delivery-change-package";
import type { DeliveryRefreshDecisionKind } from "@sprite-anvil/api/delivery-refresh-classification";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { useIdempotencyKey } from "../../hooks/use-idempotency-key";
import { useRefreshDelivery } from "../../hooks/use-refresh-delivery";
import { useRefreshReview } from "../../hooks/use-refresh-review";
import { directoryAttributes } from "../../lib/directory-attributes";
import { downloadJson } from "../../lib/download-text";
import {
	type ChosenFolder,
	chooseFolder,
	readWrittenFiles,
} from "../../lib/read-target-folder";
import { refreshSummary } from "../../lib/refresh-summary";
import { refreshFormSchema } from "../../schemas";
import { PathClassSections } from "../components/path-class-sections";
import { RefreshResultPanel } from "../components/refresh-result-panel";

/** Refreshes a destination from a new bundle: review the classes, decide diverged paths, record the result. */
export function RefreshDeliveryForm({ projectId }: { projectId: string }) {
	const [recordError, setRecordError] = useState<string | null>(null);
	const refresh = useRefreshDelivery(projectId);
	const locks = useQuery({
		...orpc.deliveryRefreshLocks.list.queryOptions({ input: { projectId } }),
		...mutationMeta,
	});
	const bundles = useQuery({
		...orpc.exportBundles.list.queryOptions({ input: { projectId } }),
		...mutationMeta,
	});

	const form = useForm({
		defaultValues: {
			bundleId: "",
			decided: {} as Record<string, DeliveryRefreshDecisionKind>,
			lockId: "",
			target: null as ChosenFolder | null,
			updated: null as ChosenFolder | null,
			viewed: {} as Record<string, boolean>,
		},
		onSubmit: async ({ value }) => {
			if (!(review.plan && review.observation && value.updated)) {
				return;
			}
			setRecordError(null);
			try {
				const { written } = await readWrittenFiles(
					value.updated.files,
					review.plan.applied
				);
				refresh.mutate({
					bundleId: value.bundleId,
					decisions: review.decisions,
					idempotencyKey,
					observed: review.observation,
					previousLockId: value.lockId,
					projectId,
					written,
				});
			} catch (error) {
				setRecordError(
					`The updated folder could not be read: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
		},
		validators: { onSubmit: refreshFormSchema },
	});
	const values = useStore(form.store, (state) => state.values);
	const review = useRefreshReview({
		bundleId: values.bundleId,
		decided: values.decided,
		lockId: values.lockId,
		projectId,
		target: values.target,
		viewed: values.viewed,
	});
	const { bundle, classification, contract, decisions, lock, plan } = review;
	const idempotencyKey = useIdempotencyKey(
		JSON.stringify([
			values.lockId,
			values.bundleId,
			values.target?.token,
			values.updated?.token,
			decisions,
		])
	);

	function startOver() {
		form.setFieldValue("decided", {});
		form.setFieldValue("viewed", {});
		setRecordError(null);
		refresh.reset();
	}

	function downloadPackage() {
		if (!(lock && bundle && classification)) {
			return;
		}
		downloadJson(
			renderDeliveryChangePackage(
				buildDeliveryChangePackage({
					bundle: {
						bundleId: bundle.id,
						bundleManifestDigest: bundle.manifestDigest,
						files: bundle.files,
						profileId: bundle.profileId,
						profileRevisionId: bundle.profileRevisionId,
					},
					classification,
					decisions,
					previous: lock,
				})
			),
			"delivery-change-package.json"
		);
	}

	const submit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};

	return (
		<form
			aria-label="Refresh a destination"
			className="space-y-6"
			onSubmit={submit}
		>
			<h2 className="font-semibold text-lg">Refresh a destination</h2>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1 text-sm">
					<Label htmlFor="previous-lock">Previous lock</Label>
					<form.Field name="lockId">
						{(field) => (
							<NativeSelect
								className="w-full"
								id="previous-lock"
								onChange={(event) => {
									field.handleChange(event.target.value);
									startOver();
								}}
								value={field.state.value}
							>
								<NativeSelectOption value="">Choose a lock</NativeSelectOption>
								{locks.data?.locks.map((entry) => (
									<NativeSelectOption key={entry.id} value={entry.id}>
										{entry.destinationLabel} (locked{" "}
										{entry.createdAt.slice(0, 10)})
									</NativeSelectOption>
								))}
							</NativeSelect>
						)}
					</form.Field>
				</div>
				<div className="space-y-1 text-sm">
					<Label htmlFor="new-bundle">New Export Bundle</Label>
					<form.Field name="bundleId">
						{(field) => (
							<NativeSelect
								className="w-full"
								id="new-bundle"
								onChange={(event) => {
									field.handleChange(event.target.value);
									startOver();
								}}
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Choose a bundle
								</NativeSelectOption>
								{bundles.data?.bundles.map((entry) => (
									<NativeSelectOption key={entry.id} value={entry.id}>
										Bundle created {entry.createdAt.slice(0, 10)}
									</NativeSelectOption>
								))}
							</NativeSelect>
						)}
					</form.Field>
				</div>
			</div>
			<div className="space-y-1 text-sm">
				<Label htmlFor="destination-folder">Destination folder</Label>
				<form.Field name="target">
					{(field) => (
						<Input
							{...directoryAttributes}
							id="destination-folder"
							multiple
							onChange={(event) => {
								field.handleChange(
									chooseFolder([...(event.target.files ?? [])])
								);
								startOver();
							}}
							type="file"
						/>
					)}
				</form.Field>
				<p className="text-muted-foreground text-xs">
					Only the paths the lock and the bundle name are read, on this device.
				</p>
			</div>

			{contract && !contract.ok ? (
				<StatusMessage tone="error">
					{contract.reason === "unsupported_major"
						? `This lock uses contract version ${lock?.contractVersion}, which this build cannot refresh from. The refresh is stopped.`
						: "This lock is missing a required field or a full contract version and cannot be refreshed from. The refresh is stopped."}
				</StatusMessage>
			) : null}

			{classification && plan ? (
				<div className="space-y-4">
					<p aria-live="polite" role="status">
						{refreshSummary(plan)}
					</p>
					<PathClassSections
						bundleTexts={
							new Map(bundle?.files.map((file) => [file.path, file.content]))
						}
						classification={classification}
						decided={values.decided}
						onDecide={(path, kind) =>
							form.setFieldValue("decided", (current) => ({
								...current,
								[path]: kind,
							}))
						}
						onShowDiff={(path) =>
							form.setFieldValue("viewed", (current) => ({
								...current,
								[path]: true,
							}))
						}
						target={values.target}
						viewed={values.viewed}
					/>

					<div className="space-y-3 border-t pt-4">
						<Button
							className="min-h-11"
							onClick={downloadPackage}
							type="button"
							variant="outline"
						>
							Download change package
						</Button>
						<p className="text-muted-foreground text-xs">
							A JSON file with the proposed lock and the divergence report. It
							holds no files and nothing executable; copy the listed files from
							the bundle yourself.
						</p>
						<div className="space-y-1 text-sm">
							<Label htmlFor="updated-folder">Updated destination folder</Label>
							<form.Field name="updated">
								{(field) => (
									<Input
										{...directoryAttributes}
										id="updated-folder"
										multiple
										onChange={(event) => {
											field.handleChange(
												chooseFolder([...(event.target.files ?? [])])
											);
											setRecordError(null);
											refresh.reset();
										}}
										type="file"
									/>
								)}
							</form.Field>
						</div>
						<Button
							className="min-h-11"
							disabled={values.updated === null || refresh.isPending}
							type="submit"
						>
							Record refresh
						</Button>
					</div>
					{recordError ? (
						<StatusMessage tone="error">{recordError}</StatusMessage>
					) : null}
					{refresh.error ? (
						<StatusMessage tone="error">{refresh.error.message}</StatusMessage>
					) : null}
					{refresh.data ? <RefreshResultPanel result={refresh.data} /> : null}
				</div>
			) : null}
		</form>
	);
}
