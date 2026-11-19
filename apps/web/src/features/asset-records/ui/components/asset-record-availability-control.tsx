import type {
	AssetRecord,
	MutableAssetRecordAvailability,
} from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

interface AvailabilityRefreshResult {
	data?: AssetRecord;
	isError: boolean;
}

const availabilityLabels: Record<AssetRecord["availability"], string> = {
	active: "Active",
	archived: "Archived",
	erased: "Erased",
};

export function getAvailabilityLabel(
	availability: AssetRecord["availability"]
) {
	return availabilityLabels[availability];
}

function getAvailabilityMessage(
	currentAvailability: AssetRecord["availability"],
	expectedAvailability: MutableAssetRecordAvailability
) {
	if (currentAvailability !== expectedAvailability) {
		return `Current record status: ${getAvailabilityLabel(currentAvailability)}.`;
	}
	if (expectedAvailability === "archived") {
		return "Record archived.";
	}
	return "Record reactivated.";
}

export function AssetRecordAvailabilityControl({
	onRefresh,
	record,
}: {
	onRefresh: () => Promise<AvailabilityRefreshResult>;
	record: AssetRecord;
}) {
	const queryClient = useQueryClient();
	const recordsQueryOptions = orpc.assetRecords.list.queryOptions({
		input: { projectId: record.projectId },
	});
	const archiveRecord = useMutation(
		orpc.assetRecords.archive.mutationOptions(mutationMeta)
	);
	const restoreRecord = useMutation(
		orpc.assetRecords.restore.mutationOptions(mutationMeta)
	);
	const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
	const [pendingAvailability, setPendingAvailability] =
		useState<MutableAssetRecordAvailability | null>(null);
	const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
	const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(
		null
	);

	async function updateAvailability(
		availability: MutableAssetRecordAvailability
	) {
		if (record.availability === "erased" || pendingAvailability) {
			return;
		}

		setIsUpdatingAvailability(true);
		setAvailabilityMessage(null);
		try {
			const input = { assetRecordId: record.id, projectId: record.projectId };
			if (availability === "archived") {
				await archiveRecord.mutateAsync(input);
			} else {
				await restoreRecord.mutateAsync(input);
			}
			void queryClient.invalidateQueries({
				queryKey: recordsQueryOptions.queryKey,
			});
			const result = await onRefresh();
			if (result.isError || !result.data) {
				setPendingAvailability(availability);
				if (!result.isError) {
					toast.error(
						"The operation completed, but the current record status could not be verified. Check the current state."
					);
				}
				return;
			}
			setAvailabilityMessage(
				getAvailabilityMessage(result.data.availability, availability)
			);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setPendingAvailability(availability);
			}
			toast.error(
				getErrorMessage(
					error,
					"Could not verify the record status. Check the current state."
				)
			);
		} finally {
			setIsUpdatingAvailability(false);
		}
	}

	async function checkAvailabilityOutcome() {
		if (!pendingAvailability) {
			return;
		}

		setIsCheckingAvailability(true);
		try {
			const result = await onRefresh();
			if (result.isError || !result.data) {
				if (!result.isError) {
					toast.error("Could not read the current record status. Try again.");
				}
				return;
			}

			const { availability } = result.data;
			setPendingAvailability(null);
			setAvailabilityMessage(
				getAvailabilityMessage(availability, pendingAvailability)
			);
			await queryClient.invalidateQueries({
				queryKey: recordsQueryOptions.queryKey,
			});
		} finally {
			setIsCheckingAvailability(false);
		}
	}

	return (
		<section
			aria-labelledby="record-availability"
			className="rounded-lg border p-5"
		>
			<h2 className="font-semibold" id="record-availability">
				Record status
			</h2>
			<p className="mt-1">{getAvailabilityLabel(record.availability)}</p>
			{record.availability === "active" ? (
				<Button
					className="mt-3"
					disabled={isUpdatingAvailability || pendingAvailability !== null}
					onClick={() => void updateAvailability("archived")}
					type="button"
					variant="outline"
				>
					{isUpdatingAvailability ? "Updating…" : "Archive record"}
				</Button>
			) : null}
			{record.availability === "archived" ? (
				<Button
					className="mt-3"
					disabled={isUpdatingAvailability || pendingAvailability !== null}
					onClick={() => void updateAvailability("active")}
					type="button"
					variant="outline"
				>
					{isUpdatingAvailability ? "Updating…" : "Reactivate record"}
				</Button>
			) : null}
			{pendingAvailability ? (
				<Button
					className="mt-3"
					disabled={isCheckingAvailability}
					onClick={() => void checkAvailabilityOutcome()}
					type="button"
					variant="outline"
				>
					{isCheckingAvailability ? "Checking status…" : "Check status"}
				</Button>
			) : null}
			{availabilityMessage ? (
				<p aria-live="polite" className="mt-3" role="status">
					{availabilityMessage}
				</p>
			) : null}
			<p className="text-muted-foreground mt-2 text-sm">
				General Asset Support · No specialized profile evidence
			</p>
			<p className="text-muted-foreground mt-2 text-sm">
				Record created ·{" "}
				<time dateTime={record.createdAt}>
					{new Intl.DateTimeFormat("tr-TR", {
						dateStyle: "medium",
						timeStyle: "short",
					}).format(new Date(record.createdAt))}
				</time>
			</p>
		</section>
	);
}
