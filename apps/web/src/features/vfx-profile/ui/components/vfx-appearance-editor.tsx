import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	measureVfxOverflow,
	type VfxAppearanceInput,
	vfxAppearanceFrameSchema,
} from "@sprite-anvil/api/vfx-appearance-reviews";
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
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { vfxAppearanceFormSchema, vfxReviewResultSchema } from "../../schemas";
import { VfxAppearancePlaybackControls } from "./vfx-appearance-playback-controls";
import { VfxAppearancePreview } from "./vfx-appearance-preview";

const frameNumberFields = [
	{ label: "Duration (ms)", path: "durationMs" },
	{ label: "Source x", path: "region.x" },
	{ label: "Source y", path: "region.y" },
	{ label: "Frame width", path: "region.width" },
	{ label: "Frame height", path: "region.height" },
	{ label: "Offset x", path: "offset.x" },
	{ label: "Offset y", path: "offset.y" },
] as const;

export function VfxAppearanceEditor({
	projectId,
	assetFamilyId,
	contractRevisionId,
	effectVersions,
	versions,
	initial,
	disabled,
	onSave,
	waivers,
	recordNames = {},
}: {
	projectId: string;
	assetFamilyId: string;
	contractRevisionId: string;
	effectVersions: AssetVersion[];
	versions: AssetVersion[];
	initial?: VfxAppearanceInput;
	disabled: boolean;
	onSave: (input: VfxAppearanceInput) => Promise<void>;
	waivers: { id: string; label: string }[];
	recordNames?: Record<string, string>;
}) {
	const loopingId = useId();
	const overflowId = useId();
	const [defaults] = useState<VfxAppearanceInput>(
		() =>
			initial ?? {
				id: crypto.randomUUID(),
				projectId,
				assetFamilyId,
				contractRevisionId,
				name: "",
				cell: { width: 16, height: 16 },
				frames: [
					{
						assetVersionId: "",
						frameKey: "frame-1",
						region: { x: 0, y: 0, width: 16, height: 16 },
						durationMs: 100,
						offset: { x: 0, y: 0 },
					},
				],
				looping: false,
				opacity: 1,
				sceneAssetVersionId: "",
				overflowAllowed: false,
				qualityWaiverEvidenceId: null,
				backgrounds: ["light", "dark", "transparent", "scene"],
				outcome: "inconclusive",
				rationale: "",
			}
	);
	const [ready, setReady] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const form = useForm({
		defaultValues: defaults,
		onSubmit: async ({ value }) => {
			if (!disabled && ready) {
				await onSave(value);
			}
		},
		validators: { onSubmit: vfxAppearanceFormSchema },
	});
	const draft = useStore(form.store, (state) => state.values);
	const total = draft.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
	const { frames, cell, looping, opacity, sceneAssetVersionId } = draft;
	const playback = useMemo(
		() => ({
			name: "Effect preview",
			frames,
			cell,
			looping,
			opacity,
			sceneAssetVersionId,
			backgrounds: ["light", "dark", "transparent", "scene"] as const,
		}),
		[frames, cell, looping, opacity, sceneAssetVersionId]
	);
	const [rowIds, setRowIds] = useState(() =>
		draft.frames.map(() => crypto.randomUUID())
	);

	const onReady = useCallback((value: boolean) => {
		setReady(value);
		setPlaying(false);
		setElapsed(0);
	}, []);
	useEffect(() => {
		if (!playing) {
			return;
		}
		let request = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			const delta = now - previous;
			previous = now;
			setElapsed((value) => value + delta);
			request = requestAnimationFrame(tick);
		};
		request = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(request);
	}, [playing]);
	useEffect(() => {
		if (!draft.looping && elapsed >= total) {
			setPlaying(false);
			setElapsed(total);
		}
	}, [draft.looping, elapsed, total]);
	const markPreviewStale = () => {
		setReady(false);
		setPlaying(false);
	};
	const valid = vfxAppearanceFormSchema.safeParse(draft).success;
	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
		>
			<FieldSet className="space-y-3" disabled={disabled}>
				<FieldLegend>VFX appearance and overflow</FieldLegend>
				<form.Field name="name">
					{(field) => (
						<Label className="block">
							Effect name
							<Input
								className="ml-2 inline-block w-auto rounded border p-2"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<div className="flex flex-wrap gap-4">
					{(["width", "height"] as const).map((axis) => (
						<form.Field key={axis} name={`cell.${axis}`}>
							{(field) => (
								<Label>
									Cell {axis}
									<Input
										className="ml-2 w-24 rounded border p-2"
										max={4096}
										min={1}
										onChange={(event) => {
											markPreviewStale();
											field.handleChange(Number(event.target.value));
										}}
										type="number"
										value={field.state.value}
									/>
								</Label>
							)}
						</form.Field>
					))}
				</div>
				<form.Field mode="array" name="frames">
					{(framesField) => (
						<>
							{framesField.state.value.map((_frame, index) => (
								<FieldSet
									className="flex flex-wrap gap-3 rounded border p-3"
									key={rowIds[index]}
								>
									<FieldLegend>Frame {index + 1}</FieldLegend>
									<form.Field name={`frames[${index}].assetVersionId`}>
										{(field) => (
											<Label>
												Effect version
												<NativeSelect
													className="ml-2"
													onChange={(event) => {
														markPreviewStale();
														field.handleChange(event.target.value);
													}}
													value={field.state.value}
												>
													<NativeSelectOption value="">
														Choose a version
													</NativeSelectOption>
													{effectVersions.map((version) => (
														<NativeSelectOption
															key={version.id}
															value={version.id}
														>
															{recordNames[version.assetRecordId] ??
																"Unavailable asset"}{" "}
															· v{version.versionNumber}
														</NativeSelectOption>
													))}
												</NativeSelect>
											</Label>
										)}
									</form.Field>
									<form.Field name={`frames[${index}].frameKey`}>
										{(field) => (
											<Label>
												Frame key
												<Input
													className="ml-2 w-auto rounded border p-2"
													onChange={(event) => {
														markPreviewStale();
														field.handleChange(event.target.value);
													}}
													value={field.state.value}
												/>
											</Label>
										)}
									</form.Field>
									{frameNumberFields.map(({ label, path }) => (
										<form.Field key={path} name={`frames[${index}].${path}`}>
											{(field) => (
												<Label>
													{label}
													<Input
														className="ml-2 w-24 rounded border p-2"
														onChange={(event) => {
															markPreviewStale();
															field.handleChange(Number(event.target.value));
														}}
														type="number"
														value={field.state.value}
													/>
												</Label>
											)}
										</form.Field>
									))}
									<Button
										disabled={framesField.state.value.length === 1}
										onClick={() => {
											markPreviewStale();
											setRowIds(
												rowIds.filter((_, position) => position !== index)
											);
											void framesField.removeValue(index);
										}}
										type="button"
									>
										Remove frame {index + 1}
									</Button>
								</FieldSet>
							))}
							<Button
								disabled={framesField.state.value.length >= 64}
								onClick={() => {
									markPreviewStale();
									setRowIds([...rowIds, crypto.randomUUID()]);
									void framesField.pushValue({
										assetVersionId: "",
										frameKey: `frame-${crypto.randomUUID()}`,
										durationMs: 100,
										region: { x: 0, y: 0, width: 16, height: 16 },
										offset: { x: 0, y: 0 },
									});
								}}
								type="button"
							>
								Add frame
							</Button>
						</>
					)}
				</form.Field>
				<form.Field name="sceneAssetVersionId">
					{(field) => (
						<Label className="block">
							Scene version
							<NativeSelect
								className="ml-2"
								onChange={(event) => {
									markPreviewStale();
									field.handleChange(event.target.value);
								}}
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Choose a scene version
								</NativeSelectOption>
								{versions.map((version) => (
									<NativeSelectOption key={version.id} value={version.id}>
										{recordNames[version.assetRecordId] ?? "Unavailable asset"}{" "}
										· v{version.versionNumber}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="opacity">
					{(field) => (
						<Label className="block">
							Opacity
							<Input
								className="ml-2 inline-block w-auto"
								max={1}
								min={0}
								onChange={(event) => {
									markPreviewStale();
									field.handleChange(Number(event.target.value));
								}}
								step={0.05}
								type="number"
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field name="looping">
					{(field) => (
						<Label className="block" htmlFor={loopingId}>
							<Checkbox
								checked={field.state.value}
								disabled={disabled}
								id={loopingId}
								onCheckedChange={(checked) => {
									markPreviewStale();
									field.handleChange(checked);
								}}
							/>{" "}
							Loop playback
						</Label>
					)}
				</form.Field>
				<form.Field name="overflowAllowed">
					{(field) => (
						<Label className="block" htmlFor={overflowId}>
							<Checkbox
								checked={field.state.value}
								disabled={disabled}
								id={overflowId}
								onCheckedChange={(checked) => field.handleChange(checked)}
							/>{" "}
							Permit intentional cell overflow
						</Label>
					)}
				</form.Field>
				<p>
					Measured frame-area overflow: {measureVfxOverflow(draft)} px. Source
					cropping and unreadable alpha cannot be waived.
				</p>
				<form.Field name="qualityWaiverEvidenceId">
					{(field) => (
						<Label className="block">
							Cell overflow Quality Waiver
							<NativeSelect
								className="ml-2"
								onChange={(event) =>
									field.handleChange(event.target.value || null)
								}
								value={field.state.value ?? ""}
							>
								<NativeSelectOption value="">No waiver</NativeSelectOption>
								{waivers.map((waiver) => (
									<NativeSelectOption key={waiver.id} value={waiver.id}>
										{waiver.label}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="outcome">
					{(field) => (
						<Label className="block">
							Result
							<NativeSelect
								className="ml-2"
								onChange={(event) => {
									const outcome = vfxReviewResultSchema.safeParse(
										event.target.value
									);
									if (outcome.success) {
										field.handleChange(outcome.data);
									}
								}}
								value={field.state.value}
							>
								<NativeSelectOption value="passed">Passed</NativeSelectOption>
								<NativeSelectOption value="failed">Failed</NativeSelectOption>
								<NativeSelectOption value="inconclusive">
									Inconclusive
								</NativeSelectOption>
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="rationale">
					{(field) => (
						<Label className="block">
							Review notes
							<Textarea
								className="mt-1 block w-full rounded border p-2"
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
			</FieldSet>
			<VfxAppearancePlaybackControls
				durationMs={Math.max(1, total)}
				onRestart={() => {
					setPlaying(false);
					setElapsed(0);
				}}
				onSeek={(position) => {
					setPlaying(false);
					setElapsed(position);
				}}
				onTogglePlayback={() => setPlaying((value) => !value)}
				playing={playing}
				positionMs={
					draft.looping
						? elapsed % Math.max(1, total)
						: Math.min(elapsed, Math.max(1, total))
				}
				ready={ready}
			/>
			{draft.frames.every(
				(frame) => vfxAppearanceFrameSchema.safeParse(frame).success
			) &&
			draft.cell.width > 0 &&
			draft.cell.height > 0 &&
			draft.opacity >= 0 &&
			draft.opacity <= 1 &&
			draft.sceneAssetVersionId ? (
				<VfxAppearancePreview
					elapsedMs={elapsed}
					input={playback}
					onReady={onReady}
					versions={versions}
				/>
			) : (
				<p>Select effect and scene versions to preview all four backgrounds.</p>
			)}
			<Button disabled={disabled || !ready || !valid} type="submit">
				Save VFX review
			</Button>
		</form>
	);
}
