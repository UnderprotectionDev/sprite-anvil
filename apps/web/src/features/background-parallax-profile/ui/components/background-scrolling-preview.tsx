import type { BackgroundLayerLayoutInput } from "@sprite-anvil/api/background-layer-layouts";
import type { BackgroundScrollingSetup } from "@sprite-anvil/api/background-scrolling-tests";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import type { Application, Texture } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { ENV } from "@/env";
import type { BackgroundLayerMotion } from "../../lib/background-scrolling-scene";

type Layer = BackgroundLayerLayoutInput["layers"][number];
const trailingSlash = /\/$/;
async function loadBackgroundLayers(setup: {
	layers: Layer[];
	versions: { id: string; previewUrl: string }[];
}) {
	return await Promise.all(
		setup.layers.map(async (layer) => {
			const url = setup.versions.find(
				(version) => version.id === layer.assetVersionId
			)?.previewUrl;
			if (!url) {
				throw new Error("An exact layer version is unavailable.");
			}
			const image = new Image();
			image.crossOrigin = "use-credentials";
			image.src = url.startsWith("/")
				? `${ENV.VITE_SERVER_URL?.replace(trailingSlash, "") ?? ""}${url}`
				: url;
			await image.decode();
			if (
				image.naturalWidth !== layer.naturalSize.width ||
				image.naturalHeight !== layer.naturalSize.height
			) {
				throw new Error(
					"Layer content dimensions differ from the saved layout."
				);
			}
			return { layer, image };
		})
	);
}

async function loadPlayer(
	player: BackgroundScrollingSetup["player"],
	versions: { id: string; previewUrl: string }[]
) {
	const url = versions.find(
		(version) => version.id === player.assetVersionId
	)?.previewUrl;
	if (!url) {
		throw new Error("Exact player version is unavailable.");
	}
	const image = new Image();
	image.crossOrigin = "use-credentials";
	image.src = url.startsWith("/")
		? `${ENV.VITE_SERVER_URL?.replace(trailingSlash, "") ?? ""}${url}`
		: url;
	await image.decode();
	if (
		player.width * image.naturalHeight !==
		player.height * image.naturalWidth
	) {
		throw new Error(
			"Player geometry must preserve its exact source aspect ratio."
		);
	}
	return image;
}
function getViewport(layers: Layer[]) {
	const [first] = layers;
	if (!first) {
		throw new Error("Select a saved layer layout first.");
	}
	const { width, height } = first.crop;
	if (
		layers.some(
			(layer) => layer.crop.width * height !== layer.crop.height * width
		)
	) {
		throw new Error("All scrolling layers must share one target aspect ratio.");
	}
	return { width, height };
}

