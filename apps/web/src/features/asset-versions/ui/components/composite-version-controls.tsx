import type {
	AssetVersion,
	CompositeVersion,
	UnitVersion,
	UnitVersionType,
} from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { AssetVersionPreview } from "@/components/asset-version-preview";
import { ENV } from "@/env";
import type { useAssetVersionWrites } from "@/utils/use-asset-version-writes";
import { reviewDispositionLabels } from "../../lib/review-disposition-labels";
import {
	compositeVersionFormSchema,
	reviewRationaleFormSchema,
} from "../../schemas";
import { unitTypeLabels } from "./unit-version-correction-form";

const selectWrapperClassName =
	"w-full [&_select]:min-h-11 [&_select]:rounded-md [&_select]:border [&_select]:bg-background [&_select]:px-3 [&_select]:text-sm";

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

function getSlotKey(unitType: UnitVersionType, unitKey: string) {
	return `${unitType}\u0000${unitKey}`;
}

function groupUnitVersions(unitVersions: UnitVersion[]) {
	const slots = new Map<
		string,
		{ unitKey: string; unitType: UnitVersionType; unitVersions: UnitVersion[] }
	>();
	for (const unitVersion of unitVersions) {
		const key = getSlotKey(unitVersion.unitType, unitVersion.unitKey);
		const slot = slots.get(key) ?? {
			unitKey: unitVersion.unitKey,
			unitType: unitVersion.unitType,
			unitVersions: [],
		};
		slot.unitVersions.push(unitVersion);
		slots.set(key, slot);
	}
	return [...slots.values()]
		.map((slot) => ({
			...slot,
			unitVersions: [...slot.unitVersions].sort(
				(left, right) => right.versionNumber - left.versionNumber
			),
		}))
		.sort(
			(left, right) =>
				left.unitType.localeCompare(right.unitType) ||
				left.unitKey.localeCompare(right.unitKey)
		);
}

