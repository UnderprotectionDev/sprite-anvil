import type { ErasureImpactReport } from "@sprite-anvil/api/permanent-erasure";
import type { ErasureApprovalInput } from "@sprite-anvil/api/permanent-erasure-deletion";
import { selectedErasureCounts } from "@sprite-anvil/api/permanent-erasure-deletion";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";

export function ErasureApprovalPanel({
	report,
	projectId,
	onWriteLockChange,
}: {
	report: ErasureImpactReport;
	projectId: string;
	onWriteLockChange?: (locked: boolean) => void;
}) {
	const [uncertain, setUncertain] = useState(false);
	const [submitted, setSubmitted] = useState<ErasureApprovalInput | null>(null);
	const key = useRef<{ input: string; key: string } | null>(null);
	const approve = useMutation(
		orpc.permanentErasure.approveErasure.mutationOptions()
	);
	const operationId = approve.data?.id;
	const operations = useQuery({
		...orpc.backgroundOperations.list.queryOptions({ input: { projectId } }),
		enabled: !!operationId,
		refetchInterval: operationId ? 2000 : false,
	});
	const operation =
		operations.data?.operations.find((item) => item.id === operationId) ??
		approve.data;
	const receipt = useQuery({
		...orpc.permanentErasure.getDeletionReceipt.queryOptions({
			input: { projectId, receiptId: operation?.scopeTargetId ?? "" },
		}),
		enabled: operation?.status === "completed" && !!operation.scopeTargetId,
	});
	const send = async (input: ErasureApprovalInput) => {
		try {
			await approve.mutateAsync(input);
			setUncertain(false);
		} catch (error) {
			setUncertain(isWriteOutcomeUncertain(error));
		}
	};
	const form = useForm({
		defaultValues: {
			selectedContainerIds: [] as string[],
			irreversible: false,
			externalCopiesRemain: false,
			countsAccepted: false,
		},
		onSubmit: async ({ value }) => {
			if (
				!(
					value.irreversible &&
					value.externalCopiesRemain &&
					value.countsAccepted
				) ||
				uncertain ||
				operationId
			) {
				return;
			}
			const content = {
				projectId,
				reportId: report.id,
				reportDigest: report.reportDigest,
				selectedContainerIds: value.selectedContainerIds,
				confirmed: selectedErasureCounts(report, value.selectedContainerIds),
				acknowledgements: {
					irreversible: true as const,
					externalCopiesRemain: true as const,
				},
			};
			const serialized = JSON.stringify(content);
			if (key.current?.input !== serialized) {
				key.current = { input: serialized, key: crypto.randomUUID() };
			}
			const input = { ...content, idempotencyKey: key.current.key };
			setSubmitted(input);
			await send(input);
		},
	});
	const locked = uncertain || approve.isPending || !!operationId;
	const activeOperation =
		!!operationId &&
		operation?.status !== "completed" &&
		operation?.status !== "failed" &&
		operation?.status !== "cancelled";
	useLayoutEffect(() => {
		onWriteLockChange?.(uncertain || approve.isPending || activeOperation);
	}, [onWriteLockChange, uncertain, approve.isPending, activeOperation]);
	return (
		<section>
			<h2>Approve Erasure</h2>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="selectedContainerIds">
					{(field) => (
						<div>
							{report.containers.map((container) => (
								<label htmlFor={`container-${container.id}`} key={container.id}>
									<Checkbox
										checked={field.state.value.includes(container.id)}
										disabled={locked}
										id={`container-${container.id}`}
										onCheckedChange={(checked) => {
											field.handleChange(
												checked
													? [...field.state.value, container.id]
													: field.state.value.filter(
															(id) => id !== container.id
														)
											);
											form.setFieldValue("countsAccepted", false);
										}}
									/>{" "}
									{container.kind === "export_bundle"
										? "Export Bundle"
										: "Project Archive"}{" "}
									{container.id}
								</label>
							))}
						</div>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.values.selectedContainerIds}>
					{(ids) => {
						const counts = selectedErasureCounts(report, ids);
						return (
							<p>
								Managed copies: {counts.managedCopies}. Export Bundles:{" "}
								{counts.bundles}. Project Archives: {counts.archives}. Container
								files: {counts.containerFiles}. Delivery Fulfilments:{" "}
								{counts.fulfilments}.
							</p>
						);
					}}
				</form.Subscribe>
				{(
					[
						["irreversible", "I understand erasure is irreversible"],
						["externalCopiesRemain", "I understand external copies remain"],
						["countsAccepted", "I confirm these counts"],
					] as const
				).map(([name, label]) => (
					<form.Field
						key={name}
						name={name}
						validators={{
							onSubmit: ({ value }) => (value ? undefined : "Required"),
						}}
					>
						{(field) => (
							<label htmlFor={name}>
								<Checkbox
									checked={field.state.value}
									disabled={locked}
									id={name}
									onCheckedChange={field.handleChange}
								/>{" "}
								{label}{" "}
								{field.state.meta.errors.length > 0 && <span>Required</span>}
							</label>
						)}
					</form.Field>
				))}
				<Button disabled={locked} type="submit">
					Approve Erasure
				</Button>
			</form>
			{uncertain && !!submitted && (
				<>
					<p role="alert">
						The approval outcome is unknown. Retry the same approval.
					</p>
					<Button
						disabled={approve.isPending}
						onClick={() => void send(submitted)}
					>
						Retry approval
					</Button>
				</>
			)}
			{!!approve.error && !uncertain && (
				<p role="alert">{approve.error.message}</p>
			)}
			{!!operation && (
				<div>
					<h3>Background Operation</h3>
					<p>
						Status: {operation.status}. Progress:{" "}
						{operation.progressPercent ?? "unknown"}% {operation.progressStep}
					</p>
					{!!operation.failureSummary && (
						<p role="alert">{operation.failureSummary}</p>
					)}
				</div>
			)}
			{!!operations.error && <p role="alert">{operations.error.message}</p>}
			{!!receipt.error && <p role="alert">{receipt.error.message}</p>}
			{!!receipt.data && (
				<div>
					<h3>Deletion Receipt</h3>
					<p>
						Report digest: {receipt.data.reportDigest}. Receipt digest:{" "}
						{receipt.data.receiptDigest}.
					</p>
					<p>
						Managed copies: {receipt.data.counts.managedCopies}. Export Bundles:{" "}
						{receipt.data.counts.bundles}. Project Archives:{" "}
						{receipt.data.counts.archives}. Container files:{" "}
						{receipt.data.counts.containerFiles}. Delivery Fulfilments:{" "}
						{receipt.data.counts.fulfilments}.
					</p>
					<p>
						{receipt.data.backup.status === "scheduled"
							? `Backup purge due: ${receipt.data.backup.purgeDueAt}`
							: "Backup retention schedule unpublished."}
					</p>
				</div>
			)}
		</section>
	);
}
