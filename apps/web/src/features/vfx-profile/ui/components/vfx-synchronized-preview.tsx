import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	type VfxSynchronizationInput,
	vfxBackgrounds,
} from "@sprite-anvil/api/vfx-synchronization";
import { Button } from "@sprite-anvil/ui/components/button";
import type { Application as PixiApplication } from "pixi.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { ENV } from "@/env";

import { getVfxPreviewLayout } from "../../lib/vfx-preview-layout";

const trailingSlash = /\/$/;
const backgroundColors = {
	light: "#f8fafc",
	dark: "#0f172a",
	transparent: "transparent",
	scene: "transparent",
};
type Background = (typeof vfxBackgrounds)[number];

async function loadPreviewImages(
	config: Pick<
		VfxSynchronizationInput,
		"effect" | "owner" | "sceneAssetVersionId"
	>,
	versionUrls: string,
	pendingImages: HTMLImageElement[]
) {
	const ids = [
		...new Set(
			[...config.effect.frames, ...config.owner.frames]
				.map((f) => f.assetVersionId)
				.concat(config.sceneAssetVersionId)
		),
	];
	const urls: [string, string][] = JSON.parse(versionUrls);
	const images = new Map(
		await Promise.all(
			ids.map(async (id) => {
				const url = urls.find((pair) => pair[0] === id)?.[1];
				if (!url) {
					throw new Error(
						"Choose exact effect, owner and scene versions first."
					);
				}
				const image = new Image();
				pendingImages.push(image);
				image.crossOrigin = "use-credentials";
				image.src = `${ENV.VITE_SERVER_URL?.replace(trailingSlash, "") ?? ""}${url}`;
				await image.decode();
				return [id, image] as const;
			})
		)
	);
	return images;
}

function previewErrorMessage(failure: unknown) {
	return String(failure instanceof Error ? failure.message : failure);
}

