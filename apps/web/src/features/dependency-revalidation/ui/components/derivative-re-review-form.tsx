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
import { AssetVersionPreview } from "@/components/asset-version-preview";
import { ENV } from "@/env";
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
					{label} — Re-review Current Derived Asset
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
							recordName={`Canonical Design: ${canonicalLabel}`}
							url={`${serverUrl}${canonicalPreviewUrl}`}
							versionNumber={canonicalVersionNumber}
						/>
					) : null}
				</div>
				<form.Field name="contextRevisionId">
					{(field) => (
						<>
							<Label className="block" htmlFor={`${identifier}-context`}>
								Reviewed Context Revision
							</Label>
							<NativeSelect
								className="w-full"
								id={`${identifier}-context`}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Select the Active Context Revision
								</NativeSelectOption>
								{contextRevisionId ? (
									<NativeSelectOption value={contextRevisionId}>
										Context Revision {contextRevisionNumber} (active)
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
								Reviewed Canonical Design
							</Label>
							<NativeSelect
								className="w-full"
								id={`${identifier}-canonical`}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Select the family's current Canonical Design
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
						Re-review requires the Active Context Revision and the family's
						current Canonical Design.
					</p>
				)}
				<form.Field name="rationale">
					{(field) => (
						<>
							<Label className="block" htmlFor={`${identifier}-rationale`}>
								Re-review rationale
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
					Historical approval and quality evidence are preserved. A Quality
					Waiver does not replace current applicability. Content changes require
					a new Unit or Composite Version.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button disabled={!ready} type="submit">
						Confirm Current Applicability
					</Button>
					<Button
						disabled={!ready}
						onClick={() => review("candidate")}
						type="button"
						variant="outline"
					>
						Content Correction Required
					</Button>
				</div>
				<a
					className="underline underline-offset-4"
					href="#asset-version-controls-heading"
				>
					Prepare Unit or Composite Version
				</a>
			</FieldSet>
		</form>
	);
}
