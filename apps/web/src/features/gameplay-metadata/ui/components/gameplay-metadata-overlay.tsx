import type { GameplayMetadataRecord } from "@sprite-anvil/api/gameplay-metadata";
import type {
	Application as PixiApplication,
	Graphics as PixiGraphics,
} from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

const pointSchema = z.object({ x: z.number(), y: z.number() });
const areaSchema = pointSchema.extend({
	width: z.number().positive(),
	height: z.number().positive(),
});

function points(value: unknown): z.infer<typeof pointSchema>[] {
	const point = pointSchema.safeParse(value);
	if (point.success) {
		return [point.data];
	}
	if (Array.isArray(value)) {
		return value.flatMap(points);
	}
	return value && typeof value === "object"
		? Object.values(value).flatMap(points)
		: [];
}

function drawLayers(
	layer: PixiGraphics,
	record: GameplayMetadataRecord,
	visibleFields: string[],
	scale: number
) {
	for (const [index, field] of record.fields.entries()) {
		if (
			!visibleFields.includes(field.fieldId) ||
			field.unit !== "px" ||
			field.coordinateSystem !== "source_image_top_left"
		) {
			continue;
		}
		const color = [0xff_dd_00, 0x00_ff_ff, 0xff_66_ff, 0x66_ff_66][index % 4];
		if (field.fieldId === "collision_areas" && Array.isArray(field.value)) {
			for (const raw of field.value) {
				const area = areaSchema.safeParse(raw);
				if (area.success) {
					layer
						.rect(area.data.x, area.data.y, area.data.width, area.data.height)
						.stroke({ color, width: 1 / scale });
				}
			}
		} else {
			for (const point of points(field.value)) {
				layer
					.moveTo(point.x - 3 / scale, point.y)
					.lineTo(point.x + 3 / scale, point.y)
					.moveTo(point.x, point.y - 3 / scale)
					.lineTo(point.x, point.y + 3 / scale)
					.stroke({ color, width: 1 / scale });
			}
		}
	}
}

export function GameplayMetadataOverlay({
	record,
	previewUrl,
	onReady,
}: {
	record: GameplayMetadataRecord;
	previewUrl: string;
	onReady: (ready: boolean) => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [visibleFields, setVisibleFields] = useState(() =>
		record.fields.map((field) => field.fieldId)
	);
	const events = record.fields.find((field) => field.fieldId === "event_links");
	useEffect(() => {
		let disposed = false;
		let application: PixiApplication | undefined;
		let initialized = false;
		const image = new Image();
		onReady(false);
		setError(null);
		const render = async () => {
			try {
				image.crossOrigin = "use-credentials";
				image.src = previewUrl;
				await image.decode();
				if (disposed) {
					return;
				}
				const { Application, Graphics, Sprite, Texture } = await import(
					"pixi.js"
				);
				if (disposed) {
					return;
				}
				const scale = Math.min(
					4,
					640 / image.naturalWidth,
					400 / image.naturalHeight
				);
				application = new Application();
				await application.init({
					width: image.naturalWidth * scale,
					height: image.naturalHeight * scale,
					backgroundColor: 0x20_20_20,
					autoStart: false,
				});
				initialized = true;
				if (disposed) {
					application.destroy(true, {
						children: true,
						texture: true,
						textureSource: true,
					});
					return;
				}
				const texture = Texture.from(image);
				texture.source.scaleMode = "nearest";
				const sprite = new Sprite(texture);
				application.stage.addChild(sprite);
				application.stage.scale.set(scale);
				const layer = new Graphics();
				drawLayers(layer, record, visibleFields, scale);
				application.stage.addChild(layer);
				application.canvas.setAttribute(
					"aria-label",
					`${record.frameKey} — ${record.assetVersionId} oyun içi bilgi katmanları`
				);
				application.canvas.setAttribute("role", "img");
				application.canvas.style.maxWidth = "100%";
				application.canvas.style.height = "auto";
				host.current?.appendChild(application.canvas);
				application.render();
				onReady(true);
			} catch {
				if (!disposed) {
					setError("Kesin sürümün görseli yüklenemedi; inceleme kaydedilemez.");
					onReady(false);
				}
			}
		};
		render();
		return () => {
			disposed = true;
			if (initialized) {
				application?.destroy(true, {
					children: true,
					texture: true,
					textureSource: true,
				});
			}
		};
	}, [record, previewUrl, visibleFields, onReady]);
	return (
		<div className="space-y-2">
			<fieldset className="flex flex-wrap gap-3">
				<legend>Görsel katmanlar</legend>
				{record.fields.map((field) => (
					<label className="flex items-center gap-1" key={field.fieldId}>
						<input
							checked={visibleFields.includes(field.fieldId)}
							onChange={(event) =>
								setVisibleFields(
									event.target.checked
										? [...visibleFields, field.fieldId]
										: visibleFields.filter(
												(fieldId) => fieldId !== field.fieldId
											)
								)
							}
							type="checkbox"
						/>
						{record.contractSnapshot?.metadataFields.find(
							(definition) => definition.id === field.fieldId
						)?.label ?? field.fieldId}
					</label>
				))}
			</fieldset>
			<div className="relative w-fit max-w-full">
				<div ref={host} />
				{events?.value !== null &&
					events &&
					visibleFields.includes("event_links") &&
					!error && (
						<div
							aria-label="Olay bağlantıları görsel katmanı"
							className="absolute inset-x-0 bottom-0 max-h-16 overflow-auto bg-black/80 p-1 text-white text-xs"
							role="note"
						>
							<p>Olay bağlantıları · {record.frameKey}</p>
							<p className="break-all font-mono">
								{JSON.stringify(events.value)}
							</p>
						</div>
					)}
			</div>
			{error ? <p role="alert">{error}</p> : null}
			<p className="text-muted-foreground text-sm">
				Koordinatlar kaynak görselinin sol üst köşesine göre gösterilir.
				Noktalar ve dikdörtgenler kullanıcı verisidir; diğer JSON değerleri
				aşağıda korunur. Görsel alfadan çarpışma veya fizik bilgisi üretilmez.
			</p>
		</div>
	);
}
