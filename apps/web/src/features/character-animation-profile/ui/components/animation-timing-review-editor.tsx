import {
	type AnimationTimingReviewInput,
	animationTimingReviewInputSchema,
} from "@sprite-anvil/api/animation-timing-reviews";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
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

type EditorOutcome = AnimationTimingReviewInput["outcome"] | "";
interface EditorValues {
	animationName: string;
	directions: EditorDirection[];
	looping: boolean;
	outcome: EditorOutcome;
	playbackSpeed: number;
	rationale: string;
}

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
	const [operationId] = useState(() => crypto.randomUUID());
	const toCandidate = (value: EditorValues) => ({
		id: initial?.id ?? operationId,
		projectId,
		assetFamilyId,
		contractRevisionId,
		animationName: value.animationName,
		playbackSpeed: value.playbackSpeed,
		looping: value.looping,
		directions: value.directions.map(({ direction, frames }) => ({
			direction,
			frames: frames.map(({ clientId: _clientId, ...frame }) => frame),
		})),
		outcome: value.outcome,
		rationale: value.rationale,
	});
	// Client ids are generated once so defaultValues stays stable across renders.
	const [initialDirections] = useState<EditorDirection[]>(
		() =>
			initial?.directions.map((direction) => ({
				...direction,
				clientId: crypto.randomUUID(),
				frames: direction.frames.map((frame) => ({
					...frame,
					clientId: crypto.randomUUID(),
				})),
			})) ?? fourDirections.map(newDirection)
	);
	const form = useForm({
		defaultValues: {
			animationName: initial?.animationName ?? "",
			playbackSpeed: initial?.playbackSpeed ?? 1,
			looping: initial?.looping ?? true,
			outcome: (initial?.outcome ?? "") as EditorOutcome,
			rationale: initial?.rationale ?? "",
			directions: initialDirections,
		} satisfies EditorValues,
		onSubmit: async ({ value }) => {
			const parsed = animationTimingReviewInputSchema.safeParse(
				toCandidate(value)
			);
			if (parsed.success) {
				await onSave(parsed.data);
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const { directions, playbackSpeed, looping } = values;
	const setDirections = (
		change: (previous: EditorDirection[]) => EditorDirection[]
	) => form.setFieldValue("directions", change);
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

	const resetPlayback = () => {
		setPlaying(false);
		setElapsedMs(0);
	};
	const updateDirection = (
		index: number,
		change: (direction: EditorDirection) => EditorDirection
	) => {
		resetPlayback();
		setDirections((previous) =>
			previous.map((direction, current) =>
				current === index ? change(direction) : direction
			)
		);
	};
	const validation = animationTimingReviewInputSchema.safeParse(
		toCandidate(values)
	);
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
				<Label className="block space-y-1 text-sm">
					Yakınlaştırma
					<NativeSelect
						aria-label="Yakınlaştırma"
						className="min-h-11"
						onChange={(event) => setZoom(Number(event.target.value))}
						value={zoom}
					>
						<NativeSelectOption value={1}>1× (doğal)</NativeSelectOption>
						<NativeSelectOption value={2}>2×</NativeSelectOption>
						<NativeSelectOption value={4}>4×</NativeSelectOption>
					</NativeSelect>
				</Label>
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
				<Label className="block space-y-1 text-sm">
					Oynatma konumu (ms)
					<Input
						aria-label="Oynatma konumu (ms)"
						className="min-h-11 w-40"
						min={0}
						onChange={(event) => {
							setPlaying(false);
							setElapsedMs(Math.max(0, Number(event.target.value)));
						}}
						type="number"
						value={Math.floor(elapsedMs)}
					/>
				</Label>
			</div>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="flex flex-wrap items-end gap-4">
					<Label className="block space-y-1 text-sm">
						Animasyon adı
						<form.Field name="animationName">
							{(field) => (
								<Input
									aria-label="Animasyon adı"
									className="min-h-11 w-64"
									disabled={disabled}
									maxLength={120}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								/>
							)}
						</form.Field>
					</Label>
					<Label className="block space-y-1 text-sm">
						Yön sayısı
						<form.Field name={"directions"}>
							{(field) => (
								<NativeSelect
									aria-label="Yön sayısı"
									className="min-h-11"
									disabled={disabled}
									onBlur={field.handleBlur}
									onChange={(event) => {
										resetPlayback();
										const choices =
											Number(event.target.value) === 8
												? eightDirections
												: fourDirections;
										field.handleChange(
											choices.map(
												(direction) =>
													field.state.value.find(
														(item) => item.direction === direction
													) ?? newDirection(direction)
											)
										);
									}}
									value={field.state.value.length}
								>
									<NativeSelectOption value={4}>4</NativeSelectOption>
									<NativeSelectOption value={8}>8</NativeSelectOption>
								</NativeSelect>
							)}
						</form.Field>
					</Label>
					<Label className="block space-y-1 text-sm">
						Oynatma hızı
						<form.Field name="playbackSpeed">
							{(field) => (
								<Input
									aria-label="Oynatma hızı"
									className="min-h-11 w-32"
									disabled={disabled}
									max={4}
									min={0.1}
									onBlur={field.handleBlur}
									onChange={(event) =>
										field.handleChange(Number(event.target.value))
									}
									step={0.1}
									type="number"
									value={field.state.value}
								/>
							)}
						</form.Field>
					</Label>
					<Label className="flex min-h-11 items-center gap-2 text-sm">
						<form.Field name="looping">
							{(field) => (
								<Checkbox
									checked={field.state.value}
									disabled={disabled}
									onCheckedChange={(checked) => field.handleChange(checked)}
								/>
							)}
						</form.Field>
						Döngüde oynat
					</Label>
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
						<FieldSet
							className="block min-w-0 space-y-3 rounded border p-3"
							disabled={disabled}
							key={direction.clientId}
						>
							<FieldLegend>Yön {index + 1}</FieldLegend>
							<Label className="block space-y-1 text-sm">
								Yön adı
								<form.Field name={`directions[${index}].direction`}>
									{(field) => (
										<Input
											aria-label={`Yön adı ${index + 1}`}
											className="min-h-11 w-full"
											maxLength={80}
											onBlur={field.handleBlur}
											onChange={(event) => {
												resetPlayback();
												field.handleChange(event.target.value);
											}}
											required
											value={field.state.value}
										/>
									)}
								</form.Field>
							</Label>
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
									<Label className="block space-y-1 text-sm">
										Kare kimliği
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].frameKey`}
										>
											{(field) => (
												<Input
													aria-label={`Yön ${index + 1} kare ${frameIndex + 1} kimliği`}
													className="min-h-11 w-full"
													maxLength={512}
													onBlur={field.handleBlur}
													onChange={(event) => {
														resetPlayback();
														field.handleChange(event.target.value);
													}}
													required
													value={field.state.value}
												/>
											)}
										</form.Field>
									</Label>
									<Label className="block space-y-1 text-sm">
										Varlık Sürümü
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].assetVersionId`}
										>
											{(field) => (
												<NativeSelect
													aria-label={`Yön ${index + 1} kare ${frameIndex + 1} sürümü`}
													className="min-h-11 max-w-full"
													onBlur={field.handleBlur}
													onChange={(event) => {
														resetPlayback();
														field.handleChange(event.target.value);
													}}
													value={field.state.value}
												>
													<NativeSelectOption value="">
														Sürüm seçin
													</NativeSelectOption>
													{versions.map((version) => (
														<NativeSelectOption
															key={version.id}
															value={version.id}
														>
															{recordNames[version.assetRecordId] ?? "Varlık"} ·
															Sürüm {version.versionNumber}
														</NativeSelectOption>
													))}
												</NativeSelect>
											)}
										</form.Field>
									</Label>
									<Label className="block space-y-1 text-sm">
										Süre (ms)
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].durationMs`}
										>
											{(field) => (
												<Input
													aria-label={`Yön ${index + 1} kare ${frameIndex + 1} süre (ms)`}
													className="min-h-11 w-full"
													max={60_000}
													min={1}
													onBlur={field.handleBlur}
													onChange={(event) => {
														resetPlayback();
														field.handleChange(Number(event.target.value));
													}}
													type="number"
													value={field.state.value}
												/>
											)}
										</form.Field>
									</Label>
									<Label className="block space-y-1 text-sm">
										Hareket evresi (isteğe bağlı)
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].motionPhase`}
										>
											{(field) => (
												<Input
													aria-label={`Yön ${index + 1} kare ${frameIndex + 1} hareket evresi`}
													className="min-h-11 w-full"
													maxLength={120}
													onBlur={field.handleBlur}
													onChange={(event) => {
														resetPlayback();
														field.handleChange(event.target.value || null);
													}}
													value={field.state.value ?? ""}
												/>
											)}
										</form.Field>
									</Label>
									<Label className="flex min-h-11 items-center gap-2 text-sm">
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].region`}
										>
											{(field) => (
												<Checkbox
													aria-labelledby={`region-${frame.clientId}-name`}
													checked={field.state.value !== null}
													onCheckedChange={(checked) => {
														resetPlayback();
														field.handleChange(
															checked
																? { x: 0, y: 0, width: 32, height: 32 }
																: null
														);
													}}
												/>
											)}
										</form.Field>
										Sprite sheet alanı
									</Label>
									<span
										className="sr-only"
										id={`region-${frame.clientId}-name`}
									>
										{`Yön ${index + 1} kare ${frameIndex + 1} sprite sheet alanı`}
									</span>
									{frame.region ? (
										<div className="flex flex-wrap gap-2">
											{(["x", "y", "width", "height"] as const).map((field) => (
												<Label className="block space-y-1 text-sm" key={field}>
													{field}
													<form.Field
														name={`directions[${index}].frames[${frameIndex}].region`}
													>
														{(regionField) => (
															<Input
																aria-label={`Yön ${index + 1} kare ${frameIndex + 1} ${field}`}
																className="min-h-11 w-20"
																min={field === "x" || field === "y" ? 0 : 1}
																onBlur={regionField.handleBlur}
																onChange={(event) => {
																	resetPlayback();
																	if (regionField.state.value) {
																		regionField.handleChange({
																			...regionField.state.value,
																			[field]: Number(event.target.value),
																		});
																	}
																}}
																type="number"
																value={regionField.state.value?.[field] ?? 0}
															/>
														)}
													</form.Field>
												</Label>
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
						</FieldSet>
					))}
				</div>
				<Label className="block space-y-1 text-sm">
					İnceleme sonucu
					<form.Field name="outcome">
						{(field) => (
							<NativeSelect
								aria-label="İnceleme sonucu"
								className="min-h-11 max-w-full"
								disabled={disabled}
								onBlur={field.handleBlur}
								onChange={(event) =>
									field.handleChange(
										event.target.value === "consistent" ||
											event.target.value === "needs_follow_up"
											? event.target.value
											: ""
									)
								}
								required
								value={field.state.value}
							>
								<NativeSelectOption value="">Sonuç seçin</NativeSelectOption>
								<NativeSelectOption value="consistent">
									Tutarlı
								</NativeSelectOption>
								<NativeSelectOption value="needs_follow_up">
									Takip gerekli
								</NativeSelectOption>
							</NativeSelect>
						)}
					</form.Field>
				</Label>
				<Label className="block space-y-1 text-sm">
					Gerekçe
					<form.Field name="rationale">
						{(field) => (
							<Textarea
								aria-label="Gerekçe"
								className="min-h-24"
								disabled={disabled}
								maxLength={2000}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={field.state.value}
							/>
						)}
					</form.Field>
				</Label>
				<Button disabled={disabled || !canSave} type="submit">
					İncelemeyi kaydet
				</Button>
			</form>
		</div>
	);
}
