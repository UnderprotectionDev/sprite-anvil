import type { DerivativeReReviewInput } from "@sprite-anvil/api/dependency-revalidation";
import { Button } from "@sprite-anvil/ui/components/button";
import { useId, useState } from "react";
import { ENV } from "@/env";
import { AssetVersionPreview } from "@/features/asset-versions/ui/components/asset-version-preview";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

export function DerivativeReReviewForm({
	projectId,
	assetVersionId,
	label,
	versionNumber,
	previewUrl,
	canonicalPreviewUrl,
	contextRevisionId,
	contextRevisionNumber,
	canonicalDesignVersionId,
	canonicalLabel,
	canonicalVersionNumber,
	changeImpactIds,
	disabled,
	onReview,
}: {
	projectId: string;
	assetVersionId: string;
	label: string;
	versionNumber: number;
	previewUrl?: string;
	canonicalPreviewUrl?: string;
	contextRevisionId?: string;
	contextRevisionNumber?: number;
	canonicalDesignVersionId?: string;
	canonicalLabel: string;
	canonicalVersionNumber?: number;
	changeImpactIds: string[];
	disabled: boolean;
	onReview: (input: DerivativeReReviewInput) => void;
}) {
	const identifier = useId();
	const [selectedContext, setSelectedContext] = useState("");
	const [selectedCanonical, setSelectedCanonical] = useState("");
	const [rationale, setRationale] = useState("");
	const ready =
		!disabled &&
		Boolean(
			contextRevisionId &&
				canonicalDesignVersionId &&
				selectedContext === contextRevisionId &&
				selectedCanonical === canonicalDesignVersionId &&
				rationale.trim()
		);
	function review(decision: DerivativeReReviewInput["decision"]) {
		if (!ready) {
			return;
		}
		onReview({
			projectId,
			assetVersionId,
			contextRevisionId: selectedContext,
			canonicalDesignVersionId: selectedCanonical,
			changeImpactIds,
			rationale: rationale.trim(),
			decision,
		});
	}
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				review("approved");
			}}
		>
			<fieldset className="space-y-3 rounded border p-4" disabled={disabled}>
				<legend className="font-semibold">
					{label} — Güncel Türetilmiş Varlığı Yeniden İnceleme
				</legend>
				<div className="flex flex-wrap gap-4">
					{previewUrl ? (
						<AssetVersionPreview
							recordName={label}
							url={`${serverUrl}${previewUrl}`}
							versionNumber={versionNumber}
						/>
					) : null}
					{canonicalPreviewUrl && canonicalVersionNumber ? (
						<AssetVersionPreview
							recordName={`Ana Tasarım: ${canonicalLabel}`}
							url={`${serverUrl}${canonicalPreviewUrl}`}
							versionNumber={canonicalVersionNumber}
						/>
					) : null}
				</div>
				<label className="block" htmlFor={`${identifier}-context`}>
					İncelenen Bağlam Sürümü
				</label>
				<select
					className="w-full rounded border px-3 py-2"
					id={`${identifier}-context`}
					onChange={(event) => setSelectedContext(event.target.value)}
					required
					value={selectedContext}
				>
					<option value="">Etkin Bağlam Sürümünü seçin</option>
					{contextRevisionId ? (
						<option value={contextRevisionId}>
							Bağlam Sürümü {contextRevisionNumber} (etkin)
						</option>
					) : null}
				</select>
				<label className="block" htmlFor={`${identifier}-canonical`}>
					İncelenen Ana Tasarım
				</label>
				<select
					className="w-full rounded border px-3 py-2"
					id={`${identifier}-canonical`}
					onChange={(event) => setSelectedCanonical(event.target.value)}
					required
					value={selectedCanonical}
				>
					<option value="">Ailenin güncel Ana Tasarımını seçin</option>
					{canonicalDesignVersionId ? (
						<option value={canonicalDesignVersionId}>{canonicalLabel}</option>
					) : null}
				</select>
				{contextRevisionId && canonicalDesignVersionId ? null : (
					<p>
						Yeniden inceleme için etkin Bağlam Sürümü ve ailenin güncel Ana
						Tasarımı gereklidir.
					</p>
				)}
				<label className="block" htmlFor={`${identifier}-rationale`}>
					Yeniden inceleme gerekçesi
				</label>
				<textarea
					className="w-full rounded border px-3 py-2"
					id={`${identifier}-rationale`}
					maxLength={2000}
					onChange={(event) => setRationale(event.target.value)}
					required
					value={rationale}
				/>
				<p className="text-muted-foreground text-sm">
					Geçmiş onay ve kalite kanıtları korunur. Kalite İstisnası güncel
					uygunluk yerine geçmez. İçerik değişikliği yeni Birim veya Birleşik
					Sürüm gerektirir.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button disabled={!ready} type="submit">
						Güncel Uygunluğu Onayla
					</Button>
					<Button
						disabled={!ready}
						onClick={() => review("candidate")}
						type="button"
						variant="outline"
					>
						İçerik Düzeltmesi Gerekli
					</Button>
				</div>
				<a
					className="underline underline-offset-4"
					href="#asset-version-controls-heading"
				>
					Birim veya Birleşik Sürüm Hazırla
				</a>
			</fieldset>
		</form>
	);
}
