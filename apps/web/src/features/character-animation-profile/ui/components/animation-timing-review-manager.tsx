import type {
	AnimationTimingReviewInput,
	AnimationTimingReviewRecord,
} from "@sprite-anvil/api/animation-timing-reviews";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import type { AnimationTimingMetadataStatus } from "./animation-timing-event-timeline";
import { AnimationTimingReviewEditor } from "./animation-timing-review-editor";

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
	const [saving, setSaving] = useState(false);
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
		setSaving(true);
		setMessage("");
		setPendingId(input.id);
		try {
			const record = await client.animationTimingReviews.save(input);
			setSelected(record);
			setPendingId(null);
			setMessage("İnceleme kalıcı kayıttan doğrulandı.");
			await query.refetch();
		} catch (error) {
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setMessage(
					getErrorMessage(error, "Animasyon incelemesi kaydedilemedi.")
				);
				return;
			}
			setUncertain(true);
			setMessage(
				"Kaydetme sonucu doğrulanamadı. Güncel kayıtları kontrol edin; aynı incelemeyi yeniden göndermeyin."
			);
		} finally {
			setSaving(false);
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
			setMessage("İnceleme kalıcı kayıttan doğrulandı.");
		}
	};
	return (
		<section
			aria-label={`${familyName} animasyon zamanlaması incelemesi`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="font-semibold text-xl">
				{familyName} · Animasyon Zamanlamasını ve Geçişlerini İnceleme
			</h3>
			{query.isError ? (
				<div role="alert">
					İncelemeler okunamadı.{" "}
					<Button onClick={() => query.refetch()} type="button">
						Kayıtları yeniden oku
					</Button>
				</div>
			) : null}
			{message ? <p role="status">{message}</p> : null}
			<Button
				disabled={saving || query.isFetching}
				onClick={checkCurrentRecords}
				type="button"
			>
				Güncel kayıtları kontrol et
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
							{new Date(record.createdAt).toLocaleString("tr-TR")} ·{" "}
							{record.animationName} · {record.directions.length} yön ·{" "}
							{record.outcome === "consistent" ? "Tutarlı" : "Takip gerekli"}
						</Button>
					</li>
				))}
			</ul>
			{selected ? (
				<>
					<p>Kaydedilmiş inceleme · {selected.rationale}</p>
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
						Yeni inceleme
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
