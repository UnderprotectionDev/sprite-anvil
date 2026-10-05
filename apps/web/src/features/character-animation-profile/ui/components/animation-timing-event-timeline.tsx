import type { AnimationTimingReviewInput } from "@sprite-anvil/api/animation-timing-reviews";
import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import { Button } from "@sprite-anvil/ui/components/button";
import type { ReactNode } from "react";

export type AnimationTimingMetadataStatus = "loading" | "ready" | "error";

type TimingDirection = AnimationTimingReviewInput["directions"][number];

interface EventLink {
	id: string;
	timeMs: number;
}

interface DirectionTrack {
	direction: string;
	durationMs: number;
	events: EventLink[];
}

const characterAnimationProfileId = "character_creature_animation";

function frameIdentity(assetVersionId: string, frameKey: string) {
	return JSON.stringify([assetVersionId, frameKey]);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMilliseconds(value: number) {
	return Number.isInteger(value)
		? String(value)
		: String(Number(value.toFixed(2)));
}

function readEventId(value: unknown) {
	if (typeof value === "string") {
		return value.trim();
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return "";
}

function readEventLinks(value: unknown, frameKey: string) {
	if (value === null) {
		return {
			events: [],
			invalidCount: 0,
			unspecified: true,
			explicitlyEmpty: false,
		};
	}
	const entries = Array.isArray(value) ? value : [value];
	const events: EventLink[] = [];
	let invalidCount = 0;
	for (const entry of entries) {
		if (!isObject(entry)) {
			invalidCount += 1;
			continue;
		}
		const id = readEventId(entry.id);
		if (
			!id ||
			typeof entry.time !== "number" ||
			!Number.isFinite(entry.time) ||
			entry.time < 0 ||
			(entry.frameKey !== undefined && entry.frameKey !== frameKey)
		) {
			invalidCount += 1;
			continue;
		}
		events.push({ id, timeMs: entry.time });
	}
	return {
		events,
		invalidCount,
		unspecified: false,
		explicitlyEmpty: Array.isArray(value) && value.length === 0,
	};
}

function getDirectionEvents(
	direction: TimingDirection,
	eventsByFrame: Map<string, EventLink[]>
) {
	const events = direction.frames.flatMap((frame) =>
		frame.assetVersionId && frame.frameKey
			? (eventsByFrame.get(
					frameIdentity(frame.assetVersionId, frame.frameKey)
				) ?? [])
			: []
	);
	const uniqueEvents = new Map(
		events.map((event) => [`${event.id}:${event.timeMs}`, event])
	);
	return [...uniqueEvents.values()].sort(
		(left, right) => left.timeMs - right.timeMs
	);
}

function getDirectionTracks(
	directions: TimingDirection[],
	gameplayMetadataRecords: GameplayMetadataRecord[],
	projectId: string,
	contractRevisionId: string
) {
	const selectedFrameIdentities = new Set(
		directions.flatMap((direction) =>
			direction.frames
				.filter((frame) => frame.assetVersionId && frame.frameKey)
				.map((frame) => frameIdentity(frame.assetVersionId, frame.frameKey))
		)
	);
	const matchingRecords = gameplayMetadataRecords.filter(
		(record) =>
			record.projectId === projectId &&
			record.profileId === characterAnimationProfileId &&
			record.contractRevisionId === contractRevisionId &&
			selectedFrameIdentities.has(
				frameIdentity(record.assetVersionId, record.frameKey)
			)
	);
	const latestRecordByFrame = new Map<string, GameplayMetadataRecord>();
	for (const record of matchingRecords) {
		const key = frameIdentity(record.assetVersionId, record.frameKey);
		const previous = latestRecordByFrame.get(key);
		if (
			!previous ||
			record.createdAt > previous.createdAt ||
			(record.createdAt === previous.createdAt && record.id > previous.id)
		) {
			latestRecordByFrame.set(key, record);
		}
	}
	const eventFields = [...latestRecordByFrame.values()].flatMap((record) => {
		const eventField = record.fields.find(
			(field) => field.fieldId === "event_links"
		);
		return eventField
			? [
					{
						assetVersionId: record.assetVersionId,
						frameKey: record.frameKey,
						value: eventField.value,
					},
				]
			: [];
	});
	const parsedFields = eventFields.map(({ frameKey, value }) =>
		readEventLinks(value, frameKey)
	);
	const eventsByFrame = new Map<string, EventLink[]>();
	for (const [index, field] of eventFields.entries()) {
		const parsed = parsedFields[index];
		if (!parsed) {
			continue;
		}
		const key = frameIdentity(field.assetVersionId, field.frameKey);
		const events = eventsByFrame.get(key) ?? [];
		events.push(...parsed.events);
		eventsByFrame.set(key, events);
	}
	const tracks = directions.map(
		(direction) =>
			({
				direction: direction.direction,
				durationMs: direction.frames.reduce(
					(total, frame) => total + frame.durationMs,
					0
				),
				events: getDirectionEvents(direction, eventsByFrame),
			}) satisfies DirectionTrack
	);
	return {
		hasSelectedFrames: selectedFrameIdentities.size > 0,
		eventFields,
		parsedFields,
		tracks,
	};
}

function getMetadataMessage({
	status,
	hasSelectedFrames,
	eventFields,
	parsedFields,
	tracks,
}: ReturnType<typeof getDirectionTracks> & {
	status: AnimationTimingMetadataStatus;
}) {
	if (status === "loading") {
		return "Olay bağlantıları yükleniyor…";
	}
	if (status === "error") {
		return "Olay bilgileri okunamadı; zaman çizgisinde görünen olaylar eksik olabilir.";
	}
	if (!hasSelectedFrames) {
		return "Olay bağlantılarını görmek için kare kimliği ve Varlık Sürümü seçin.";
	}
	if (eventFields.length === 0) {
		return "Seçili kareler ve sözleşme revizyonu için olay bağlantısı kaydı bulunamadı.";
	}
	if (parsedFields.some((field) => field.invalidCount > 0)) {
		return "Olay bağlantısı verilerinin biçimi veya zaman bilgisi geçersiz; bu kayıtlar çizilmedi.";
	}
	if (tracks.some((track) => track.events.length > 0)) {
		return null;
	}
	if (parsedFields.every((field) => field.unspecified)) {
		return "Seçili karelerde olay bağlantısı belirtilmemiş.";
	}
	if (parsedFields.every((field) => field.explicitlyEmpty)) {
		return "Seçili karelerde olay bağlantısı yok.";
	}
	return "Seçili kareler için zaman bilgisi olan olay bağlantısı bulunamadı.";
}

export function AnimationTimingEventTimeline({
	contractRevisionId,
	directions,
	gameplayMetadataRecords,
	gameplayMetadataStatus,
	onRetryGameplayMetadata,
	projectId,
}: {
	contractRevisionId: string;
	directions: TimingDirection[];
	gameplayMetadataRecords: GameplayMetadataRecord[];
	gameplayMetadataStatus: AnimationTimingMetadataStatus;
	onRetryGameplayMetadata: () => void;
	projectId: string;
}) {
	const timeline = getDirectionTracks(
		directions,
		gameplayMetadataRecords,
		projectId,
		contractRevisionId
	);
	const maxDurationMs = Math.max(
		1,
		...timeline.tracks.map((track) => track.durationMs),
		...timeline.tracks.flatMap((track) =>
			track.events.map((event) => event.timeMs)
		)
	);
	const message = getMetadataMessage({
		...timeline,
		status: gameplayMetadataStatus,
	});
	const midpointMs = maxDurationMs / 2;
	let metadataNotice: ReactNode = null;
	if (gameplayMetadataStatus === "error") {
		metadataNotice = (
			<p className="flex flex-wrap items-center gap-2 text-sm" role="alert">
				{message} Olay olmadığı varsayılmadı.
				<Button onClick={onRetryGameplayMetadata} type="button">
					Olay bilgilerini yeniden yükle
				</Button>
			</p>
		);
	} else if (message) {
		metadataNotice = (
			<p
				className="text-muted-foreground text-sm"
				role={gameplayMetadataStatus === "loading" ? "status" : undefined}
			>
				{message}
			</p>
		);
	}

	return (
		<section
			aria-label="Olay zaman çizgisi"
			className="space-y-3 rounded border p-3"
		>
			<div>
				<h4 className="font-medium">Olay zaman çizgisi</h4>
				<p className="text-muted-foreground text-sm">
					Klip başlangıcından geçen süre (ms). Her olay, bağlı olduğu karenin
					önceki süreleri eklenmeden kendi zamanında yer alır.
				</p>
			</div>
			{metadataNotice}
			<div className="space-y-2">
				<div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-2 text-xs">
					<span aria-hidden="true" />
					<div className="flex justify-between">
						<span>0 ms</span>
						<span>{formatMilliseconds(midpointMs)} ms</span>
						<span>{formatMilliseconds(maxDurationMs)} ms</span>
					</div>
				</div>
				{timeline.tracks.map((track) => (
					<div
						className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-2"
						key={track.direction}
					>
						<span className="truncate pt-1 text-sm" title={track.direction}>
							{track.direction}
						</span>
						<div
							aria-label={`${track.direction} olay izi`}
							className="relative min-h-10 border-y bg-muted/20"
							role="group"
						>
							<span
								aria-hidden="true"
								className="absolute top-1 bottom-1 left-0 bg-muted"
								style={{
									width: `${(track.durationMs / maxDurationMs) * 100}%`,
								}}
							/>
							{track.events.map((event) => (
								<span
									aria-label={`${track.direction} · ${event.id} · ${formatMilliseconds(event.timeMs)} ms`}
									className="absolute top-0 z-10 -translate-x-1/2 text-center text-xs"
									data-time-ms={event.timeMs}
									key={`${event.id}:${event.timeMs}`}
									role="img"
									style={{ left: `${(event.timeMs / maxDurationMs) * 100}%` }}
								>
									<span
										aria-hidden="true"
										className="mx-auto block h-4 w-0.5 bg-primary"
									/>
									<span aria-hidden="true" className="whitespace-nowrap">
										{event.id} · {formatMilliseconds(event.timeMs)} ms
									</span>
								</span>
							))}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