export function CompositeVersionControls({
	assetRecordId,
	assetRecordName,
	assetVersions,
	compositeVersions,
	unitVersions,
	writes,
}: {
	assetRecordId: string;
	assetRecordName: string;
	assetVersions: AssetVersion[];
	compositeVersions: CompositeVersion[];
	unitVersions: UnitVersion[];
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const form = useForm({
		defaultValues: {
			selectedUnitVersionIds: {} as Record<string, string>,
			sourceCompositeVersionId: "",
		},
		onSubmit: async ({ value }) => {
			const parsed = compositeVersionFormSchema(
				new Set(unitVersions.map((unitVersion) => unitVersion.id))
			).safeParse(value);
			if (!parsed.success) {
				return;
			}
			const created = await writes.createCompositeVersion(
				assetRecordId,
				Object.values(parsed.data.selectedUnitVersionIds).filter((id) =>
					unitVersionsById.has(id)
				)
			);
			if (created) {
				form.reset();
			}
		},
	});
	const { selectedUnitVersionIds, sourceCompositeVersionId } = useStore(
		form.store,
		(state) => state.values
	);
	const slots = groupUnitVersions(unitVersions);
	const formId = `composite-version-${assetRecordId}`;
	const unitVersionsById = new Map(
		unitVersions.map((unitVersion) => [unitVersion.id, unitVersion])
	);
	const assetVersionsById = new Map(
		assetVersions.map((assetVersion) => [assetVersion.id, assetVersion])
	);
	const selectedSource = compositeVersions.find(
		(compositeVersion) => compositeVersion.id === sourceCompositeVersionId
	);
	const selectedUnitVersionIdsForSave = Object.values(
		selectedUnitVersionIds
	).filter((id) => unitVersionsById.has(id));

	function chooseSourceCompositeVersion(id: string) {
		const source = compositeVersions.find(
			(compositeVersion) => compositeVersion.id === id
		);
		form.setFieldValue(
			"selectedUnitVersionIds",
			Object.fromEntries(
				(source?.compositionMemberships ?? []).map((membership) => [
					getSlotKey(membership.unitType, membership.unitKey),
					membership.unitVersionId,
				])
			)
		);
	}

	return (
		<section
			aria-labelledby={`${formId}-heading`}
			className="space-y-3 border-t pt-3"
		>
			<div>
				<h5 className="font-medium" id={`${formId}-heading`}>
					Composite Versions
				</h5>
				<p className="text-muted-foreground text-sm">
					Select the exact Unit Versions for the new revision. Previous
					Composite Versions and unused units are preserved.
				</p>
			</div>

			{unitVersions.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Create Unit Versions first. The selective correction form lists this
					record's units here.
				</p>
			) : (
				<form
					className="space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					<form.Field name="sourceCompositeVersionId">
						{(field) => (
							<Label
								className="block space-y-1 text-sm"
								htmlFor={`${formId}-source`}
							>
								<span className="block">Starting Composite Version</span>
								<NativeSelect
									className={selectWrapperClassName}
									disabled={
										writes.writesDisabled || compositeVersions.length === 0
									}
									id={`${formId}-source`}
									onBlur={field.handleBlur}
									onChange={(event) => {
										field.handleChange(event.currentTarget.value);
										chooseSourceCompositeVersion(event.currentTarget.value);
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="">
										Start with an empty selection
									</NativeSelectOption>
									{compositeVersions.map((compositeVersion) => (
										<NativeSelectOption
											key={compositeVersion.id}
											value={compositeVersion.id}
										>
											Composite Version {compositeVersion.versionNumber} ·{" "}
											{
												reviewDispositionLabels[
													compositeVersion.reviewDisposition
												]
											}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</Label>
						)}
					</form.Field>

					<FieldSet className="space-y-3">
						<FieldLegend className="mb-0">
							Unit Versions for the new Composite Version
						</FieldLegend>
						<p className="text-muted-foreground text-sm">
							Select one version per unit, or omit the unit from the
							composition.
						</p>
						<div className="grid gap-3 sm:grid-cols-2">
							{slots.map((slot, index) => {
								const key = getSlotKey(slot.unitType, slot.unitKey);
								const fieldId = `${formId}-unit-${index}`;
								return (
									<form.Field key={key} name="selectedUnitVersionIds">
										{(field) => (
											<Label
												className="block space-y-1 text-sm"
												htmlFor={fieldId}
											>
												<span className="block">
													{unitTypeLabels[slot.unitType]} · {slot.unitKey}
												</span>
												<NativeSelect
													className={selectWrapperClassName}
													disabled={writes.writesDisabled}
													id={fieldId}
													onBlur={field.handleBlur}
													onChange={(event) => {
														const selectedUnitVersionId =
															event.currentTarget.value;
														field.handleChange({
															...field.state.value,
															[key]: selectedUnitVersionId,
														});
													}}
													value={field.state.value[key] ?? ""}
												>
													<NativeSelectOption value="">
														Do not add to composition
													</NativeSelectOption>
													{slot.unitVersions.map((unitVersion) => {
														const assetVersion = assetVersionsById.get(
															unitVersion.assetVersionId
														);
														return (
															<NativeSelectOption
																key={unitVersion.id}
																value={unitVersion.id}
															>
																Unit Version {unitVersion.versionNumber}
																{assetVersion
																	? ` · Asset Version ${assetVersion.versionNumber} · ${reviewDispositionLabels[assetVersion.reviewDisposition]}`
																	: ""}
															</NativeSelectOption>
														);
													})}
												</NativeSelect>
											</Label>
										)}
									</form.Field>
								);
							})}
						</div>
					</FieldSet>
					<Button
						disabled={
							writes.writesDisabled ||
							selectedUnitVersionIdsForSave.length === 0
						}
						type="submit"
					>
						Save new Composite Version
					</Button>
				</form>
			)}

			{compositeVersions.length > 0 ? (
				<ol className="space-y-4">
					{compositeVersions.map((compositeVersion) => (
						<li key={compositeVersion.id}>
							<CompositeVersionHistoryItem
								assetRecordName={assetRecordName}
								assetVersionsById={assetVersionsById}
								compositeVersion={compositeVersion}
								unitVersionsById={unitVersionsById}
								writes={writes}
							/>
						</li>
					))}
				</ol>
			) : null}
			{selectedSource ? (
				<p aria-live="polite" className="sr-only">
					Composite Version {selectedSource.versionNumber} memberships selected.
				</p>
			) : null}
		</section>
	);
}

function CompositeVersionHistoryItem({
	assetRecordName,
	assetVersionsById,
	compositeVersion,
	unitVersionsById,
	writes,
}: {
	assetRecordName: string;
	assetVersionsById: Map<string, AssetVersion>;
	compositeVersion: CompositeVersion;
	unitVersionsById: Map<string, UnitVersion>;
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	return (
		<article className="space-y-3 border-t pt-3">
			<div>
				<h6 className="font-medium">
					Composite Version {compositeVersion.versionNumber} ·{" "}
					{reviewDispositionLabels[compositeVersion.reviewDisposition]}
				</h6>
				<p className="text-muted-foreground text-sm">
					This version has its own review decision.
				</p>
			</div>
			{compositeVersion.compositionMemberships.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					This Composite Version has no Unit Versions.
				</p>
			) : (
				<ol className="grid gap-3 sm:grid-cols-2">
					{compositeVersion.compositionMemberships.map((membership) => {
						const unitVersion = unitVersionsById.get(membership.unitVersionId);
						const assetVersion = unitVersion
							? assetVersionsById.get(unitVersion.assetVersionId)
							: undefined;
						return (
							<li
								className="flex flex-wrap items-center gap-3"
								key={membership.id}
							>
								{assetVersion ? (
									<AssetVersionPreview
										recordName={assetRecordName}
										url={`${serverUrl}${assetVersion.previewUrl}`}
										versionNumber={assetVersion.versionNumber}
									/>
								) : null}
								<div className="text-sm">
									<p>
										{unitTypeLabels[membership.unitType]} · {membership.unitKey}{" "}
										· Unit Version {unitVersion?.versionNumber ?? "—"}
									</p>
									{assetVersion ? (
										<p className="text-muted-foreground">
											Asset Version {assetVersion.versionNumber} ·{" "}
											{reviewDispositionLabels[assetVersion.reviewDisposition]}
										</p>
									) : null}
								</div>
							</li>
						);
					})}
				</ol>
			)}
			<ol className="list-inside list-disc text-muted-foreground text-sm">
				{compositeVersion.reviewEvents.map((reviewEvent) => (
					<li key={reviewEvent.id}>
						{reviewEvent.type === "candidate"
							? "Saved as candidate"
							: `Through review: ${reviewDispositionLabels[reviewEvent.type].toLowerCase()}`}{" "}
						<time dateTime={reviewEvent.createdAt}>
							{new Date(reviewEvent.createdAt).toLocaleString("tr-TR")}
						</time>
						{reviewEvent.rationale
							? ` — Rationale: ${reviewEvent.rationale}`
							: ""}
					</li>
				))}
			</ol>
			<CompositeVersionReviewControls
				compositeVersion={compositeVersion}
				writes={writes}
			/>
		</article>
	);
}

function CompositeVersionReviewControls({
	compositeVersion,
	writes,
}: {
	compositeVersion: CompositeVersion;
	writes: ReturnType<typeof useAssetVersionWrites>;
}) {
	const form = useForm({
		defaultValues: { rationale: "" },
		validators: { onChange: reviewRationaleFormSchema },
	});
	const rationale = useStore(form.store, (state) => state.values.rationale);
	const review = (decision: "approved" | "candidate" | "rejected") =>
		void writes.reviewCompositeVersion(
			compositeVersion.id,
			decision,
			rationale
		);

	return (
		<div className="space-y-2">
			<Label
				className="block space-y-1 text-sm"
				htmlFor={`composite-review-rationale-${compositeVersion.id}`}
			>
				<span>
					Composite Version {compositeVersion.versionNumber} review rationale
				</span>
				<form.Field name="rationale">
					{(field) => (
						<Textarea
							className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm md:text-sm"
							disabled={writes.writesDisabled}
							id={`composite-review-rationale-${compositeVersion.id}`}
							maxLength={2000}
							onBlur={field.handleBlur}
							onChange={(event) =>
								field.handleChange(event.currentTarget.value)
							}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</Label>
			<div className="flex flex-wrap gap-2">
				{compositeVersion.reviewDisposition === "approved" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("approved")}
						type="button"
					>
						Approve
					</Button>
				)}
				{compositeVersion.reviewDisposition === "rejected" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("rejected")}
						type="button"
						variant="outline"
					>
						Reject
					</Button>
				)}
				{compositeVersion.reviewDisposition === "candidate" ? null : (
					<Button
						disabled={writes.writesDisabled || rationale.trim().length === 0}
						onClick={() => review("candidate")}
						type="button"
						variant="outline"
					>
						Make candidate
					</Button>
				)}
			</div>
		</div>
	);
}
