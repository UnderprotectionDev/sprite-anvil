import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type {
	DirectionalReviewInput,
	DirectionalReviewRecord,
} from "@sprite-anvil/api/directional-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
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
	const [saving, setSaving] = useState(false);
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
		setSaving(true);
		setMessage("");
		setPendingId(input.id);
		try {
			const record = await client.directionalReviews.save(input);
			setSelected(record);
			setPendingId(null);
			setMessage("İnceleme kalıcı kayıttan doğrulandı.");
			await query.refetch();
		} catch (error) {
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setMessage(getErrorMessage(error, "İnceleme kaydedilemedi."));
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
		const result = await query.refetch();
		const saved = result.data?.find((record) => record.id === pendingId);
		if (!result.isError && saved) {
			setSelected(saved);
			setPendingId(null);
			setUncertain(false);
			setMessage("İnceleme kalıcı kayıttan doğrulandı.");
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
			aria-label={`${familyName} kimlik ve yön incelemesi`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="font-semibold text-xl">
				{familyName} · Kimlik ve Yön Tutarlılığını İnceleme
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
				disabled={query.isFetching}
				onClick={checkCurrentRecords}
				type="button"
			>
				Güncel kayıtları kontrol et
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
							{new Date(record.createdAt).toLocaleString("tr-TR")} ·{" "}
							{record.directions.length} yön ·{" "}
							{record.outcome === "consistent" ? "Tutarlı" : "Takip gerekli"}
						</Button>
					</li>
				))}
			</ul>
			{selected ? (
				<>
					<p>Kaydedilmiş inceleme · {selected.rationale}</p>
					<Button
						onClick={() => {
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
					Ana Tasarım seçin ve karakter Özel Profil Sözleşmesini etkinleştirin.
				</p>
			)}
		</section>
	);
}
