import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type DirectionalReviewInput,
	directionalReviewCriteria,
	directionalReviewInputSchema,
} from "@sprite-anvil/api/directional-reviews";
import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
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
import { DirectionalClipPreview } from "./directional-clip-preview";

const ruleClassLabels = {
	integrity_gate: "Bütünlük Denetimi",
	waivable_requirement: "İstisna Verilebilir Gereksinim",
	quality_advisory: "Kalite Uyarısı",
} as const;

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
type EditorDirection = Omit<
	DirectionalReviewInput["directions"][number],
	"frames"
> & {
	clientId: string;
	frames: (DirectionalReviewInput["directions"][number]["frames"][number] & {
		clientId: string;
	})[];
};
const newFrame = () => ({
	clientId: crypto.randomUUID(),
	assetVersionId: "",
	durationMs: 100,
	region: null,
});
const emptyObservations = {
	silhouette: "",
	proportions: "",
	equipmentSide: "",
	palette: "",
	perspective: "",
	scale: "",
	groundContact: "",
};
interface EditorValues {
	directions: EditorDirection[];
	observations: typeof emptyObservations;
	outcome: DirectionalReviewInput["outcome"];
	rationale: string;
}

export function DirectionalReviewEditor({
	projectId,
	assetFamilyId,
	canonicalDesignId,
	canonicalVersionId,
	contractRevisionId,
	contract,
	versions,
	onSave,
	disabled,
	initial,
	recordNames = {},
}: {
	projectId: string;
	assetFamilyId: string;
	canonicalDesignId: string;
	canonicalVersionId: string;
	contractRevisionId: string;
	contract: SpecializedProfileContract;
	versions: AssetVersion[];
	onSave: (input: DirectionalReviewInput) => Promise<void>;
	disabled: boolean;
	initial?: DirectionalReviewInput;
	recordNames?: Record<string, string>;
}) {
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
			})) ??
			fourDirections.map((direction) => ({
				direction,
				clientId: crypto.randomUUID(),
				frames: [newFrame()],
			}))
	);
	const [operationId] = useState(() => crypto.randomUUID());
	const toCandidate = (value: EditorValues) => ({
		id: initial?.id ?? operationId,
		projectId,
		assetFamilyId,
		canonicalDesignId,
		contractRevisionId,
		directions: value.directions.map(({ direction, frames }) => ({
			direction,
			frames: frames.map(({ clientId: _clientId, ...frame }) => frame),
		})),
		observations: value.observations,
		outcome: value.outcome,
		rationale: value.rationale,
	});
	const form = useForm({
		defaultValues: {
			directions: initialDirections,
			observations: initial?.observations ?? emptyObservations,
			outcome: initial?.outcome ?? "needs_follow_up",
			rationale: initial?.rationale ?? "",
		} satisfies EditorValues,
		onSubmit: async ({ value }) => {
			const parsed = directionalReviewInputSchema.safeParse(toCandidate(value));
			if (parsed.success) {
				setPlaying(false);
				await onSave(toCandidate(value));
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const { directions } = values;
	const setDirections = (
		change:
			| EditorDirection[]
			| ((previous: EditorDirection[]) => EditorDirection[])
	) => form.setFieldValue("directions", change);
	const [zoom, setZoom] = useState(1);
	const [playing, setPlaying] = useState(false);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [rotation, setRotation] = useState(0);
	const [ready, setReady] = useState<Record<string, boolean>>({});
	const onStatus = useCallback(
		(key: string, value: boolean) =>
			setReady((previous) =>
				previous[key] === value ? previous : { ...previous, [key]: value }
			),
		[]
	);
	const canonicalFrames = useMemo(
		() => [
			{ assetVersionId: canonicalVersionId, durationMs: 100, region: null },
		],
		[canonicalVersionId]
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
				setElapsedMs((value) => value + deltaMs);
			}
			previous = timestamp;
			animation = requestAnimationFrame(tick);
		};
		animation = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animation);
	}, [playing]);
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
	const previewReady =
		ready[canonicalVersionId] &&
		directions.every(
			(direction, index) =>
				ready[`${index}:${JSON.stringify(direction.frames)}`]
		);
	const valid =
		directionalReviewInputSchema.safeParse(toCandidate(values)).success &&
		previewReady;
	const groundRule = contract.rules.find(
		(rule) => rule.id === "character.ground_and_loop_tolerance"
	);
	return (
		<div className="space-y-4">
			<p>
				Otomatik sanatsal hüküm verilmez. Sonuç ve yedi gözlem kullanıcı
				incelemesidir.
			</p>
			{groundRule ? (
				<details>
					<summary>
						Zemin ve döngü profil kuralı · {ruleClassLabels[groundRule.class]}
					</summary>
					<p>{groundRule.input}</p>
					<p>{groundRule.successResult}</p>
					<p>{groundRule.failureResult}</p>
				</details>
			) : null}
			<div className="flex flex-wrap gap-4">
				<Label className="block space-y-1 text-sm">
					Yakınlaştırma
					<NativeSelect
						aria-label="Yakınlaştırma"
						className="min-h-11 max-w-full"
						onChange={(event) => setZoom(Number(event.target.value))}
						value={zoom}
					>
						<NativeSelectOption value={1}>1× (doğal)</NativeSelectOption>
						<NativeSelectOption value={2}>2×</NativeSelectOption>
						<NativeSelectOption value={4}>4×</NativeSelectOption>
					</NativeSelect>
				</Label>
				<Button
					disabled={!previewReady}
					onClick={() => setPlaying((value) => !value)}
					type="button"
				>
					{playing ? "Duraklat" : "Birlikte oynat"}
				</Button>
				<Button
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
			<DirectionalClipPreview
				elapsedMs={0}
				frames={canonicalFrames}
				label="Ana Tasarım"
				onStatus={onStatus}
				statusKey={canonicalVersionId}
				versions={versions}
				zoom={zoom}
			/>
			<p>
				Dönüşü incelemek için komşu yön çiftini seçin. Tüm yönler aynı
				milisaniye konumunda oynar; kare süreleri bağımsızdır.
			</p>
			<Label className="block space-y-1 text-sm">
				Dönüş karşılaştırması
				<NativeSelect
					aria-label="Dönüş karşılaştırması"
					className="min-h-11 max-w-full"
					onChange={(event) => setRotation(Number(event.target.value))}
					value={rotation}
				>
					{directions.map((direction, index) => (
						<NativeSelectOption key={direction.clientId} value={index}>
							{direction.direction} →{" "}
							{directions[(index + 1) % directions.length].direction}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Label>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div className="flex flex-wrap gap-4">
					<Label className="block space-y-1 text-sm">
						Yön sayısı
						<form.Field name={"directions"}>
							{(field) => (
								<NativeSelect
									aria-label="Yön sayısı"
									className="min-h-11 max-w-full"
									disabled={disabled}
									onBlur={field.handleBlur}
									onChange={(event) => {
										resetPlayback();
										setRotation(0);
										field.handleChange(
											(Number(event.target.value) === 8
												? eightDirections
												: fourDirections
											).map(
												(direction) =>
													field.state.value.find(
														(item) => item.direction === direction
													) ?? {
														direction,
														clientId: crypto.randomUUID(),
														frames: [newFrame()],
													}
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
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{directions.map((direction, index) => (
						<FieldSet
							className={`block min-w-0 space-y-3 rounded border p-3 ${index === rotation || index === (rotation + 1) % directions.length ? "border-primary" : ""}`}
							disabled={disabled}
							key={direction.clientId}
						>
							<FieldLegend>
								Yön {index + 1}
								{index === rotation ||
								index === (rotation + 1) % directions.length
									? " · Dönüş karşılaştırması"
									: ""}
							</FieldLegend>
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
											value={field.state.value}
										/>
									)}
								</form.Field>
							</Label>
							<DirectionalClipPreview
								elapsedMs={elapsedMs}
								frames={direction.frames}
								label={direction.direction || `Yön ${index + 1}`}
								onStatus={onStatus}
								statusKey={`${index}:${JSON.stringify(direction.frames)}`}
								versions={versions}
								zoom={zoom}
							/>
							{direction.frames.map((frame, frameIndex) => (
								<div className="space-y-3 border-t pt-3" key={frame.clientId}>
									<Label className="block space-y-1 text-sm">
										Kare {frameIndex + 1} sürümü
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
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].region`}
										>
											{(field) => (
												<Checkbox
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
									<Button
										disabled={direction.frames.length === 1}
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
							))}
							<Button
								disabled={direction.frames.length >= 64}
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
				<FieldSet className="grid gap-3 sm:grid-cols-2" disabled={disabled}>
					<FieldLegend>İnceleme gözlemleri</FieldLegend>
					{Object.entries(directionalReviewCriteria).map(
						([criterion, label]) => (
							<Label className="block space-y-1 text-sm" key={criterion}>
								{label}
								<form.Field name="observations">
									{(field) => (
										<Textarea
											aria-label={label}
											maxLength={1000}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange({
													...field.state.value,
													[criterion]: event.target.value,
												})
											}
											value={
												field.state.value[
													criterion as keyof typeof emptyObservations
												]
											}
										/>
									)}
								</form.Field>
							</Label>
						)
					)}
					<Label className="block space-y-1 text-sm">
						Kullanıcı sonucu
						<form.Field name="outcome">
							{(field) => (
								<NativeSelect
									aria-label="Kullanıcı sonucu"
									className="min-h-11 max-w-full"
									onBlur={field.handleBlur}
									onChange={(event) =>
										field.handleChange(
											event.target.value as DirectionalReviewInput["outcome"]
										)
									}
									value={field.state.value}
								>
									<NativeSelectOption value="needs_follow_up">
										Takip gerekli
									</NativeSelectOption>
									<NativeSelectOption value="consistent">
										Tutarlı
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
									className="min-h-20"
									maxLength={2000}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							)}
						</form.Field>
					</Label>
				</FieldSet>
				<Button disabled={disabled || !valid} type="submit">
					İncelemeyi kaydet
				</Button>
			</form>
		</div>
	);
}
