import type {
	AssetVersionBatchReviewInput,
	AssetVersionBatchReviewPreview,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/get-error-message";
import { client } from "@/utils/orpc";

export function BatchReviewControls({
	projectId,
	versions,
	writesDisabled,
	onReview,
}: {
	projectId: string;
	versions: { id: string; name: string }[];
	writesDisabled: boolean;
	onReview: (input: AssetVersionBatchReviewInput) => Promise<boolean>;
}) {
	const [selected, setSelected] = useState<string[]>([]);
	const [decision, setDecision] =
		useState<AssetVersionBatchReviewInput["decision"]>("approved");
	const [rationale, setRationale] = useState("");
	const [preview, setPreview] = useState<AssetVersionBatchReviewPreview | null>(
		null
	);
	const [requestKey, setRequestKey] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const disabled = writesDisabled || busy;
	const names = new Map(versions.map((version) => [version.id, version.name]));
	const resetPreview = () => {
		setPreview(null);
		setRequestKey(null);
	};

	async function loadPreview() {
		setBusy(true);
		resetPreview();
		try {
			const result = await client.assetVersions.previewBatchReview({
				projectId,
				assetVersionIds: selected,
				decision,
			});
			setPreview(result);
			setRequestKey(crypto.randomUUID());
		} catch (error) {
			toast.error(
				getErrorMessage(error, "Toplu inceleme önizlemesi yüklenemedi.")
			);
		} finally {
			setBusy(false);
		}
	}

	async function confirm() {
		if (
			!(preview && requestKey) ||
			preview.items.some((item) => item.blockers.length > 0)
		) {
			return;
		}
		setBusy(true);
		try {
			const saved = await onReview({
				projectId,
				decision,
				rationale,
				idempotencyKey: requestKey,
				targets: preview.items.map(
					({ assetVersionId, expectedReviewEventId }) => ({
						assetVersionId,
						expectedReviewEventId,
					})
				),
			});
			if (saved) {
				resetPreview();
				setSelected([]);
				setRationale("");
			}
		} finally {
			setBusy(false);
		}
	}

	return (
		<fieldset className="space-y-3 rounded-lg border p-4" disabled={disabled}>
			<legend className="font-medium">Toplu inceleme</legend>
			<p className="text-sm">
				Her seçili kesin sürüm için ayrı İnceleme Kaydı yazılır. Engelli öğe
				varsa hiçbir karar kaydedilmez.
			</p>
			{versions.map((version) => (
				<label className="flex items-center gap-2 text-sm" key={version.id}>
					<input
						checked={selected.includes(version.id)}
						disabled={
							disabled ||
							(!selected.includes(version.id) && selected.length >= 100)
						}
						onChange={(event) => {
							setSelected(
								event.currentTarget.checked
									? [...selected, version.id]
									: selected.filter((id) => id !== version.id)
							);
							resetPreview();
						}}
						type="checkbox"
					/>
					{version.name}
				</label>
			))}
			<label
				className="block space-y-1 text-sm"
				htmlFor="batch-review-decision"
			>
				<span>Toplu inceleme kararı</span>
				<select
					className="rounded-md border bg-background p-2"
					id="batch-review-decision"
					onChange={(event) => {
						const { value } = event.currentTarget;
						if (
							value === "approved" ||
							value === "rejected" ||
							value === "candidate"
						) {
							setDecision(value);
							resetPreview();
						}
					}}
					value={decision}
				>
					<option value="approved">Onayla</option>
					<option value="rejected">Reddet</option>
					<option value="candidate">Aday yap</option>
				</select>
			</label>
			<label
				className="block space-y-1 text-sm"
				htmlFor="batch-review-rationale"
			>
				<span>Toplu inceleme gerekçesi</span>
				<textarea
					className="min-h-20 w-full rounded-md border bg-background p-2"
					id="batch-review-rationale"
					maxLength={2000}
					onChange={(event) => {
						setRationale(event.currentTarget.value);
						resetPreview();
					}}
					required
					value={rationale}
				/>
			</label>
			<Button
				disabled={disabled || selected.length === 0 || !rationale.trim()}
				onClick={() => void loadPreview()}
				type="button"
			>
				Uygunluk ve engelleri göster
			</Button>
			{preview ? (
				<div aria-live="polite" className="space-y-2">
					<ul>
						{preview.items.map((item) => (
							<li key={item.assetVersionId}>
								<span>{names.get(item.assetVersionId)}</span>
								{item.blockers.length > 0 ? (
									<ul>
										{item.blockers.map((blocker) => (
											<li key={blocker}>{blocker}</li>
										))}
									</ul>
								) : (
									<span> — Karar için uygun</span>
								)}
							</li>
						))}
					</ul>
					<Button
						disabled={
							disabled || preview.items.some((item) => item.blockers.length > 0)
						}
						onClick={() => void confirm()}
						type="button"
					>
						Kararları kaydet
					</Button>
					<Button onClick={resetPreview} type="button" variant="outline">
						Önizlemeyi iptal et
					</Button>
				</div>
			) : null}
		</fieldset>
	);
}
