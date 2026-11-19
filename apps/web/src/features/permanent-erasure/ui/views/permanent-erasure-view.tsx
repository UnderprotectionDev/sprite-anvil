import { Button } from "@sprite-anvil/ui/components/button";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { createStore } from "@tanstack/store";
import { useCallback, useRef, useState } from "react";
import { orpc } from "@/utils/orpc";
import { ErasureApprovalPanel } from "../components/erasure-approval-panel";

export function PermanentErasureView({ projectId }: { projectId: string }) {
	const [lockStore] = useState(() => createStore(false));
	const writeLocked = useSelector(lockStore, (locked) => locked);
	const onWriteLockChange = useCallback(
		(locked: boolean) => {
			lockStore.setState((previous) =>
				previous === locked ? previous : locked
			);
		},
		[lockStore]
	);
	const records = useQuery(
		orpc.assetRecords.list.queryOptions({ input: { projectId } })
	);
	const key = useRef<{ input: string; key: string } | null>(null);
	const prepare = useMutation({
		...orpc.permanentErasure.prepareImpactReport.mutationOptions(),
		onSuccess: () => {
			key.current = null;
		},
	});
	const form = useForm({
		defaultValues: { assetRecordId: "" },
		onSubmit: ({ value }) => {
			if (lockStore.state || !value.assetRecordId) {
				return;
			}
			const input = `${projectId}:${value.assetRecordId}`;
			if (key.current?.input !== input) {
				key.current = { input, key: crypto.randomUUID() };
			}
			prepare.mutate({
				projectId,
				assetRecordId: value.assetRecordId,
				idempotencyKey: key.current.key,
			});
		},
	});
	const report = prepare.data?.report;
	return (
		<main>
			<h1>Permanent Erasure</h1>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="assetRecordId">
					{(field) => (
						<>
							<label htmlFor="erasure-asset">Asset Record</label>
							<NativeSelect
								disabled={prepare.isPending || writeLocked}
								id="erasure-asset"
								onBlur={field.handleBlur}
								onChange={(event) => {
									field.handleChange(event.target.value);
									key.current = null;
									prepare.reset();
								}}
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Select an Asset Record
								</NativeSelectOption>
								{records.data?.map((record) => (
									<NativeSelectOption key={record.id} value={record.id}>
										{record.name}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</>
					)}
				</form.Field>
				<Button disabled={prepare.isPending || writeLocked} type="submit">
					Prepare Erasure Impact Report
				</Button>
			</form>
			{!!records.isLoading && <p>Loading Asset Records…</p>}
			{!!records.error && <p role="alert">{records.error.message}</p>}
			{!!prepare.error && <p role="alert">{prepare.error.message}</p>}
			{!!report && (
				<section>
					<h2>Erasure Impact Report</h2>
					<h3>Counts</h3>
					<p>
						Managed copies: {report.counts.managedCopies}. Export Bundles:{" "}
						{report.counts.bundles}. Project Archives: {report.counts.archives}.
						Container files: {report.counts.containerFiles}. Delivery
						Fulfilments: {report.counts.fulfilments}.
					</p>
					<h3>Managed copies</h3>
					{report.managedCopies.length === 0 ? (
						<p>None.</p>
					) : (
						<ul>
							{report.managedCopies.map((copy) => (
								<li key={copy.assetVersionId}>
									Asset Version {copy.assetVersionId}: {copy.byteSize} bytes;
									SHA-256 {copy.sha256}
								</li>
							))}
						</ul>
					)}
					<h3>Dependent containers</h3>
					<p>Each container is removed whole or remains unchanged.</p>
					{report.containers.length === 0 ? (
						<p>None.</p>
					) : (
						<ul>
							{report.containers.map((container) => (
								<li key={`${container.kind}:${container.id}`}>
									{container.kind === "export_bundle"
										? "Export Bundle"
										: "Project Archive"}{" "}
									{container.id}: {container.embeddedFileCount} files; Asset
									Versions {container.embeddedAssetVersionIds.join(", ")}.
									manifest SHA-256 {container.manifestDigest}
								</li>
							))}
						</ul>
					)}
					<h3>Delivery Fulfilments</h3>
					{report.fulfilments.length === 0 ? (
						<p>None.</p>
					) : (
						<ul>
							{report.fulfilments.map((item) => (
								<li key={item.id}>
									Fulfilment {item.id}, revision {item.revisionNumber}, target{" "}
									{item.deliveryTargetId}; bundles:{" "}
									{item.bundleIds.join(", ") || "none"};{" "}
									{item.pinsErasedVersions
										? "pins affected versions"
										: "does not pin affected versions"}
									.
								</li>
							))}
						</ul>
					)}
					<h3>Backups</h3>
					{report.backup.status === "scheduled" ? (
						<p>
							Purge window: {report.backup.purgeWindowDays} days; retention
							schedule {report.backup.retentionScheduleVersion}.
						</p>
					) : (
						<p>A backup retention schedule has not been published.</p>
					)}
					<h3>External copies</h3>
					<p>{report.externalCopies.statement}</p>
					<ErasureApprovalPanel
						key={`${report.id}:${report.reportDigest}`}
						onWriteLockChange={onWriteLockChange}
						projectId={projectId}
						report={report}
					/>
				</section>
			)}
		</main>
	);
}
