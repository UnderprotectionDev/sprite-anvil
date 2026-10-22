import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ReadinessEvidence } from "@sprite-anvil/api/family-readiness";
import {
	type VfxSynchronizationInput,
	vfxBackgrounds,
} from "@sprite-anvil/api/vfx-synchronization";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useCallback, useId, useState } from "react";
import {
	vfxReviewResultSchema,
	vfxSynchronizationFormSchema,
} from "../../schemas";
import { emptyVfxFrame, VfxClipEditor } from "./vfx-clip-editor";
import { VfxSynchronizedPreview } from "./vfx-synchronized-preview";

export function VfxSynchronizationEditor({
	projectId,
	assetFamilyId,
	contractRevisionId,
	catalog,
	recordNames,
	categories,
	disabled,
	initial,
	readOnly,
	waivers,
	onSave,
}: {
	projectId: string;
	assetFamilyId: string;
	contractRevisionId: string;
	catalog: AssetVersionCatalog;
	recordNames: Record<string, string>;
	categories: Record<string, string | null>;
	disabled: boolean;
	readOnly: boolean;
	initial?: VfxSynchronizationInput;
	waivers: ReadinessEvidence[];
	onSave: (input: VfxSynchronizationInput) => Promise<void>;
}) {
	const [defaults] = useState<VfxSynchronizationInput>(
		() =>
			initial ?? {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId,
				contractRevisionId,
				sourceReviewId: null,
				name: "",
				effect: { looping: false, frames: [emptyVfxFrame()] },
				owner: { looping: false, frames: [emptyVfxFrame()] },
				event: { id: "", timeMs: 0 },
				layer: 1,
				sceneAssetVersionId: "",
				overflowAllowed: false,
				waiverEvidenceIds: [],
				backgrounds: vfxBackgrounds.map((background) => ({
					background,
					alone: "inconclusive",
					synchronized: "inconclusive",
					notes: "",
				})),
				rationale: "",
			}
	);
	const [previewReady, setPreviewReady] = useState(false);
	const onReady = useCallback((ready: boolean) => setPreviewReady(ready), []);
	const overflowId = useId();
	const form = useForm({
		defaultValues: defaults,
		onSubmit: async ({ value }) => {
			const parsed = vfxSynchronizationFormSchema.safeParse(value);
			if (parsed.success && previewReady && !disabled && !readOnly) {
				await onSave(parsed.data);
			}
		},
	});
	const input = useStore(form.store, (state) => state.values);
	const validation = vfxSynchronizationFormSchema.safeParse(input);
	const effectVersionIds = new Set(
		catalog.assetVersions
			.filter(
				(v) =>
					v.assetFamilyId === assetFamilyId &&
					categories[v.assetRecordId] === "visual_effect_projectile_shadow_mark"
			)
			.map((v) => v.id)
	);
	const ownerVersionIds = new Set(
		catalog.assetVersions
			.filter((v) =>
				[
					"character_creature_animation",
					"object_weapon_equipment_states",
				].includes(categories[v.assetRecordId] ?? "")
			)
			.map((v) => v.id)
	);
	const sceneVersions = catalog.assetVersions.filter(
		(v) => categories[v.assetRecordId] === "background_parallax"
	);
	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<FieldSet className="space-y-4" disabled={disabled || readOnly}>
				<form.Field name="name">
					{(field) => (
						<Label className="block">
							Review name
							<Input
								className="block w-full rounded border p-2"
								maxLength={120}
								onChange={(e) => field.handleChange(e.target.value)}
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<div className="grid gap-4 lg:grid-cols-2">
					<form.Field name="effect">
						{(field) => (
							<VfxClipEditor
								catalog={catalog}
								clip={field.state.value}
								disabled={disabled || readOnly}
								label="Effect"
								onValueChange={field.handleChange}
								recordNames={recordNames}
								versionIds={effectVersionIds}
							/>
						)}
					</form.Field>
					<form.Field name="owner">
						{(field) => (
							<VfxClipEditor
								catalog={catalog}
								clip={field.state.value}
								disabled={disabled || readOnly}
								label="Owner"
								onValueChange={field.handleChange}
								recordNames={recordNames}
								versionIds={ownerVersionIds}
							/>
						)}
					</form.Field>
				</div>
				<div className="flex flex-wrap gap-3">
					<form.Field name="event.id">
						{(field) => (
							<Label className="block">
								Game event
								<Input
									className="block rounded border p-2"
									maxLength={200}
									onChange={(e) => field.handleChange(e.target.value)}
									readOnly={!!input.sourceReviewId}
									required
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					<form.Field name="event.timeMs">
						{(field) => (
							<Label className="block">
								Event time (ms)
								<Input
									className="block rounded border p-2"
									min={0}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									readOnly={!!input.sourceReviewId}
									type="number"
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
					<form.Field name="layer">
						{(field) => (
							<Label className="block">
								Layer
								<Input
									className="block w-24 rounded border p-2"
									max={100}
									min={-100}
									onChange={(e) => field.handleChange(Number(e.target.value))}
									type="number"
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
				</div>
				<p className="text-muted-foreground text-sm">
					Define the owner's event id and time for these exact frames. The owner
					uses layer 0. Negative effect layers appear behind it. Event time is
					clip-relative and remains fixed in a selective repair.
				</p>
				<form.Field name="sceneAssetVersionId">
					{(field) => (
						<Label className="block">
							Scene background
							<NativeSelect
								className="block w-full"
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Choose a scene version
								</NativeSelectOption>
								{sceneVersions.map((v) => (
									<NativeSelectOption key={v.id} value={v.id}>
										{recordNames[v.assetRecordId] ?? v.assetRecordId} · Asset
										Version {v.versionNumber}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="overflowAllowed">
					{(field) => (
						<Label className="flex gap-2" htmlFor={overflowId}>
							<Checkbox
								checked={field.state.value}
								disabled={disabled || readOnly}
								id={overflowId}
								onCheckedChange={(checked) => field.handleChange(checked)}
							/>{" "}
							Allow intentional cell overflow
						</Label>
					)}
				</form.Field>
				{waivers.length ? (
					<form.Field name="waiverEvidenceIds">
						{(field) => (
							<FieldSet>
								<FieldLegend>Existing Quality Waivers</FieldLegend>
								{waivers.map((waiver) => (
									<Label
										className="flex gap-2"
										htmlFor={`${overflowId}-${waiver.id}`}
										key={waiver.id}
									>
										<Checkbox
											checked={field.state.value.includes(waiver.id)}
											disabled={disabled || readOnly}
											id={`${overflowId}-${waiver.id}`}
											onCheckedChange={(checked) =>
												field.handleChange(
													checked
														? [...field.state.value, waiver.id]
														: field.state.value.filter((id) => id !== waiver.id)
												)
											}
										/>
										{waiver.ruleId} · {waiver.rationale}
									</Label>
								))}
							</FieldSet>
						)}
					</form.Field>
				) : (
					<p>
						No current overflow Quality Waiver is selected. Permission never
						waives unreadable alpha or broken frame links.
					</p>
				)}
			</FieldSet>
			<VfxSynchronizedPreview
				input={input}
				onReady={onReady}
				versions={catalog.assetVersions}
			/>
			<FieldSet className="space-y-3" disabled={disabled || readOnly}>
				<FieldLegend>Playback evidence</FieldLegend>
				{input.backgrounds.map((evidence, index) => (
					<FieldSet
						className="flex flex-wrap gap-3 rounded border p-3"
						key={evidence.background}
					>
						<FieldLegend>{evidence.background}</FieldLegend>
						{(["alone", "synchronized"] as const).map((mode) => (
							<form.Field key={mode} name={`backgrounds[${index}].${mode}`}>
								{(field) => (
									<Label className="block">
										{mode === "alone"
											? "Effect alone result"
											: "With owner result"}
										<NativeSelect
											className="block"
											onChange={(e) => {
												const result = vfxReviewResultSchema.safeParse(
													e.target.value
												);
												if (result.success) {
													field.handleChange(result.data);
												}
											}}
											value={field.state.value}
										>
											<NativeSelectOption value="inconclusive">
												Inconclusive
											</NativeSelectOption>
											<NativeSelectOption value="passed">
												Passed
											</NativeSelectOption>
											<NativeSelectOption value="failed">
												Failed
											</NativeSelectOption>
										</NativeSelect>
									</Label>
								)}
							</form.Field>
						))}
						<form.Field name={`backgrounds[${index}].notes`}>
							{(field) => (
								<Label className="block grow">
									Playback notes
									<Textarea
										className="block w-full rounded border p-2"
										maxLength={1000}
										onChange={(e) => field.handleChange(e.target.value)}
										required
										value={field.state.value}
									/>
								</Label>
							)}
						</form.Field>
					</FieldSet>
				))}
				<form.Field name="rationale">
					{(field) => (
						<Label className="block">
							Review rationale
							<Textarea
								className="block w-full rounded border p-2"
								maxLength={2000}
								onChange={(e) => field.handleChange(e.target.value)}
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				{!readOnly && (
					<Button
						disabled={disabled || !previewReady || !validation.success}
						type="submit"
					>
						Save synchronization review
					</Button>
				)}
			</FieldSet>
			{!(readOnly || validation.success) && (
				<p role="status">
					Complete the frame versions, positive durations, origins, event, scene
					and playback notes before saving.
				</p>
			)}
		</form>
	);
}
