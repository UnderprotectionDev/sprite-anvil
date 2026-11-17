import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

export function DeletionJobHistory({ projectId }: { projectId: string }) {
	const [receiptId, setReceiptId] = useState<string | null>(null);
	const operations = useQuery({
		...orpc.backgroundOperations.list.queryOptions({ input: { projectId } }),
		refetchInterval: 2000,
	});
	const receipt = useQuery({
		...orpc.permanentErasure.getDeletionReceipt.queryOptions({
			input: { projectId, receiptId: receiptId ?? "" },
		}),
		enabled: !!receiptId,
	});
	const jobs =
		operations.data?.operations.filter(
			(operation) => operation.kind === "deletion"
		) ?? [];
	return (
		<section>
			<h2>Deletion Jobs</h2>
			{!!operations.isLoading && <p>Loading Deletion Jobs…</p>}
			{!!operations.error && <p role="alert">{operations.error.message}</p>}
			{!!operations.data && jobs.length === 0 && <p>No Deletion Jobs.</p>}
			<ul>
				{jobs.map((job) => (
					<li key={job.id}>
						<p>
							{job.scopeSummary} — {job.id}: {job.status}. {job.progressStep}{" "}
							{job.failureSummary}
						</p>
						{job.status === "completed" && !!job.scopeTargetId && (
							<Button onClick={() => setReceiptId(job.scopeTargetId)}>
								Open Deletion Receipt for {job.id}
							</Button>
						)}
					</li>
				))}
			</ul>
			{!!receiptId && receipt.isLoading && <p>Loading Deletion Receipt…</p>}
			{!!receiptId && !!receipt.error && (
				<>
					<p role="alert">{receipt.error.message}</p>
					<Button onClick={() => void receipt.refetch()}>Retry receipt</Button>
				</>
			)}
			{!!receiptId && !!receipt.data && (
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