export function VfxSynchronizedPreview({
	input,
	versions,
	onReady,
}: {
	input: VfxSynchronizationInput;
	versions: AssetVersion[];
	onReady: (ready: boolean) => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const [error, setError] = useState("");
	const [ready, setReady] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [elapsedMs, setElapsedMs] = useState(0);
	const [background, setBackground] = useState<Background>("transparent");
	const [alone, setAlone] = useState(false);
	const [zoom, setZoom] = useState(2);
	const controls = useRef({ elapsedMs, background, alone });
	controls.current = { elapsedMs, background, alone };
	const renderer = useRef<(() => void) | null>(null);
	const layout = useMemo(
		() => getVfxPreviewLayout({ effect: input.effect, owner: input.owner }),
		[input.effect, input.owner]
	);
	const configuration = JSON.stringify({
		effect: input.effect,
		owner: input.owner,
		sceneAssetVersionId: input.sceneAssetVersionId,
		event: input.event,
		layer: input.layer,
	});
	const versionUrls = JSON.stringify(versions.map((v) => [v.id, v.previewUrl]));
	useEffect(() => {
		let disposed = false;
		let app: PixiApplication | undefined;
		let initialized = false;
		let destroyScene: (() => void) | undefined;
		const pendingImages: HTMLImageElement[] = [];
		setError("");
		setReady(false);
		setPlaying(false);
		setElapsedMs(0);
		onReady(false);
		const render = async () => {
			try {
				const config: Pick<
					VfxSynchronizationInput,
					"effect" | "owner" | "sceneAssetVersionId" | "event" | "layer"
				> = JSON.parse(configuration);
				const images = await loadPreviewImages(
					config,
					versionUrls,
					pendingImages
				);
				if (disposed) {
					return;
				}
				const [{ Application }, { createVfxPreviewScene }] = await Promise.all([
					import("pixi.js"),
					import("../../lib/vfx-preview-scene"),
				]);
				if (disposed) {
					return;
				}
				const viewport = getVfxPreviewLayout(config);
				app = new Application();
				await app.init({
					width: viewport.width,
					height: viewport.height,
					backgroundAlpha: 0,
					autoStart: false,
				});
				initialized = true;
				if (disposed) {
					app.destroy(true, { children: true });
					return;
				}
				const instance = app;

				const scene = createVfxPreviewScene(instance, images, config);
				destroyScene = scene.destroy;
				renderer.current = () => scene.render(controls.current);

				instance.canvas.setAttribute("role", "img");
				instance.canvas.setAttribute(
					"aria-label",
					"VFX synchronized pixel preview"
				);
				instance.canvas.style.imageRendering = "pixelated";
				instance.canvas.style.width = "100%";
				instance.canvas.style.height = "auto";
				host.current?.appendChild(instance.canvas);
				renderer.current();
				setReady(true);
				onReady(true);
			} catch (failure) {
				if (!disposed) {
					setError(previewErrorMessage(failure));
					onReady(false);
					setReady(false);
				}
			}
		};
		void render();
		return () => {
			disposed = true;
			renderer.current = null;
			for (const image of pendingImages) {
				image.onload = null;
				image.onerror = null;
			}
			if (initialized) {
				app?.destroy(true, { children: true });
			}
			destroyScene?.();
		};
	}, [configuration, versionUrls, onReady]);
	useEffect(() => {
		controls.current = { elapsedMs, background, alone };
		renderer.current?.();
	}, [elapsedMs, background, alone]);
	const effectDuration = input.effect.frames.reduce(
		(s, f) => s + f.durationMs,
		0
	);
	const looping = alone
		? input.effect.looping
		: input.owner.looping || input.effect.looping;
	const duration = alone
		? effectDuration
		: Math.max(
				input.owner.frames.reduce((s, f) => s + f.durationMs, 0),
				input.event.timeMs + effectDuration
			);
	useEffect(() => {
		if (!(playing && ready)) {
			return;
		}
		let handle = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			const delta = now - previous;
			previous = now;
			setElapsedMs((time) =>
				looping ? time + delta : Math.min(time + delta, duration)
			);
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	}, [playing, ready, duration, looping]);
	useEffect(() => {
		if (!looping && elapsedMs >= duration) {
			setPlaying(false);
		}
	}, [elapsedMs, duration, looping]);
	return (
		<section aria-label="VFX playback" className="space-y-3">
			<div className="flex flex-wrap gap-3">
				<Button
					disabled={!ready}
					onClick={() => {
						if (!looping && elapsedMs >= duration) {
							setElapsedMs(0);
						}
						setPlaying(!playing);
					}}
					type="button"
				>
					{playing ? "Pause" : "Play"}
				</Button>
				<Button
					disabled={!ready}
					onClick={() => {
						setPlaying(false);
						setElapsedMs(0);
					}}
					type="button"
				>
					Restart
				</Button>
				<label>
					Playback mode
					<select
						aria-label="Playback mode"
						className="block rounded border bg-background p-2"
						onChange={(e) => {
							setPlaying(false);
							setElapsedMs(0);
							setAlone(e.target.value === "alone");
						}}
						value={alone ? "alone" : "synchronized"}
					>
						<option value="synchronized">With owner</option>
						<option value="alone">Effect alone</option>
					</select>
				</label>
				<label>
					Background
					<select
						aria-label="Background"
						className="block rounded border bg-background p-2"
						onChange={(e) => setBackground(e.target.value as Background)}
						value={background}
					>
						{vfxBackgrounds.map((value) => (
							<option key={value} value={value}>
								{value}
							</option>
						))}
					</select>
				</label>
				<label>
					Zoom
					<select
						aria-label="Zoom"
						className="block rounded border bg-background p-2"
						onChange={(e) => setZoom(Number(e.target.value))}
						value={zoom}
					>
						<option value={1}>1×</option>
						<option value={2}>2×</option>
						<option value={4}>4×</option>
					</select>
				</label>
			</div>
			<label className="block">
				Timeline (ms)
				<input
					className="block w-full"
					max={Math.max(duration, Math.ceil(elapsedMs))}
					min={0}
					onChange={(e) => {
						setPlaying(false);
						setElapsedMs(Number(e.target.value));
					}}
					step={1}
					type="range"
					value={Math.round(elapsedMs)}
				/>
			</label>
			<p>
				{Math.round(elapsedMs)} ms · {input.event.id || "No event selected"} at{" "}
				{input.event.timeMs} ms · layer {input.layer}
			</p>
			<div className="max-w-full overflow-auto">
				<div
					ref={host}
					style={{
						width: layout.width * zoom,
						aspectRatio: `${layout.width}/${layout.height}`,
						backgroundColor: backgroundColors[background],
						backgroundImage:
							background === "transparent"
								? "repeating-conic-gradient(#cbd5e1 0% 25%, #f1f5f9 0% 50%)"
								: undefined,
						backgroundSize: "16px 16px",
					}}
				/>
			</div>
			{error ? (
				<p role="alert">{error}</p>
			) : (
				<p className="text-muted-foreground text-sm">
					Playback uses one timeline. Event time is measured from the owner clip
					start.
				</p>
			)}
		</section>
	);
}
