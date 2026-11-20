// biome-ignore-all lint/a11y/noLabelWithoutControl: each Label wraps its Input/Select/Textarea inside a TanStack form.Field render prop, which Biome cannot see through.
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type {
	DirectionalReviewInput,
	directionalReviewCriteria,
} from "@sprite-anvil/api/directional-reviews";
import { directionalReviewInputSchema } from "@sprite-anvil/api/directional-reviews";
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
import { useForm, useSelector } from "@tanstack/react-form";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReducedMotionNotice } from "@/components/reduced-motion-notice";
import { StatusMessage } from "@/components/status-message";
import { usePendingIdempotencyKey } from "@/utils/pending-idempotency-key";
import { DirectionalClipPreview } from "./directional-clip-preview";

const reviewCriteriaLabels: Record<
	keyof typeof directionalReviewCriteria,
	string
> = {
	silhouette: "Silhouette",
	proportions: "Proportions",
	equipmentSide: "Equipment side",
	palette: "Palette",
	perspective: "Perspective",
	scale: "Scale",
	groundContact: "Ground contact",
};

const ruleClassLabels = {
	integrity_gate: "Integrity Gate",
	waivable_requirement: "Waivable Requirement",
	quality_advisory: "Quality Advisory",
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
	const operationKey = usePendingIdempotencyKey();
	const toCandidate = (value: EditorValues) => ({
		// The real identifier is allocated only on the first valid submission.
		id: initial?.id ?? "00000000-0000-0000-0000-000000000000",
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
				await onSave({
					...parsed.data,
					id: initial?.id ?? operationKey.keyFor(JSON.stringify(parsed.data)),
				});
			}
		},
	});
	const values = useSelector(form.store, (state) => state.values);
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
	const validation = directionalReviewInputSchema.safeParse(
		toCandidate(values)
	);
	const valid = validation.success && previewReady;
	const groundRule = contract.rules.find(
		(rule) => rule.id === "character.ground_and_loop_tolerance"
	);
	return (
		<div className="space-y-4">
			<p>
				No automatic artistic judgment is made. The result and seven
				observations are reviewed by the user.
			</p>
			{groundRule ? (
				<details>
					<summary>
						Grounding and loop profile rule ·{" "}
						{ruleClassLabels[groundRule.class]}
					</summary>
					<p>{groundRule.input}</p>
					<p>{groundRule.successResult}</p>
					<p>{groundRule.failureResult}</p>
				</details>
			) : null}
			<div className="flex flex-wrap gap-4">
				<Label className="block space-y-1 text-sm">
					Zoom
					<NativeSelect
						aria-label="Zoom"
						className="min-h-11 max-w-full"
						onChange={(event) => setZoom(Number(event.target.value))}
						value={zoom}
					>
						<NativeSelectOption value={1}>1× (native)</NativeSelectOption>
						<NativeSelectOption value={2}>2×</NativeSelectOption>
						<NativeSelectOption value={4}>4×</NativeSelectOption>
					</NativeSelect>
				</Label>
				<Button
					disabled={!previewReady}
					onClick={() => setPlaying((value) => !value)}
					type="button"
				>
					{playing ? "Pause" : "Play together"}
				</Button>
				<Button
					onClick={() => {
						setPlaying(false);
						setElapsedMs(0);
					}}
					type="button"
				>
					Restart
				</Button>
				<Label className="block space-y-1 text-sm">
					Playback position (ms)
					<Input
						aria-label="Playback position (ms)"
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
			<ReducedMotionNotice onReducedMotion={() => setPlaying(false)} />
			<DirectionalClipPreview
				elapsedMs={0}
				frames={canonicalFrames}
				label="Canonical Design"
				onStatus={onStatus}
				statusKey={canonicalVersionId}
				versions={versions}
				zoom={zoom}
			/>
			<p>
				Select adjacent directions to review the turn. All directions play at
				the same millisecond position; frame durations are independent.
			</p>
			<Label className="block space-y-1 text-sm">
				Turn comparison
				<NativeSelect
					aria-label="Turn comparison"
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
						Direction count
						<form.Field name={"directions"}>
							{(field) => (
								<NativeSelect
									aria-label="Direction count"
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
								Direction {index + 1}
								{index === rotation ||
								index === (rotation + 1) % directions.length
									? " · Turn comparison"
									: ""}
							</FieldLegend>
							<Label className="block space-y-1 text-sm">
								Direction name
								<form.Field name={`directions[${index}].direction`}>
									{(field) => (
										<Input
											aria-label={`Direction name ${index + 1}`}
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
								label={direction.direction || `Direction ${index + 1}`}
								onStatus={onStatus}
								statusKey={`${index}:${JSON.stringify(direction.frames)}`}
								versions={versions}
								zoom={zoom}
							/>
							{direction.frames.map((frame, frameIndex) => (
								<div className="space-y-3 border-t pt-3" key={frame.clientId}>
									<Label className="block space-y-1 text-sm">
										Frame {frameIndex + 1} version
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].assetVersionId`}
										>
											{(field) => (
												<NativeSelect
													aria-label={`Direction ${index + 1} frame ${frameIndex + 1} version`}
													className="min-h-11 max-w-full"
													onBlur={field.handleBlur}
													onChange={(event) => {
														resetPlayback();
														field.handleChange(event.target.value);
													}}
													value={field.state.value}
												>
													<NativeSelectOption value="">
														Select a version
													</NativeSelectOption>
													{versions.map((version) => (
														<NativeSelectOption
															key={version.id}
															value={version.id}
														>
															{recordNames[version.assetRecordId] ?? "Asset"} ·
															Version {version.versionNumber}
														</NativeSelectOption>
													))}
												</NativeSelect>
											)}
										</form.Field>
									</Label>
									<Label className="block space-y-1 text-sm">
										Duration (ms)
										<form.Field
											name={`directions[${index}].frames[${frameIndex}].durationMs`}
										>
											{(field) => (
												<Input
													aria-label={`Direction ${index + 1} frame ${frameIndex + 1} duration (ms)`}
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
										Sprite sheet region
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
																aria-label={`Direction ${index + 1} frame ${frameIndex + 1} ${field}`}
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
										Remove frame
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
								Add frame
							</Button>
						</FieldSet>
					))}
				</div>
				<FieldSet className="grid gap-3 sm:grid-cols-2" disabled={disabled}>
					<FieldLegend>Review observations</FieldLegend>
					{Object.entries(reviewCriteriaLabels).map(([criterion, label]) => (
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
					))}
					<Label className="block space-y-1 text-sm">
						User result
						<form.Field name="outcome">
							{(field) => (
								<NativeSelect
									aria-label="User result"
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
										Needs follow-up
									</NativeSelectOption>
									<NativeSelectOption value="consistent">
										Consistent
									</NativeSelectOption>
								</NativeSelect>
							)}
						</form.Field>
					</Label>
					<Label className="block space-y-1 text-sm">
						Rationale
						<form.Field name="rationale">
							{(field) => (
								<Textarea
									aria-label="Rationale"
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
				{!validation.success && (
					<StatusMessage tone="error">
						{[
							...new Set(validation.error.issues.map((issue) => issue.message)),
						].join(" ")}
					</StatusMessage>
				)}
				<Button disabled={disabled || !valid} type="submit">
					Save review
				</Button>
			</form>
		</div>
	);
}
