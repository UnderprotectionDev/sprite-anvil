import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	measureVfxOverflow,
	type VfxAppearanceInput,
	vfxAppearanceFrameSchema,
	vfxAppearanceInputSchema,
} from "@sprite-anvil/api/vfx-appearance-reviews";
import { Button } from "@sprite-anvil/ui/components/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VfxAppearancePreview } from "./vfx-appearance-preview";

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
	const [draft, setDraft] = useState<VfxAppearanceInput>(
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
	const update = <K extends keyof VfxAppearanceInput>(
		key: K,
		value: VfxAppearanceInput[K]
	) => {
		if (
			["frames", "cell", "looping", "opacity", "sceneAssetVersionId"].includes(
				key
			)
		) {
			setReady(false);
			setPlaying(false);
		}
		setDraft((current) => ({ ...current, [key]: value }));
	};
	const frameUpdate = (index: number, key: string, value: number | string) => {
		update(
			"frames",
			draft.frames.map((frame, position) => {
				if (position !== index) {
					return frame;
				}
				if (key === "assetVersionId" || key === "frameKey") {
					return { ...frame, [key]: value };
				}
				if (key === "durationMs") {
					return { ...frame, durationMs: Number(value) };
				}
				if (key === "offsetX" || key === "offsetY") {
					return {
						...frame,
						offset: {
							...frame.offset,
							[key === "offsetX" ? "x" : "y"]: Number(value),
						},
					};
				}
				return { ...frame, region: { ...frame.region, [key]: Number(value) } };
			})
		);
	};
	const valid = vfxAppearanceInputSchema.safeParse(draft).success;
	return (
		<form
			className="space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				if (!disabled && ready && valid) {
					void onSave(draft);
				}
			}}
		>
			<fieldset className="space-y-3" disabled={disabled}>
				<legend>VFX appearance and overflow</legend>
				<label className="block">
					Effect name
					<input
						className="ml-2 rounded border p-2"
						onChange={(event) =>
							setDraft({ ...draft, name: event.target.value })
						}
						value={draft.name}
					/>
				</label>
				<div className="flex flex-wrap gap-4">
					{(["width", "height"] as const).map((axis) => (
						<label key={axis}>
							Cell {axis}
							<input
								className="ml-2 w-24 rounded border p-2"
								max={4096}
								min={1}
								onChange={(event) =>
									update("cell", {
										...draft.cell,
										[axis]: Number(event.target.value),
									})
								}
								type="number"
								value={draft.cell[axis]}
							/>
						</label>
					))}
				</div>
				{draft.frames.map((frame, index) => (
					<fieldset
						className="flex flex-wrap gap-3 rounded border p-3"
						key={rowIds[index]}
					>
						<legend>Frame {index + 1}</legend>
						<label>
							Effect version
							<select
								className="ml-2 rounded border p-2"
								onChange={(event) =>
									frameUpdate(index, "assetVersionId", event.target.value)
								}
								value={frame.assetVersionId}
							>
								<option value="">Choose a version</option>
								{effectVersions.map((version) => (
									<option key={version.id} value={version.id}>
										{recordNames[version.assetRecordId] ?? "Unavailable asset"}{" "}
										· v{version.versionNumber}
									</option>
								))}
							</select>
						</label>
						<label>
							Frame key
							<input
								className="ml-2 rounded border p-2"
								onChange={(event) =>
									frameUpdate(index, "frameKey", event.target.value)
								}
								value={frame.frameKey}
							/>
						</label>
						{(
							[
								"durationMs",
								"x",
								"y",
								"width",
								"height",
								"offsetX",
								"offsetY",
							] as const
						).map((key) => (
							<label key={key}>
								{
									{
										durationMs: "Duration (ms)",
										x: "Source x",
										y: "Source y",
										width: "Frame width",
										height: "Frame height",
										offsetX: "Offset x",
										offsetY: "Offset y",
									}[key]
								}
								<input
									className="ml-2 w-24 rounded border p-2"
									onChange={(event) =>
										frameUpdate(index, key, event.target.value)
									}
									type="number"
									value={
										{
											durationMs: frame.durationMs,
											...frame.region,
											offsetX: frame.offset.x,
											offsetY: frame.offset.y,
										}[key]
									}
								/>
							</label>
						))}
						<Button
							disabled={draft.frames.length === 1}
							onClick={() => {
								setRowIds(rowIds.filter((_, position) => position !== index));
								update(
									"frames",
									draft.frames.filter((_, position) => position !== index)
								);
							}}
							type="button"
						>
							Remove frame {index + 1}
						</Button>
					</fieldset>
				))}
				<Button
					disabled={draft.frames.length >= 64}
					onClick={() => {
						setRowIds([...rowIds, crypto.randomUUID()]);
						update("frames", [
							...draft.frames,
							{
								assetVersionId: "",
								frameKey: `frame-${crypto.randomUUID()}`,
								durationMs: 100,
								region: { x: 0, y: 0, width: 16, height: 16 },
								offset: { x: 0, y: 0 },
							},
						]);
					}}
					type="button"
				>
					Add frame
				</Button>
				<label className="block">
					Scene version
					<select
						className="ml-2 rounded border p-2"
						onChange={(event) =>
							update("sceneAssetVersionId", event.target.value)
						}
						value={draft.sceneAssetVersionId}
					>
						<option value="">Choose a scene version</option>
						{versions.map((version) => (
							<option key={version.id} value={version.id}>
								{recordNames[version.assetRecordId] ?? "Unavailable asset"} · v
								{version.versionNumber}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					Opacity
					<input
						className="ml-2"
						max={1}
						min={0}
						onChange={(event) => update("opacity", Number(event.target.value))}
						step={0.05}
						type="number"
						value={draft.opacity}
					/>
				</label>
				<label className="block">
					<input
						checked={draft.looping}
						onChange={(event) => update("looping", event.target.checked)}
						type="checkbox"
					/>{" "}
					Loop playback
				</label>
				<label className="block">
					<input
						checked={draft.overflowAllowed}
						onChange={(event) =>
							update("overflowAllowed", event.target.checked)
						}
						type="checkbox"
					/>{" "}
					Permit intentional cell overflow
				</label>
				<p>
					Measured frame-area overflow: {measureVfxOverflow(draft)} px. Source
					cropping and unreadable alpha cannot be waived.
				</p>
				<label className="block">
					Cell overflow Quality Waiver
					<select
						className="ml-2 rounded border p-2"
						onChange={(event) =>
							setDraft({
								...draft,
								qualityWaiverEvidenceId: event.target.value || null,
							})
						}
						value={draft.qualityWaiverEvidenceId ?? ""}
					>
						<option value="">No waiver</option>
						{waivers.map((waiver) => (
							<option key={waiver.id} value={waiver.id}>
								{waiver.label}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					Result
					<select
						className="ml-2 rounded border p-2"
						onChange={(event) => {
							const outcome = event.target.value;
							if (
								outcome === "passed" ||
								outcome === "failed" ||
								outcome === "inconclusive"
							) {
								setDraft({ ...draft, outcome });
							}
						}}
						value={draft.outcome}
					>
						<option value="passed">Passed</option>
						<option value="failed">Failed</option>
						<option value="inconclusive">Inconclusive</option>
					</select>
				</label>
				<label className="block">
					Review notes
					<textarea
						className="mt-1 block w-full rounded border p-2"
						onChange={(event) =>
							setDraft({ ...draft, rationale: event.target.value })
						}
						value={draft.rationale}
					/>
				</label>
			</fieldset>
			<div className="flex flex-wrap items-center gap-3">
				<Button
					disabled={!ready}
					onClick={() => setPlaying((value) => !value)}
					type="button"
				>
					{playing ? "Pause" : "Play"}
				</Button>
				<Button
					disabled={!ready}
					onClick={() => {
						setPlaying(false);
						setElapsed(0);
					}}
					type="button"
				>
					Restart
				</Button>
				<label>
					Playback position
					<input
						disabled={!ready}
						max={Math.max(1, total)}
						min={0}
						onChange={(event) => {
							setPlaying(false);
							setElapsed(Number(event.target.value));
						}}
						type="range"
						value={
							draft.looping
								? elapsed % Math.max(1, total)
								: Math.min(elapsed, Math.max(1, total))
						}
					/>
				</label>
			</div>
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
