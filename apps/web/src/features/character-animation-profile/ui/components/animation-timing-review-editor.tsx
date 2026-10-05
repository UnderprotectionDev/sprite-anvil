import {
	type AnimationTimingReviewInput,
	animationTimingReviewInputSchema,
} from "@sprite-anvil/api/animation-timing-reviews";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import { Button } from "@sprite-anvil/ui/components/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimationTimingClipPreview } from "./animation-timing-clip-preview";
import {
	AnimationTimingEventTimeline,
	type AnimationTimingMetadataStatus,
} from "./animation-timing-event-timeline";

const noOperation = () => undefined;

const fourDirections = ["south", "west", "north", "east"];
const eightDirections = [
	"south",
	"south-west",
	"west",
	"north-west",
	"north",
	"north-east",
	"east",
	"south-east",
];
type EditorFrame =
	AnimationTimingReviewInput["directions"][number]["frames"][number] & {
		clientId: string;
	};
type EditorDirection = Omit<
	AnimationTimingReviewInput["directions"][number],
	"frames"
> & {
	clientId: string;
	frames: EditorFrame[];
};

const newFrame = (): EditorFrame => ({
	assetVersionId: "",
	clientId: crypto.randomUUID(),
	durationMs: 100,
	frameKey: "",
	motionPhase: null,
	region: null,
});
const newDirection = (direction: string): EditorDirection => ({
	clientId: crypto.randomUUID(),
	direction,
	frames: [newFrame()],
});

