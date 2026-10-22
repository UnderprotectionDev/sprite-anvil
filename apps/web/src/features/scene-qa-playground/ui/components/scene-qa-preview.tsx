import type { SceneQaSetup } from "@sprite-anvil/api/scene-qa";
import { Button } from "@sprite-anvil/ui/components/button";
import type { Application as PixiApplication } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { loadSceneQaImages } from "../../lib/scene-qa-images";
import type { createSceneQaScene as createSceneQaSceneType } from "../../lib/scene-qa-scene";
export function SceneQaPreview({
	setup,
	versions,
	onPlayback,
}: {
	setup: SceneQaSetup;
	versions: { id: string; previewUrl: string }[];
	onPlayback?: (time: number) => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const callback = useRef(onPlayback);
	callback.current = onPlayback;
	const [error, setError] = useState("");
	const [ready, setReady] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [time, setTime] = useState(0);
	const [state, setState] = useState("idle");
	const renderer = useRef<ReturnType<typeof createSceneQaSceneType> | null>(
		null
	);
	const elapsed = useRef(0);
	const config = JSON.stringify({ setup, versions });
	useEffect(() => {
		let disposed = false;
		let app: PixiApplication | undefined;
		let initialized = false;
		let scene: ReturnType<typeof createSceneQaSceneType> | undefined;
		setReady(false);
		setPlaying(false);
		setTime(0);
		setError("");
		elapsed.current = 0;
		callback.current?.(0);
		function reportFailure(failure: unknown) {
			if (disposed) {
				return;
			}
			setError(
				failure instanceof Error
					? failure.message
					: "Could not load scene content."
			);
			callback.current?.(0);
		}
		async function initialize() {
			try {
				const configData: {
					setup: SceneQaSetup;
					versions: { id: string; previewUrl: string }[];
				} = JSON.parse(config);
				const images = await loadSceneQaImages(
					configData.setup,
					configData.versions
				);
				if (disposed) {
					return;
				}
				const [{ Application }, { createSceneQaScene }] = await Promise.all([
					import("pixi.js"),
					import("../../lib/scene-qa-scene"),
				]);
				app = new Application();
				await app.init({
					width: configData.setup.width,
					height: configData.setup.height,
					background:
						configData.setup.contrast === "dark" ? "#17202c" : "#edf1f7",
					antialias: false,
					autoStart: false,
					resolution: 1,
					preference: "webgl",
				});
				initialized = true;
				if (disposed) {
					app.destroy(true, { children: true });
					return;
				}
				scene = createSceneQaScene(app, configData.setup, images);
				renderer.current = scene;
				app.canvas.style.width = "100%";
				app.canvas.style.height = "auto";
				app.canvas.style.imageRendering = "pixelated";
				host.current?.appendChild(app.canvas);
				scene.render(0);
				setReady(true);
			} catch (failure) {
				reportFailure(failure);
			}
		}
		initialize();
		return () => {
			disposed = true;
			renderer.current = null;
			scene?.destroy();
			if (initialized) {
				app?.destroy(true, { children: true });
			}
		};
	}, [config]);
	useEffect(() => {
		if (!(playing && ready)) {
			return;
		}
		let frame = 0;
		let previous = performance.now();
		function tick(now: number) {
			const delta = Math.min(now - previous, 100);
			previous = now;
			elapsed.current = Math.min(setup.durationMs, elapsed.current + delta);
			const current = Math.floor(elapsed.current);
			try {
				setState(renderer.current?.render(current) ?? "idle");
				setTime(current);
				if (current === setup.durationMs) {
					setPlaying(false);
					callback.current?.(current);
				} else {
					frame = requestAnimationFrame(tick);
				}
			} catch (failure) {
				setError(
					failure instanceof Error ? failure.message : "Scene playback failed."
				);
				setPlaying(false);
				callback.current?.(0);
			}
		}
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing, ready, setup.durationMs]);
	return (
		<section
			aria-label="Scene preview"
			className="space-y-3 rounded-lg border p-4"
		>
			<div
				aria-label="Exact asset scene preview"
				className="overflow-hidden rounded border"
				ref={host}
				role="img"
			/>
			{error.length > 0 && <p role="alert">{error}</p>}
			{!(ready || error) && <p role="status">Loading exact scene content…</p>}
			<div className="flex flex-wrap items-center gap-3">
				<Button
					disabled={!ready || !!error}
					onClick={() => {
						if (elapsed.current === setup.durationMs) {
							elapsed.current = 0;
							callback.current?.(0);
						}
						setPlaying(!playing);
					}}
					type="button"
				>
					{playing ? "Pause scene" : "Play scene"}
				</Button>
				<Button
					disabled={!ready}
					onClick={() => {
						setPlaying(false);
						elapsed.current = 0;
						setTime(0);
						setState(renderer.current?.render(0) ?? "idle");
						callback.current?.(0);
					}}
					type="button"
					variant="outline"
				>
					Reset playback
				</Button>
				<output aria-live="off">
					{state} · {time} / {setup.durationMs} ms
					{time >= setup.hitAtMs ? " · Hit event reached" : ""}
				</output>
			</div>
			<p className="text-muted-foreground text-sm">
				Playback starts only when you choose Play scene. Idle → walk → attack →
				idle. Overlays: pivot (amber), ground (green), sort (blue), effect
				origin (pink). Areas are authored preview guides; collision is not
				simulated.
			</p>
		</section>
	);
}