export function BackgroundScrollingPreview({
	layers,
	motions,
	durationMs,
	versions,
	onPlayback,
	player,
}: {
	layers: Layer[];
	motions: BackgroundLayerMotion[];
	durationMs: number;
	versions: { id: string; previewUrl: string }[];
	onPlayback: (elapsedMs: number) => void;
	player?: BackgroundScrollingSetup["player"];
}) {
	const host = useRef<HTMLDivElement>(null);
	const renderer = useRef<((elapsed: number) => void) | null>(null);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	const [playing, setPlaying] = useState(false);
	const [time, setTime] = useState(0);
	const playedMs = useRef(0);
	const callback = useRef(onPlayback);
	callback.current = onPlayback;
	const config = JSON.stringify({
		layers,
		motions,
		versions,
		player,
		durationMs,
	});
	useEffect(() => {
		let disposed = false;
		let app: Application | undefined;
		let initialized = false;
		const textures: Texture[] = [];
		setReady(false);
		setPlaying(false);
		setTime(0);
		setError("");
		playedMs.current = 0;
		callback.current(0);
		function reportFailure(failure: unknown) {
			if (!disposed) {
				renderer.current = null;
				setError(
					failure instanceof Error
						? failure.message
						: "Could not load the scrolling preview."
				);
				setReady(false);
				setPlaying(false);
				playedMs.current = 0;
				callback.current(0);
			}
		}
		async function initialize() {
			try {
				const setup: {
					layers: Layer[];
					motions: BackgroundLayerMotion[];
					versions: { id: string; previewUrl: string }[];
					player?: BackgroundScrollingSetup["player"];
				} = JSON.parse(config);
				const { width, height } = getViewport(setup.layers);
				const images = await loadBackgroundLayers(setup);
				const playerImage = setup.player
					? await loadPlayer(setup.player, setup.versions)
					: undefined;
				if (disposed) {
					return;
				}
				const [pixi, { createBackgroundScrollingScene }] = await Promise.all([
					import("pixi.js"),
					import("../../lib/background-scrolling-scene"),
				]);
				if (disposed) {
					return;
				}
				app = new pixi.Application();
				await app.init({ width, height, backgroundAlpha: 0, autoStart: false });
				initialized = true;
				if (disposed) {
					app.destroy(true, { children: true });
					return;
				}
				const instance = app;
				renderer.current = createBackgroundScrollingScene(
					instance,
					images,
					setup.motions,
					width,
					textures,
					setup.player && playerImage
						? { setup: setup.player, image: playerImage }
						: undefined
				);
				instance.canvas.setAttribute("role", "img");
				instance.canvas.setAttribute(
					"aria-label",
					"Actual background scrolling preview"
				);
				instance.canvas.style.width = "100%";
				instance.canvas.style.height = "auto";
				instance.canvas.style.imageRendering = "pixelated";
				host.current?.appendChild(instance.canvas);
				renderer.current(0);
				setReady(true);
			} catch (failure) {
				reportFailure(failure);
			}
		}
		void initialize();
		return () => {
			disposed = true;
			renderer.current = null;
			if (initialized) {
				app?.destroy(true, { children: true });
			}
			for (const texture of textures) {
				texture.destroy();
			}
		};
	}, [config]);
	useEffect(() => {
		renderer.current?.(time);
	}, [time]);
	useEffect(() => {
		if (!(playing && ready)) {
			return;
		}
		let handle = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			const delta = Math.min(now - previous, 100);
			previous = now;
			playedMs.current = Math.min(durationMs, playedMs.current + delta);
			callback.current(playedMs.current);
			setTime((current) => Math.min(durationMs, current + delta));
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	}, [playing, ready, durationMs]);
	useEffect(() => {
		if (time >= durationMs) {
			setPlaying(false);
		}
	}, [time, durationMs]);
	const width = layers[0]?.crop.width ?? 1;
	return (
		<section aria-label="Background scrolling playback" className="space-y-3">
			<div className="max-w-full overflow-hidden rounded border" ref={host} />
			<div className="flex flex-wrap gap-3">
				<Button
					disabled={!ready}
					onClick={() => {
						if (time >= durationMs) {
							setTime(0);
							playedMs.current = 0;
							callback.current(0);
						}
						setPlaying(!playing);
					}}
					type="button"
				>
					{playing ? "Pause scrolling" : "Play scrolling"}
				</Button>
				<Button
					disabled={!ready}
					onClick={() => {
						setPlaying(false);
						setTime(0);
						playedMs.current = 0;
						callback.current(0);
					}}
					type="button"
				>
					Restart scrolling
				</Button>
				<Label className="flex flex-col items-start gap-1 leading-normal">
					Timeline (ms)
					<Input
						aria-label="Timeline (ms)"
						className="block w-auto"
						disabled={!ready}
						max={durationMs}
						min={0}
						onChange={(event) => {
							setPlaying(false);
							playedMs.current = 0;
							callback.current(0);
							setTime(
								Math.max(0, Math.min(durationMs, Number(event.target.value)))
							);
						}}
						step={1}
						type="number"
						value={Math.round(time)}
					/>
				</Label>
			</div>
			{motions.map((motion) => {
				const raw = motion.startOffset + (motion.speed * time) / 1000;
				const offset = motion.loop ? ((raw % width) + width) % width : raw;
				return (
					<p key={motion.layerId}>
						{motion.layerId}: {Math.round(offset)} px ·{" "}
						{motion.loop ? `loop ${Math.floor(raw / width)}` : "no loop"}
					</p>
				);
			})}
			{error ? (
				<p role="alert">{error}</p>
			) : (
				<p>
					Playback starts only when you press Play scrolling. A static frame
					does not provide scrolling evidence.
				</p>
			)}
		</section>
	);
}
