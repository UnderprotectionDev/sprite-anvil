import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type DirectionalReviewInput,
	directionalReviewCriteria,
	directionalReviewInputSchema,
} from "@sprite-anvil/api/directional-reviews";
import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
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
	const [directions, setDirections] = useState<EditorDirection[]>(
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
	const [observations, setObservations] = useState(
		initial?.observations ?? emptyObservations
	);
	const [outcome, setOutcome] = useState<DirectionalReviewInput["outcome"]>(
		initial?.outcome ?? "needs_follow_up"
	);
	const [rationale, setRationale] = useState(initial?.rationale ?? "");
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
		canonicalDesignId,
		contractRevisionId,
		directions: directions.map(({ direction, frames }) => ({
			direction,
			frames: frames.map(({ clientId: _clientId, ...frame }) => frame),
		})),
		observations,
		outcome,
		rationale,
	};
	const previewReady =
		ready[canonicalVersionId] &&
		directions.every(
			(direction, index) =>
				ready[`${index}:${JSON.stringify(direction.frames)}`]
		);
	const valid =
		directionalReviewInputSchema.safeParse(candidate).success && previewReady;
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
				<label className="block space-y-1 text-sm">
					Yön sayısı
					<select
						aria-label="Yön sayısı"
						className="block min-h-11 max-w-full rounded-md border bg-background px-3 py-2"
						disabled={disabled}
						onChange={(event) => {
							setPlaying(false);
							setElapsedMs(0);
							setRotation(0);
							setDirections(
								(Number(event.target.value) === 8
									? eightDirections
									: fourDirections
								).map(
									(direction) =>
										directions.find((item) => item.direction === direction) ?? {
											direction,
											clientId: crypto.randomUUID(),
											frames: [newFrame()],
										}
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
					Yakınlaştırma
					<select
						aria-label="Yakınlaştırma"
						className="block min-h-11 max-w-full rounded-md border bg-background px-3 py-2"
						onChange={(event) => setZoom(Number(event.target.value))}
						value={zoom}
					>
						<option value={1}>1× (doğal)</option>
						<option value={2}>2×</option>
						<option value={4}>4×</option>
					</select>
				</label>
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
			<label className="block space-y-1 text-sm">
				Dönüş karşılaştırması
				<select
					aria-label="Dönüş karşılaştırması"
					className="block min-h-11 max-w-full rounded-md border bg-background px-3 py-2"
					onChange={(event) => setRotation(Number(event.target.value))}
					value={rotation}
				>
					{directions.map((direction, index) => (
						<option key={direction.clientId} value={index}>
							{direction.direction} →{" "}
							{directions[(index + 1) % directions.length].direction}
						</option>
					))}
				</select>
			</label>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{directions.map((direction, index) => (
					<fieldset
						className={`min-w-0 space-y-3 rounded border p-3 ${index === rotation || index === (rotation + 1) % directions.length ? "border-primary" : ""}`}
						disabled={disabled}
						key={direction.clientId}
					>
						<legend>
							Yön {index + 1}
							{index === rotation ||
							index === (rotation + 1) % directions.length
								? " · Dönüş karşılaştırması"
								: ""}
						</legend>
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
								value={direction.direction}
							/>
						</label>
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
								<label className="block space-y-1 text-sm">
									Kare {frameIndex + 1} sürümü
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
									<input
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
													value={frame.region?.[field]}
												/>
											</label>
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
					</fieldset>
				))}
			</div>
			<fieldset className="grid gap-3 sm:grid-cols-2" disabled={disabled}>
				<legend>İnceleme gözlemleri</legend>
				{Object.entries(directionalReviewCriteria).map(([criterion, label]) => (
					<label className="block space-y-1 text-sm" key={criterion}>
						{label}
						<textarea
							aria-label={label}
							className="block w-full rounded border p-2"
							maxLength={1000}
							onChange={(event) =>
								setObservations((previous) => ({
									...previous,
									[criterion]: event.target.value,
								}))
							}
							value={observations[criterion as keyof typeof observations]}
						/>
					</label>
				))}
				<label className="block space-y-1 text-sm">
					Kullanıcı sonucu
					<select
						aria-label="Kullanıcı sonucu"
						className="block min-h-11 max-w-full rounded-md border bg-background px-3 py-2"
						onChange={(event) =>
							setOutcome(event.target.value as typeof outcome)
						}
						value={outcome}
					>
						<option value="needs_follow_up">Takip gerekli</option>
						<option value="consistent">Tutarlı</option>
					</select>
				</label>
				<label className="block space-y-1 text-sm">
					Gerekçe
					<textarea
						aria-label="Gerekçe"
						className="block min-h-20 w-full rounded-md border bg-background px-3 py-2"
						maxLength={2000}
						onChange={(event) => setRationale(event.target.value)}
						value={rationale}
					/>
				</label>
			</fieldset>
			<Button
				disabled={disabled || !valid}
				onClick={() => {
					setPlaying(false);
					onSave(candidate);
				}}
				type="button"
			>
				İncelemeyi kaydet
			</Button>
		</div>
	);
}
