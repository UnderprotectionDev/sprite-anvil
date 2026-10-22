import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { BackgroundLayerLayoutRecord } from "@sprite-anvil/api/background-layer-layouts";
import {
	type BackgroundScrollingTestInput,
	backgroundScrollingChecks,
	backgroundScrollingTestInputSchema,
	type BackgroundScrollingSetup as ScrollingSetup,
} from "@sprite-anvil/api/background-scrolling-tests";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { BackgroundScrollingPreview } from "./background-scrolling-preview";

interface Version {
	assetRecordId: string;
	id: string;
	integrityVerified: boolean;
	previewUrl: string;
	sourceImageDimensions?: { width: number; height: number } | null;
}
const checkLabels = {
	loop: "Loop",
	seam: "Seam",
	crop: "Crop",
	contrast: "Contrast",
	playerVisibility: "Player visibility",
};
const labelClass = "flex flex-col items-start gap-1 leading-normal";
const inputClass = "block w-auto";
const emptyObservations: BackgroundScrollingTestInput["observations"] = {
	loop: { outcome: "inconclusive", notes: "" },
	seam: { outcome: "inconclusive", notes: "" },
	crop: { outcome: "inconclusive", notes: "" },
	contrast: { outcome: "inconclusive", notes: "" },
	playerVisibility: { outcome: "inconclusive", notes: "" },
};
export function BackgroundScrollingSetup({
	layout,
	versions,
	assetRecords,
}: {
	layout: BackgroundLayerLayoutRecord;
	versions: Version[];
	assetRecords: Pick<
		AssetRecord,
		"id" | "name" | "assetCategory" | "availability"
	>[];
}) {
	const [setup, setSetup] = useState<ScrollingSetup>(() => ({
		layoutId: layout.id,
		durationMs: 10_000,
		motions: [...layout.layers]
			.sort((a, b) => a.order - b.order)
			.map((layer, index) => ({
				layerId: layer.id,
				speed: (index + 1) * 20,
				startOffset: 0,
				loop: true,
			})),
		player: {
			assetVersionId: "",
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			afterLayerId: layout.layers.at(-1)?.id ?? null,
		},
	}));
	const [playedMs, setPlayedMs] = useState(0);
	const [observations, setObservations] = useState(emptyObservations);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const saveMutation = useMutation(
		orpc.backgroundScrollingTests.save.mutationOptions(mutationMeta)
	);
	const [busy, setBusy] = useState(false);
	const [pending, setPending] = useState<BackgroundScrollingTestInput | null>(
		null
	);
	const query = useQuery(
		orpc.backgroundScrollingTests.list.queryOptions({
			input: {
				projectId: layout.projectId,
				assetFamilyId: layout.assetFamilyId,
			},
		})
	);
	const players = versions.filter(
		(version) =>
			version.integrityVerified &&
			version.sourceImageDimensions &&
			assetRecords.some(
				(record) =>
					record.id === version.assetRecordId &&
					record.assetCategory === "character_creature_animation" &&
					record.availability !== "erased"
			)
	);
	function change(next: ScrollingSetup) {
		setSetup(next);
		setObservations(emptyObservations);
		setPlayedMs(0);
		setMessage("");
		setError("");
	}
	function selectPlayer(assetVersionId: string) {
		const version = players.find((item) => item.id === assetVersionId);
		const size = version?.sourceImageDimensions;
		const [first] = layout.layers;
		if (!(size && first)) {
			return;
		}
		const scale = 1;
		const availableWidth = first.safeArea.width * scale;
		const availableHeight = first.safeArea.height * scale;
		// Integer source multiples preserve the player aspect ratio exactly.
		function gcd(a: number, b: number): number {
			return b === 0 ? a : gcd(b, a % b);
		}
		const divisor = gcd(size.width, size.height);
		const unitWidth = size.width / divisor;
		const unitHeight = size.height / divisor;
		const multiplier = Math.max(
			1,
			Math.floor(
				Math.min(availableWidth / unitWidth, availableHeight / unitHeight)
			)
		);
		change({
			...setup,
			player: {
				...setup.player,
				assetVersionId,
				x: first.safeArea.x - first.crop.x,
				y: first.safeArea.y - first.crop.y,
				width: unitWidth * multiplier,
				height: unitHeight * multiplier,
			},
		});
	}
	async function confirm(input: BackgroundScrollingTestInput) {
		const result = await query.refetch();
		const found = result.data?.find((record) => record.id === input.id);
		if (
			!result.isError &&
			found &&
			JSON.stringify(
				backgroundScrollingTestInputSchema.strip().parse(found)
			) === JSON.stringify(input)
		) {
			setPending(null);
			setError("");
			setMessage("Scrolling test saved.");
		} else {
			setError(
				"Could not confirm the scrolling test. Check current tests again or retry the same test."
			);
		}
	}
	async function persist(input: BackgroundScrollingTestInput) {
		if (busy) {
			return;
		}
		const recoveringPending = pending !== null;
		setBusy(true);
		setPending(input);
		setMessage("");
		setError("");
		try {
			await saveMutation.mutateAsync(input);
			await confirm(input);
		} catch (failure) {
			setError(getErrorMessage(failure, "Could not save the scrolling test."));
			if (!(recoveringPending || isWriteOutcomeUncertain(failure))) {
				setPending(null);
			}
		} finally {
			setBusy(false);
		}
	}
	async function save() {
		if (busy || pending) {
			return;
		}
		const parsed = backgroundScrollingTestInputSchema.safeParse({
			id: crypto.randomUUID(),
			projectId: layout.projectId,
			assetFamilyId: layout.assetFamilyId,
			setup,
			playbackMs: Math.round(playedMs),
			observations,
		});
		if (!parsed.success) {
			setError(parsed.error.issues.map((issue) => issue.message).join(" "));
			return;
		}
		await persist(parsed.data);
	}
	return (
		<section
			aria-label="Scrolling setup"
			className="space-y-3 rounded border p-3"
		>
			<h4 className="font-medium">Actual scrolling test</h4>
			<p>
				Horizontal speed uses target-frame pixels per second. Each crop scales
				to the first layer's frame. Negative speeds scroll right. Loop repeats
				the crop; without loop, a layer can leave the frame. User observations
				do not approve the family.
			</p>
			<FieldSet className="block space-y-3" disabled={busy || pending !== null}>
				<FieldLegend>Scrolling settings</FieldLegend>
				<Label className={labelClass}>
					Test duration (ms)
					<Input
						aria-label="Test duration (ms)"
						className={inputClass}
						max={120_000}
						min={1}
						onChange={(event) =>
							change({ ...setup, durationMs: Number(event.target.value) })
						}
						type="number"
						value={setup.durationMs}
					/>
				</Label>
				{setup.motions.map((motion) => (
					<FieldSet
						className="flex flex-row flex-wrap gap-3"
						key={motion.layerId}
					>
						<FieldLegend>{motion.layerId} scrolling</FieldLegend>
						<Label className={labelClass}>
							Relative speed (px/s)
							<Input
								aria-label={`${motion.layerId} relative speed (px/s)`}
								className={inputClass}
								max={10_000}
								min={-10_000}
								onChange={(event) =>
									change({
										...setup,
										motions: setup.motions.map((item) =>
											item.layerId === motion.layerId
												? { ...item, speed: Number(event.target.value) }
												: item
										),
									})
								}
								type="number"
								value={motion.speed}
							/>
						</Label>
						<Label className={labelClass}>
							Loop start offset (px)
							<Input
								aria-label={`${motion.layerId} loop start offset (px)`}
								className={inputClass}
								max={32_768}
								min={0}
								onChange={(event) =>
									change({
										...setup,
										motions: setup.motions.map((item) =>
											item.layerId === motion.layerId
												? { ...item, startOffset: Number(event.target.value) }
												: item
										),
									})
								}
								type="number"
								value={motion.startOffset}
							/>
						</Label>
						<Label
							className="flex items-center gap-2 leading-normal"
							htmlFor={`${motion.layerId}-loop`}
						>
							<Checkbox
								checked={motion.loop}
								disabled={busy || pending !== null}
								id={`${motion.layerId}-loop`}
								onCheckedChange={(checked) =>
									change({
										...setup,
										motions: setup.motions.map((item) =>
											item.layerId === motion.layerId
												? { ...item, loop: checked }
												: item
										),
									})
								}
							/>
							{motion.layerId} loop
						</Label>
					</FieldSet>
				))}
				<Label className={labelClass}>
					Exact player version
					<NativeSelect
						aria-label="Exact player version"
						className={inputClass}
						onChange={(event) => selectPlayer(event.target.value)}
						value={setup.player.assetVersionId}
					>
						<NativeSelectOption value="">
							Select a player version
						</NativeSelectOption>
						{players.map((version) => (
							<NativeSelectOption key={version.id} value={version.id}>
								{
									assetRecords.find(
										(record) => record.id === version.assetRecordId
									)?.name
								}{" "}
								· {version.id}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Label>
				{(["x", "y", "width", "height"] as const).map((field) => (
					<Label className={labelClass} key={field}>
						Player {field}
						<Input
							aria-label={`Player ${field}`}
							className={inputClass}
							min={field === "width" || field === "height" ? 1 : 0}
							onChange={(event) =>
								change({
									...setup,
									player: {
										...setup.player,
										[field]: Number(event.target.value),
									},
								})
							}
							type="number"
							value={setup.player[field]}
						/>
					</Label>
				))}
				<Label className={labelClass}>
					Player order
					<NativeSelect
						aria-label="Player order"
						className={inputClass}
						onChange={(event) =>
							change({
								...setup,
								player: {
									...setup.player,
									afterLayerId: event.target.value || null,
								},
							})
						}
						value={setup.player.afterLayerId ?? ""}
					>
						<NativeSelectOption value="">Behind all layers</NativeSelectOption>
						{[...layout.layers]
							.sort((a, b) => a.order - b.order)
							.map((layer) => (
								<NativeSelectOption key={layer.id} value={layer.id}>
									After {layer.id}
								</NativeSelectOption>
							))}
					</NativeSelect>
				</Label>
			</FieldSet>
			{setup.player.assetVersionId ? (
				<BackgroundScrollingPreview
					durationMs={setup.durationMs}
					layers={layout.layers}
					motions={setup.motions}
					onPlayback={setPlayedMs}
					player={setup.player}
					versions={versions}
				/>
			) : (
				<p>
					Select a readable character Asset Version to inspect the player
					silhouette.
				</p>
			)}
			<p>
				Actual playback: {Math.round(playedMs)} / {setup.durationMs} ms
			</p>
			<FieldSet className="block space-y-3" disabled={busy || pending !== null}>
				<FieldLegend>Human observations</FieldLegend>
				{backgroundScrollingChecks.map((check) => (
					<div className="flex flex-wrap gap-3" key={check}>
						<Label className={labelClass}>
							{checkLabels[check]} outcome
							<NativeSelect
								aria-label={`${checkLabels[check]} outcome`}
								className={inputClass}
								onChange={(event) =>
									setObservations({
										...observations,
										[check]: {
											...observations[check],
											outcome: event.target.value,
										},
									})
								}
								value={observations[check].outcome}
							>
								<NativeSelectOption value="passed">Passed</NativeSelectOption>
								<NativeSelectOption value="failed">Failed</NativeSelectOption>
								<NativeSelectOption value="inconclusive">
									Inconclusive
								</NativeSelectOption>
							</NativeSelect>
						</Label>
						<Label className={labelClass}>
							{checkLabels[check]} notes
							<Textarea
								aria-label={`${checkLabels[check]} notes`}
								className={inputClass}
								onChange={(event) =>
									setObservations({
										...observations,
										[check]: {
											...observations[check],
											notes: event.target.value,
										},
									})
								}
								value={observations[check].notes}
							/>
						</Label>
					</div>
				))}
				<Button
					disabled={
						playedMs < setup.durationMs || query.isError || query.isPending
					}
					onClick={save}
					type="button"
				>
					{busy ? "Saving…" : "Save scrolling test"}
				</Button>
			</FieldSet>
			{error ? <p role="alert">{error}</p> : null}
			{message ? <p role="status">{message}</p> : null}
			{pending ? (
				<div className="flex flex-wrap gap-3">
					<Button
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							try {
								await confirm(pending);
							} finally {
								setBusy(false);
							}
						}}
						type="button"
					>
						Check current tests
					</Button>
					<Button
						disabled={busy}
						onClick={() => persist(pending)}
						type="button"
					>
						Retry same scrolling test
					</Button>
				</div>
			) : null}
			{query.isError ? (
				<p role="alert">
					Could not load scrolling tests.{" "}
					<Button onClick={() => query.refetch()} type="button">
						Retry tests
					</Button>
				</p>
			) : null}
			<h4>Saved scrolling tests</h4>
			{query.data
				?.filter((record) => record.setup.layoutId === layout.id)
				.map((record) => (
					<article className="space-y-2 rounded border p-3" key={record.id}>
						<p>
							{new Date(record.createdAt).toLocaleString()} · Outcome:{" "}
							{record.outcome} · Player: {record.playerPin.assetRecordName} · v
							{record.playerPin.versionNumber}
						</p>
						{backgroundScrollingChecks.map((check) => (
							<p key={check}>
								{checkLabels[check]}: {record.observations[check].outcome} ·{" "}
								{record.observations[check].notes}
							</p>
						))}
						<p>
							Duration: {record.playbackMs} ms · Layout:{" "}
							{record.layoutSnapshot.id}
						</p>
						<Button
							disabled={busy || pending !== null}
							onClick={() => {
								change(record.setup);
								setObservations(record.observations);
							}}
							type="button"
						>
							Replay test
						</Button>
					</article>
				))}
		</section>
	);
}
