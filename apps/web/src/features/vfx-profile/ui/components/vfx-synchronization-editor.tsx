import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ReadinessEvidence } from "@sprite-anvil/api/family-readiness";
import {
	type VfxSynchronizationInput,
	vfxBackgrounds,
	vfxSynchronizationInputSchema,
} from "@sprite-anvil/api/vfx-synchronization";
import { Button } from "@sprite-anvil/ui/components/button";
import { useCallback, useState } from "react";
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
	const [input, setInput] = useState<VfxSynchronizationInput>(
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
	const validation = vfxSynchronizationInputSchema.safeParse(input);
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
				if (validation.success && previewReady && !disabled && !readOnly) {
					void onSave(validation.data);
				}
			}}
		>
			<fieldset className="space-y-4" disabled={disabled || readOnly}>
				<label className="block">
					Review name
					<input
						className="block w-full rounded border p-2"
						maxLength={120}
						onChange={(e) => setInput({ ...input, name: e.target.value })}
						required
						value={input.name}
					/>
				</label>
				<div className="grid gap-4 lg:grid-cols-2">
					<VfxClipEditor
						catalog={catalog}
						clip={input.effect}
						label="Effect"
						onChange={(effect) => setInput({ ...input, effect })}
						recordNames={recordNames}
						versionIds={effectVersionIds}
					/>
					<VfxClipEditor
						catalog={catalog}
						clip={input.owner}
						label="Owner"
						onChange={(owner) => setInput({ ...input, owner })}
						recordNames={recordNames}
						versionIds={ownerVersionIds}
					/>
				</div>
				<div className="flex flex-wrap gap-3">
					<label>
						Game event
						<input
							className="block rounded border p-2"
							maxLength={200}
							onChange={(e) =>
								setInput({
									...input,
									event: { ...input.event, id: e.target.value },
								})
							}
							readOnly={!!input.sourceReviewId}
							required
							value={input.event.id}
						/>
					</label>
					<label>
						Event time (ms)
						<input
							className="block rounded border p-2"
							min={0}
							onChange={(e) =>
								setInput({
									...input,
									event: { ...input.event, timeMs: Number(e.target.value) },
								})
							}
							readOnly={!!input.sourceReviewId}
							type="number"
							value={input.event.timeMs}
						/>
					</label>
					<label>
						Layer
						<input
							className="block w-24 rounded border p-2"
							max={100}
							min={-100}
							onChange={(e) =>
								setInput({ ...input, layer: Number(e.target.value) })
							}
							type="number"
							value={input.layer}
						/>
					</label>
				</div>
				<p className="text-muted-foreground text-sm">
					Define the owner's event id and time for these exact frames. The owner
					uses layer 0. Negative effect layers appear behind it. Event time is
					clip-relative and remains fixed in a selective repair.
				</p>
				<label className="block">
					Scene background
					<select
						className="block w-full rounded border bg-background p-2"
						onChange={(e) =>
							setInput({ ...input, sceneAssetVersionId: e.target.value })
						}
						value={input.sceneAssetVersionId}
					>
						<option value="">Choose a scene version</option>
						{sceneVersions.map((v) => (
							<option key={v.id} value={v.id}>
								{recordNames[v.assetRecordId] ?? v.assetRecordId} · Asset
								Version {v.versionNumber}
							</option>
						))}
					</select>
				</label>
				<label className="flex gap-2">
					<input
						checked={input.overflowAllowed}
						onChange={(e) =>
							setInput({ ...input, overflowAllowed: e.target.checked })
						}
						type="checkbox"
					/>{" "}
					Allow intentional cell overflow
				</label>
				{waivers.length ? (
					<fieldset>
						<legend>Existing Quality Waivers</legend>
						{waivers.map((waiver) => (
							<label className="flex gap-2" key={waiver.id}>
								<input
									checked={input.waiverEvidenceIds.includes(waiver.id)}
									onChange={(e) =>
										setInput({
											...input,
											waiverEvidenceIds: e.target.checked
												? [...input.waiverEvidenceIds, waiver.id]
												: input.waiverEvidenceIds.filter(
														(id) => id !== waiver.id
													),
										})
									}
									type="checkbox"
								/>
								{waiver.ruleId} · {waiver.rationale}
							</label>
						))}
					</fieldset>
				) : (
					<p>
						No current overflow Quality Waiver is selected. Permission never
						waives unreadable alpha or broken frame links.
					</p>
				)}
			</fieldset>
			<VfxSynchronizedPreview
				input={input}
				onReady={onReady}
				versions={catalog.assetVersions}
			/>
			<fieldset className="space-y-3" disabled={disabled || readOnly}>
				<legend>Playback evidence</legend>
				{input.backgrounds.map((evidence, index) => (
					<fieldset
						className="flex flex-wrap gap-3 rounded border p-3"
						key={evidence.background}
					>
						<legend>{evidence.background}</legend>
						{(["alone", "synchronized"] as const).map((mode) => (
							<label key={mode}>
								{mode === "alone" ? "Effect alone result" : "With owner result"}
								<select
									className="block rounded border bg-background p-2"
									onChange={(e) =>
										setInput({
											...input,
											backgrounds: input.backgrounds.map((b, i) =>
												i === index ? { ...b, [mode]: e.target.value } : b
											),
										})
									}
									value={evidence[mode]}
								>
									<option value="inconclusive">Inconclusive</option>
									<option value="passed">Passed</option>
									<option value="failed">Failed</option>
								</select>
							</label>
						))}
						<label className="grow">
							Playback notes
							<textarea
								className="block w-full rounded border p-2"
								maxLength={1000}
								onChange={(e) =>
									setInput({
										...input,
										backgrounds: input.backgrounds.map((b, i) =>
											i === index ? { ...b, notes: e.target.value } : b
										),
									})
								}
								required
								value={evidence.notes}
							/>
						</label>
					</fieldset>
				))}
				<label className="block">
					Review rationale
					<textarea
						className="block w-full rounded border p-2"
						maxLength={2000}
						onChange={(e) => setInput({ ...input, rationale: e.target.value })}
						required
						value={input.rationale}
					/>
				</label>
				{!readOnly && (
					<Button
						disabled={disabled || !previewReady || !validation.success}
						type="submit"
					>
						Save synchronization review
					</Button>
				)}
			</fieldset>
			{!(readOnly || validation.success) && (
				<p role="status">
					Complete the frame versions, positive durations, origins, event, scene
					and playback notes before saving.
				</p>
			)}
		</form>
	);
}
