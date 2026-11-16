import type {
	AnimationTimingReviewInput,
	AnimationTimingReviewRecord,
} from "@sprite-anvil/api/animation-timing-reviews";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	StatusMessage,
	WriteOutcomeMessage,
} from "@/components/status-message";
import type { AnimationTimingMetadataStatus } from "@/features/character-animation-profile/ui/components/animation-timing-event-timeline";
import { AnimationTimingReviewEditor } from "@/features/character-animation-profile/ui/components/animation-timing-review-editor";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

export function AnimationTimingReviewManager({
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
	activation: ProjectProfileContractActivation;
	recordNames: Record<string, string>;
}) {
	const query = useQuery(
		orpc.animationTimingReviews.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const [selected, setSelected] = useState<AnimationTimingReviewRecord | null>(
		null
	);
	const queryClient = useQueryClient();
	const saveMutation = useMutation(
		orpc.animationTimingReviews.save.mutationOptions({
			...mutationMeta,
			onSuccess: async (record) => {
				setSelected(record);
				setPendingId(null);
				setMessage("Review verified from the saved record.");
				await queryClient.invalidateQueries({
					queryKey: orpc.animationTimingReviews.list.queryKey({
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
	const versions = useMemo(
		() =>
			catalog.assetVersions.filter(
				(version) => version.assetFamilyId === assetFamilyId
			),
		[catalog.assetVersions, assetFamilyId]
	);
	const gameplayMetadataQueries = useQueries({
		queries: [...new Set(versions.map((version) => version.assetRecordId))].map(
			(assetRecordId) =>
				orpc.gameplayMetadata.list.queryOptions({
					input: { projectId, assetRecordId },
					meta: { errorPresentation: "inline" },
				})
		),
	});
	const gameplayMetadataRecords: GameplayMetadataRecord[] =
		gameplayMetadataQueries.flatMap((result) => result.data?.records ?? []);
	let gameplayMetadataStatus: AnimationTimingMetadataStatus = "ready";
	if (gameplayMetadataQueries.some((result) => result.isPending)) {
		gameplayMetadataStatus = "loading";
	}
	if (gameplayMetadataQueries.some((result) => result.isError)) {
		gameplayMetadataStatus = "error";
	}
	const retryGameplayMetadata = () => {
		void Promise.all(gameplayMetadataQueries.map((result) => result.refetch()));
	};
	const controlsLocked = saving || uncertain;
	const save = async (input: AnimationTimingReviewInput) => {
		if (saving || uncertain || selected) {
			return;
		}
		setMessage("");
		setPendingId(input.id);
		try {
			await saveMutation.mutateAsync(input);
		} catch (error) {
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setMessage(getErrorMessage(error, "Could not save animation review."));
				return;
			}
			setUncertain(true);
			setMessage(
				"Could not verify the save result. Check current records; do not resubmit the same review."
			);
		}
	};
	const checkCurrentRecords = async () => {
		if (saving || query.isFetching) {
			return;
		}
		const result = await query.refetch();
		const saved = result.data?.find((record) => record.id === pendingId);
		if (!result.isError && saved) {
			setSelected(saved);
			setPendingId(null);
			setUncertain(false);
			setMessage("Review verified from the saved record.");
		}
	};
	return (
		<section
			aria-label={`${familyName} animation timing review`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="font-semibold text-xl">
				{familyName} · Review Animation Timing and Transitions
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
				disabled={saving || query.isFetching}
				onClick={checkCurrentRecords}
				type="button"
			>
				Check current records
			</Button>
			<ul>
				{query.data?.map((record) => (
					<li key={record.id}>
						<Button
							disabled={controlsLocked}
							onClick={() => {
								if (controlsLocked) {
									return;
								}
								setSelected(record);
								setUncertain(false);
							}}
							type="button"
						>
							{new Date(record.createdAt).toLocaleString("en-US")} ·{" "}
							{record.animationName} · {record.directions.length} directions ·{" "}
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
						disabled={controlsLocked}
						onClick={() => {
							if (controlsLocked) {
								return;
							}
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
			<AnimationTimingReviewEditor
				assetFamilyId={assetFamilyId}
				contractRevisionId={
					selected?.contractRevisionId ?? activation.contractRevisionId
				}
				disabled={
					saving || uncertain || query.isError || query.isPending || !!selected
				}
				gameplayMetadataRecords={gameplayMetadataRecords}
				gameplayMetadataStatus={gameplayMetadataStatus}
				initial={selected ?? undefined}
				key={
					selected?.id ?? `${activation.contractRevisionId}:${assetFamilyId}`
				}
				onRetryGameplayMetadata={retryGameplayMetadata}
				onSave={save}
				projectId={projectId}
				recordNames={recordNames}
				versions={versions}
			/>
		</section>
	);
}
