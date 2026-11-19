import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type {
	DirectionalReviewInput,
	DirectionalReviewRecord,
} from "@sprite-anvil/api/directional-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	StatusMessage,
	WriteOutcomeMessage,
} from "@/components/status-message";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { DirectionalReviewEditor } from "./directional-review-editor";

export function DirectionalReviewManager({
	projectId,
	assetFamilyId,
	familyName,
	catalog,
	activation,
	recordNames,
}: {
	projectId: string;
	assetFamilyId: string;
	familyName: string;
	catalog: AssetVersionCatalog;
	activation?: ProjectProfileContractActivation;
	recordNames: Record<string, string>;
}) {
	const query = useQuery(
		orpc.directionalReviews.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const [selected, setSelected] = useState<DirectionalReviewRecord | null>(
		null
	);
	const queryClient = useQueryClient();
	const saveMutation = useMutation(
		orpc.directionalReviews.save.mutationOptions({
			...mutationMeta,
			onSuccess: async (record) => {
				setSelected(record);
				setPendingId(null);
				setMessage("Review verified from the saved record.");
				await queryClient.invalidateQueries({
					queryKey: orpc.directionalReviews.list.queryKey({
						input: { projectId, assetFamilyId },
					}),
				});
			},
		})
	);
	const saving = saveMutation.isPending;
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const canonical = catalog.canonicalDesigns
		.filter((design) => design.assetFamilyId === assetFamilyId)
		.at(-1);
	const versions = catalog.assetVersions.filter(
		(version) => version.assetFamilyId === assetFamilyId
	);
	const save = async (input: DirectionalReviewInput) => {
		setMessage("");
		setPendingId(input.id);
		try {
			await saveMutation.mutateAsync(input);
		} catch (error) {
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setMessage(getErrorMessage(error, "Could not save review."));
				return;
			}
			setUncertain(true);
			setMessage(
				"Could not verify the save result. Check current records; do not resubmit the same review."
			);
		}
	};
	const checkCurrentRecords = async () => {
		const result = await query.refetch();
		const saved = result.data?.find((record) => record.id === pendingId);
		if (!result.isError && saved) {
			setSelected(saved);
			setPendingId(null);
			setUncertain(false);
			setMessage("Review verified from the saved record.");
		}
	};
	const designId = selected?.canonicalDesignId ?? canonical?.id;
	const canonicalVersionId =
		selected?.canonicalAssetVersionId ?? canonical?.assetVersionId;
	const contract = selected?.contractSnapshot ?? activation?.contract;
	const contractRevisionId =
		selected?.contractRevisionId ?? activation?.contractRevisionId;
	return (
		<section
			aria-label={`${familyName} identity and direction review`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="text-xl font-semibold">
				{familyName} · Review Identity and Direction Consistency
			</h3>
			{query.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">Could not load reviews.</StatusMessage>
					<Button onClick={() => query.refetch()} type="button">
						Reload records
					</Button>
				</div>
			) : null}
			<WriteOutcomeMessage message={message} uncertain={uncertain} />
			<Button
				disabled={query.isFetching}
				onClick={checkCurrentRecords}
				type="button"
			>
				Check current records
			</Button>
			<ul>
				{query.data?.map((record) => (
					<li key={record.id}>
						<Button
							onClick={() => {
								setSelected(record);
								setUncertain(false);
							}}
							type="button"
						>
							{new Date(record.createdAt).toLocaleString("en-US")} ·{" "}
							{record.directions.length} directions ·{" "}
							{record.outcome === "consistent"
								? "Consistent"
								: "Needs follow-up"}
						</Button>
					</li>
				))}
			</ul>
			{selected ? (
				<>
					<p>Saved review · {selected.rationale}</p>
					<Button
						onClick={() => {
							setSelected(null);
							setUncertain(false);
							setMessage("");
						}}
						type="button"
					>
						New review
					</Button>
				</>
			) : null}
			{designId && canonicalVersionId && contract && contractRevisionId ? (
				<DirectionalReviewEditor
					assetFamilyId={assetFamilyId}
					canonicalDesignId={designId}
					canonicalVersionId={canonicalVersionId}
					contract={contract}
					contractRevisionId={contractRevisionId}
					disabled={
						saving ||
						uncertain ||
						query.isError ||
						query.isPending ||
						!!selected
					}
					initial={selected ?? undefined}
					key={selected?.id ?? `${designId}:${contractRevisionId}`}
					onSave={save}
					projectId={projectId}
					recordNames={recordNames}
					versions={versions}
				/>
			) : (
				<p>
					Select a Canonical Design and activate the character Specialized
					Profile Contract.
				</p>
			)}
		</section>
	);
}