export function AnimationTimingReviewEditor({
	projectId,
	assetFamilyId,
	contractRevisionId,
	versions,
	gameplayMetadataRecords = [],
	gameplayMetadataStatus = "ready",
	onRetryGameplayMetadata = noOperation,
	onSave,
	disabled,
	initial,
	recordNames = {},
}: {
	projectId: string;
	assetFamilyId: string;
	contractRevisionId: string;
	versions: AssetVersion[];
	gameplayMetadataRecords?: GameplayMetadataRecord[];
	gameplayMetadataStatus?: AnimationTimingMetadataStatus;
	onRetryGameplayMetadata?: () => void;
	onSave: (input: AnimationTimingReviewInput) => Promise<void>;
	disabled: boolean;
	initial?: AnimationTimingReviewInput;
	recordNames?: Record<string, string>;
}) {
	const [directions, setDirections] = useState<EditorDirection[]>(
		initial?.directions.map((direction) => ({
			...direction,
			clientId: crypto.randomUUID(),
			frames: direction.frames.map((frame) => ({
				...frame,
				clientId: crypto.randomUUID(),
			})),
		})) ?? fourDirections.map(newDirection)
	);
	const [animationName, setAnimationName] = useState(
		initial?.animationName ?? ""
	);
	const [playbackSpeed, setPlaybackSpeed] = useState(
		initial?.playbackSpeed ?? 1
	);
	const [looping, setLooping] = useState(initial?.looping ?? true);
	const [outcome, setOutcome] = useState<
		AnimationTimingReviewInput["outcome"] | ""
	>(initial?.outcome ?? "");
	const [rationale, setRationale] = useState(initial?.rationale ?? "");
	const [zoom, setZoom] = useState(1);
	const [playing, setPlaying] = useState(false);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [ready, setReady] = useState<Record<string, boolean>>({});
	const onStatus = useCallback(
		(key: string, value: boolean) =>
			setReady((previous) =>
				previous[key] === value ? previous : { ...previous, [key]: value }
			),
		[]
	);
	const previewDirections = useMemo(
		() =>
			directions.map(({ direction, frames }) => ({
				direction,
				frames: frames.map(({ clientId: _clientId, ...frame }) => frame),
			})),
		[directions]
	);
	const maxTimelineMs = Math.max(
		0,
		...previewDirections.map((direction) =>
			direction.frames.reduce((total, frame) => total + frame.durationMs, 0)
		)
	);
	useEffect(() => {
		if (!playing) {
			return;
		}
		let animation = 0;
		let previous: number | null = null;
		const tick = (timestamp: number) => {
			if (previous !== null) {
				const deltaMs = timestamp - previous;
				setElapsedMs((value) => value + deltaMs * playbackSpeed);
			}
			previous = timestamp;
			animation = requestAnimationFrame(tick);
		};
		animation = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animation);
	}, [playing, playbackSpeed]);
	useEffect(() => {
		if (playing && !looping && elapsedMs >= maxTimelineMs) {
			setElapsedMs(maxTimelineMs);
			setPlaying(false);
		}
	}, [elapsedMs, looping, maxTimelineMs, playing]);

	const updateDirection = (
		index: number,
		change: (direction: EditorDirection) => EditorDirection
	) => {
		setPlaying(false);
		setElapsedMs(0);
		setDirections((previous) =>
			previous.map((direction, current) =>
				current === index ? change(direction) : direction
			)
		);
	};
	const [operationId] = useState(() => crypto.randomUUID());
	const candidate = {
		id: initial?.id ?? operationId,
		projectId,
		assetFamilyId,
		contractRevisionId,
		animationName,
		playbackSpeed,
		looping,
		directions: previewDirections,
		outcome,
		rationale,
	};
	const validation = animationTimingReviewInputSchema.safeParse(candidate);
	const previewReady = directions.every(
		(_, index) =>
			ready[`${index}:${JSON.stringify(previewDirections[index]?.frames)}`]
	);
	const canSave = validation.success && previewReady;
	const canPlay = previewReady && maxTimelineMs > 0;

	return (
		<div className="space-y-4">
			<p>
				Kare geçişleri ve hareket evreleri kullanıcı incelemesidir. Otomatik
				sanatsal hüküm verilmez.
			</p>
			<p>
				Kare süreleri bağımsızdır. Hareket evresi serbest metindir ve boş
				bırakılabilir.
			</p>
			<div className="flex flex-wrap items-end gap-4">
				<label className="block space-y-1 text-sm">
					Animasyon adı
					<input
						aria-label="Animasyon adı"
						className="block min-h-11 w-64 rounded-md border bg-background px-3 py-2"
						disabled={disabled}
						maxLength={120}
						onChange={(event) => setAnimationName(event.target.value)}
						required
						value={animationName}
					/>
				</label>
				<label className="block space-y-1 text-sm">
					Yön sayısı
					<select
						aria-label="Yön sayısı"
						className="block min-h-11 rounded-md border bg-background px-3 py-2"
						disabled={disabled}
						onChange={(event) => {
							setPlaying(false);
							setElapsedMs(0);
							const choices =
								Number(event.target.value) === 8
									? eightDirections
									: fourDirections;
							setDirections((previous) =>
								choices.map(
									(direction) =>
										previous.find((item) => item.direction === direction) ??
										newDirection(direction)
								)
							);
						}}
						value={directions.length}
					>
						<option value={4}>4</option>
						<option value={8}>8</option>
					</select>
				</label>
				<label className="block space-y-1 text-sm">
					Oynatma hızı
					<input
						aria-label="Oynatma hızı"
						className="block min-h-11 w-32 rounded-md border bg-background px-3 py-2"
						disabled={disabled}
						max={4}
						min={0.1}
						onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
						step={0.1}
						type="number"
						value={playbackSpeed}
					/>
				</label>
				<label className="flex min-h-11 items-center gap-2 text-sm">
					<input
						aria-label="Döngüde oynat"
						checked={looping}
						disabled={disabled}
						onChange={(event) => setLooping(event.target.checked)}
						type="checkbox"
					/>
					Döngüde oynat
				</label>
				<label className="block space-y-1 text-sm">
					Yakınlaştırma
					<select
						aria-label="Yakınlaştırma"
						className="block min-h-11 rounded-md border bg-background px-3 py-2"
						onChange={(event) => setZoom(Number(event.target.value))}
						value={zoom}
					>
						<option value={1}>1× (doğal)</option>
						<option value={2}>2×</option>
						<option value={4}>4×</option>
					</select>
				</label>
				<Button
					disabled={!canPlay}
					onClick={() => setPlaying((value) => !value)}
					type="button"
				>
					{playing ? "Duraklat" : "Birlikte oynat"}
				</Button>
				<Button
					disabled={!canPlay}
					onClick={() => {
						setPlaying(false);
						setElapsedMs(0);
					}}
					type="button"
				>
					Başa dön
				</Button>
				<label className="block space-y-1 text-sm">
					Oynatma konumu (ms)
					<input
						aria-label="Oynatma konumu (ms)"
						className="block min-h-11 w-40 rounded-md border bg-background px-3 py-2"
						min={0}
						onChange={(event) => {
							setPlaying(false);
							setElapsedMs(Math.max(0, Number(event.target.value)));
						}}
						type="number"
						value={Math.floor(elapsedMs)}
					/>
				</label>
			</div>
			<p>
				Bütün yönler aynı milisaniye saatini kullanır. Soluk kareler önceki ve
				sıradaki kareyi gösterir; döngü sınırında ilk ve son kare
				karşılaştırılır.
			</p>
			<AnimationTimingEventTimeline
				contractRevisionId={contractRevisionId}
				directions={previewDirections}
				gameplayMetadataRecords={gameplayMetadataRecords}
				gameplayMetadataStatus={gameplayMetadataStatus}
				onRetryGameplayMetadata={onRetryGameplayMetadata}
				projectId={projectId}
			/>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{directions.map((direction, index) => (
					<fieldset
						className="min-w-0 space-y-3 rounded border p-3"
						disabled={disabled}
						key={direction.clientId}
					>
						<legend>Yön {index + 1}</legend>
						<label className="block space-y-1 text-sm">
							Yön adı
							<input
								aria-label={`Yön adı ${index + 1}`}
								className="block min-h-11 w-full rounded-md border bg-background px-3 py-2"
								maxLength={80}
								onChange={(event) =>
									updateDirection(index, (item) => ({
										...item,
										direction: event.target.value,
									}))
								}
								required
								value={direction.direction}
							/>
						</label>
						<AnimationTimingClipPreview
							elapsedMs={elapsedMs}
							frames={previewDirections[index]?.frames ?? []}
							label={direction.direction || `Yön ${index + 1}`}
							looping={looping}
							onStatus={onStatus}
							statusKey={`${index}:${JSON.stringify(previewDirections[index]?.frames)}`}
							versions={versions}
							zoom={zoom}
						/>
						{direction.frames.map((frame, frameIndex) => (
							<div className="space-y-3 border-t pt-3" key={frame.clientId}>
								<p>Kare {frameIndex + 1}</p>
								<label className="block space-y-1 text-sm">
									Kare kimliği
									<input
										aria-label={`Yön ${index + 1} kare ${frameIndex + 1} kimliği`}
										className="block min-h-11 w-full rounded-md border bg-background px-3 py-2"
										maxLength={512}
										onChange={(event) =>
											updateDirection(index, (item) => ({
												...item,
												frames: item.frames.map((current, position) =>
													position === frameIndex
														? { ...current, frameKey: event.target.value }
														: current
												),
											}))
										}
										required
										value={frame.frameKey}
									/>
								</label>
								<label className="block space-y-1 text-sm">
									Varlık Sürümü
									<select
										aria-label={`Yön ${index + 1} kare ${frameIndex + 1} sürümü`}
										className="block min-h-11 max-w-full rounded-md border bg-background px-3 py-2"
										onChange={(event) =>
											updateDirection(index, (item) => ({
												...item,
												frames: item.frames.map((current, position) =>
													position === frameIndex
														? { ...current, assetVersionId: event.target.value }
														: current
												),
											}))
										}
										value={frame.assetVersionId}
									>
										<option value="">Sürüm seçin</option>
										{versions.map((version) => (
											<option key={version.id} value={version.id}>
												{recordNames[version.assetRecordId] ?? "Varlık"} · Sürüm{" "}
												{version.versionNumber}
											</option>
										))}
									</select>
								</label>
								<label className="block space-y-1 text-sm">
									Süre (ms)
									<input
										aria-label={`Yön ${index + 1} kare ${frameIndex + 1} süre (ms)`}
										className="block min-h-11 w-full rounded-md border bg-background px-3 py-2"
										max={60_000}
										min={1}
										onChange={(event) =>
											updateDirection(index, (item) => ({
												...item,
												frames: item.frames.map((current, position) =>
													position === frameIndex
														? {
																...current,
																durationMs: Number(event.target.value),
															}
														: current
												),
											}))
										}
										type="number"
										value={frame.durationMs}
									/>
								</label>
								<label className="block space-y-1 text-sm">
									Hareket evresi (isteğe bağlı)
									<input
										aria-label={`Yön ${index + 1} kare ${frameIndex + 1} hareket evresi`}
										className="block min-h-11 w-full rounded-md border bg-background px-3 py-2"
										maxLength={120}
										onChange={(event) =>
											updateDirection(index, (item) => ({
												...item,
												frames: item.frames.map((current, position) =>
													position === frameIndex
														? {
																...current,
																motionPhase: event.target.value || null,
															}
														: current
												),
											}))
										}
										value={frame.motionPhase ?? ""}
									/>
								</label>
								<label className="flex min-h-11 items-center gap-2 text-sm">
									<input
										aria-label={`Yön ${index + 1} kare ${frameIndex + 1} sprite sheet alanı`}
										checked={frame.region !== null}
										onChange={(event) =>
											updateDirection(index, (item) => ({
												...item,
												frames: item.frames.map((current, position) =>
													position === frameIndex
														? {
																...current,
																region: event.target.checked
																	? { x: 0, y: 0, width: 32, height: 32 }
																	: null,
															}
														: current
												),
											}))
										}
										type="checkbox"
									/>
									Sprite sheet alanı
								</label>
								{frame.region ? (
									<div className="flex flex-wrap gap-2">
										{(["x", "y", "width", "height"] as const).map((field) => (
											<label className="block space-y-1 text-sm" key={field}>
												{field}
												<input
													aria-label={`Yön ${index + 1} kare ${frameIndex + 1} ${field}`}
													className="block min-h-11 w-20 rounded-md border bg-background px-2 py-2"
													min={field === "x" || field === "y" ? 0 : 1}
													onChange={(event) =>
														updateDirection(index, (item) => ({
															...item,
															frames: item.frames.map((current, position) =>
																position === frameIndex && current.region
																	? {
																			...current,
																			region: {
																				...current.region,
																				[field]: Number(event.target.value),
																			},
																		}
																	: current
															),
														}))
													}
													type="number"
													value={frame.region?.[field] ?? 0}
												/>
											</label>
										))}
									</div>
								) : null}
								<div className="flex flex-wrap gap-2">
									<Button
										disabled={frameIndex === 0}
										onClick={() =>
											updateDirection(index, (item) => {
												const reordered = [...item.frames];
												[reordered[frameIndex - 1], reordered[frameIndex]] = [
													reordered[frameIndex],
													reordered[frameIndex - 1],
												];
												return { ...item, frames: reordered };
											})
										}
										type="button"
									>
										Kareyi yukarı taşı
									</Button>
									<Button
										disabled={frameIndex === direction.frames.length - 1}
										onClick={() =>
											updateDirection(index, (item) => {
												const reordered = [...item.frames];
												[reordered[frameIndex], reordered[frameIndex + 1]] = [
													reordered[frameIndex + 1],
													reordered[frameIndex],
												];
												return { ...item, frames: reordered };
											})
										}
										type="button"
									>
										Kareyi aşağı taşı
									</Button>
									<Button
										disabled={direction.frames.length <= 1}
										onClick={() =>
											updateDirection(index, (item) => ({
												...item,
												frames: item.frames.filter(
													(_, position) => position !== frameIndex
												),
											}))
										}
										type="button"
									>
										Kareyi kaldır
									</Button>
								</div>
							</div>
						))}
						<Button
							onClick={() =>
								updateDirection(index, (item) => ({
									...item,
									frames: [...item.frames, newFrame()],
								}))
							}
							type="button"
						>
							Kare ekle
						</Button>
					</fieldset>
				))}
			</div>
			<label className="block space-y-1 text-sm">
				İnceleme sonucu
				<select
					aria-label="İnceleme sonucu"
					className="block min-h-11 max-w-full rounded-md border bg-background px-3 py-2"
					disabled={disabled}
					onChange={(event) =>
						setOutcome(
							event.target.value === "consistent" ||
								event.target.value === "needs_follow_up"
								? event.target.value
								: ""
						)
					}
					required
					value={outcome}
				>
					<option value="">Sonuç seçin</option>
					<option value="consistent">Tutarlı</option>
					<option value="needs_follow_up">Takip gerekli</option>
				</select>
			</label>
			<label className="block space-y-1 text-sm">
				Gerekçe
				<textarea
					aria-label="Gerekçe"
					className="block min-h-24 w-full rounded-md border bg-background px-3 py-2"
					disabled={disabled}
					maxLength={2000}
					onChange={(event) => setRationale(event.target.value)}
					required
					value={rationale}
				/>
			</label>
			<Button
				disabled={disabled || !canSave}
				onClick={() => {
					if (validation.success) {
						void onSave(validation.data);
					}
				}}
				type="button"
			>
				İncelemeyi kaydet
			</Button>
		</div>
	);
}
