import type { DerivativeReReviewInput } from "@sprite-anvil/api/dependency-revalidation";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useId } from "react";
import { ENV } from "@/env";
import { AssetVersionPreview } from "@/features/asset-versions/ui/components/asset-version-preview";
import { derivativeReReviewFormSchema } from "../../schemas";

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
	const schema = derivativeReReviewFormSchema(
		contextRevisionId,
		canonicalDesignVersionId
	);
	const decisionMeta: { decision: DerivativeReReviewInput["decision"] } = {
		decision: "approved",
	};
	const form = useForm({
		defaultValues: {
			contextRevisionId: "",
			canonicalDesignVersionId: "",
			rationale: "",
		},
		onSubmitMeta: decisionMeta,
		onSubmit: ({ value, meta }) => {
			if (disabled) {
				return;
			}
			onReview({
				projectId,
				assetVersionId,
				contextRevisionId: value.contextRevisionId,
				canonicalDesignVersionId: value.canonicalDesignVersionId,
				changeImpactIds,
				rationale: value.rationale.trim(),
				decision: meta.decision,
			});
		},
		validators: { onSubmit: schema },
	});
	const values = useStore(form.store, (state) => state.values);
	const ready = !disabled && schema.safeParse(values).success;
	function review(decision: DerivativeReReviewInput["decision"]) {
		if (!ready) {
			return;
		}
		void form.handleSubmit({ decision });
	}
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				review("approved");
			}}
		>
			<FieldSet className="space-y-3 rounded border p-4" disabled={disabled}>
				<FieldLegend className="font-semibold">
					{label} — Güncel Türetilmiş Varlığı Yeniden İnceleme
				</FieldLegend>
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
				<form.Field name="contextRevisionId">
					{(field) => (
						<>
							<Label className="block" htmlFor={`${identifier}-context`}>
								İncelenen Bağlam Sürümü
							</Label>
							<NativeSelect
								className="w-full"
								id={`${identifier}-context`}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Etkin Bağlam Sürümünü seçin
								</NativeSelectOption>
								{contextRevisionId ? (
									<NativeSelectOption value={contextRevisionId}>
										Bağlam Sürümü {contextRevisionNumber} (etkin)
									</NativeSelectOption>
								) : null}
							</NativeSelect>
						</>
					)}
				</form.Field>
				<form.Field name="canonicalDesignVersionId">
					{(field) => (
						<>
							<Label className="block" htmlFor={`${identifier}-canonical`}>
								İncelenen Ana Tasarım
							</Label>
							<NativeSelect
								className="w-full"
								id={`${identifier}-canonical`}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Ailenin güncel Ana Tasarımını seçin
								</NativeSelectOption>
								{canonicalDesignVersionId ? (
									<NativeSelectOption value={canonicalDesignVersionId}>
										{canonicalLabel}
									</NativeSelectOption>
								) : null}
							</NativeSelect>
						</>
					)}
				</form.Field>
				{contextRevisionId && canonicalDesignVersionId ? null : (
					<p>
						Yeniden inceleme için etkin Bağlam Sürümü ve ailenin güncel Ana
						Tasarımı gereklidir.
					</p>
				)}
				<form.Field name="rationale">
					{(field) => (
						<>
							<Label className="block" htmlFor={`${identifier}-rationale`}>
								Yeniden inceleme gerekçesi
							</Label>
							<Textarea
								className="w-full"
								id={`${identifier}-rationale`}
								maxLength={2000}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							/>
						</>
					)}
				</form.Field>
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
			</FieldSet>
		</form>
	);
}
