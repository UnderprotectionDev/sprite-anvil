import type {
	AssetVersionBatchReviewInput,
	AssetVersionBatchReviewPreview,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { batchReviewFormSchema } from "../../schemas";

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
	const form = useForm({
		defaultValues: {
			decision: "approved" as AssetVersionBatchReviewInput["decision"],
			rationale: "",
			selected: [] as string[],
		},
		validators: { onChange: batchReviewFormSchema },
	});
	const selected = useStore(form.store, (state) => state.values.selected);
	const decision = useStore(form.store, (state) => state.values.decision);
	const rationale = useStore(form.store, (state) => state.values.rationale);
	const [preview, setPreview] = useState<AssetVersionBatchReviewPreview | null>(
		null
	);
	const [requestKey, setRequestKey] = useState<string | null>(null);
	// A button-triggered preview that must always hit the server and is never
	// cached, so it is a mutation rather than a cached query.
	const previewBatchReview = useMutation(
		orpc.assetVersions.previewBatchReview.mutationOptions({
			...mutationMeta,
		})
	);
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
			const result = await previewBatchReview.mutateAsync({
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
				form.setFieldValue("selected", []);
				form.setFieldValue("rationale", "");
			}
		} finally {
			setBusy(false);
		}
	}

	return (
		<FieldSet className="space-y-3 rounded-lg border p-4" disabled={disabled}>
			<FieldLegend>Toplu inceleme</FieldLegend>
			<p className="text-sm">
				Her seçili kesin sürüm için ayrı İnceleme Kaydı yazılır. Engelli öğe
				varsa hiçbir karar kaydedilmez.
			</p>
			<form.Field name="selected">
				{(field) =>
					versions.map((version) => (
						<div className="flex items-center gap-2 text-sm" key={version.id}>
							<Checkbox
								checked={field.state.value.includes(version.id)}
								disabled={
									disabled ||
									(!field.state.value.includes(version.id) &&
										field.state.value.length >= 100)
								}
								id={`batch-review-version-${version.id}`}
								onBlur={field.handleBlur}
								onCheckedChange={(checked) => {
									field.handleChange(
										checked
											? [...field.state.value, version.id]
											: field.state.value.filter((id) => id !== version.id)
									);
									resetPreview();
								}}
							/>
							<Label
								className="text-sm"
								htmlFor={`batch-review-version-${version.id}`}
							>
								{version.name}
							</Label>
						</div>
					))
				}
			</form.Field>
			<Label
				className="block space-y-1 text-sm"
				htmlFor="batch-review-decision"
			>
				<span>Toplu inceleme kararı</span>
				<form.Field name="decision">
					{(field) => (
						<NativeSelect
							className="w-fit [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:p-2"
							id="batch-review-decision"
							onBlur={field.handleBlur}
							onChange={(event) => {
								const { value } = event.currentTarget;
								if (
									value === "approved" ||
									value === "rejected" ||
									value === "candidate"
								) {
									field.handleChange(value);
									resetPreview();
								}
							}}
							value={field.state.value}
						>
							<NativeSelectOption value="approved">Onayla</NativeSelectOption>
							<NativeSelectOption value="rejected">Reddet</NativeSelectOption>
							<NativeSelectOption value="candidate">
								Aday yap
							</NativeSelectOption>
						</NativeSelect>
					)}
				</form.Field>
			</Label>
			<Label
				className="block space-y-1 text-sm"
				htmlFor="batch-review-rationale"
			>
				<span>Toplu inceleme gerekçesi</span>
				<form.Field name="rationale">
					{(field) => (
						<Textarea
							className="min-h-20 w-full rounded-md border bg-background p-2"
							id="batch-review-rationale"
							maxLength={2000}
							onBlur={field.handleBlur}
							onChange={(event) => {
								field.handleChange(event.currentTarget.value);
								resetPreview();
							}}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</Label>
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
		</FieldSet>
	);
}
