import type {
	SceneQaPlacement,
	SceneQaSetup,
} from "@sprite-anvil/api/scene-qa";
import {
	type Application,
	Container,
	Graphics,
	Rectangle,
	Sprite,
	Texture,
	TilingSprite,
} from "pixi.js";

type SceneFrame = SceneQaPlacement["clips"]["idle"][number];
function frameIndex(frames: SceneFrame[], elapsed: number, loop = true) {
	const total = frames.reduce((sum, f) => sum + f.durationMs, 0);
	if (!total || elapsed < 0 || (!loop && elapsed >= total)) {
		return -1;
	}
	let time = loop ? elapsed % total : elapsed;
	for (const [index, frame] of frames.entries()) {
		time -= frame.durationMs;
		if (time < 0) {
			return index;
		}
	}
	return frames.length - 1;
}
function animationPhase(
	time: number,
	duration: number
): { state: keyof SceneQaPlacement["clips"]; start: number } {
	if (time < duration * 0.3) {
		return { state: "idle", start: 0 };
	}
	if (time < duration * 0.6) {
		return { state: "walk", start: duration * 0.3 };
	}
	if (time < duration * 0.85) {
		return { state: "attack", start: duration * 0.6 };
	}
	return { state: "idle", start: duration * 0.85 };
}
function cameraOffset(
	setup: SceneQaSetup,
	actor: SceneQaPlacement | undefined,
	time: number,
	dx: number,
	dy: number
) {
	if (setup.camera === "follow" && actor) {
		return {
			x: setup.width / 2 - actor.x - dx,
			y: setup.height / 2 - actor.y - dy,
		};
	}
	if (setup.camera === "pan") {
		return { x: (-64 * time) / setup.durationMs, y: 0 };
	}
	return { x: 0, y: 0 };
}
function createGuides(p: SceneQaPlacement) {
	const anchor = p.role === "effect" ? p.origin : p.pivot;
	const graphics = new Graphics();
	const points: [SceneQaPlacement["pivot"], number][] = [
		[p.pivot, 0xff_ba_49],
		[p.groundPoint, 0x80_ed_99],
		[p.sortPoint, 0x5b_c0_eb],
		[p.origin, 0xff_70_a6],
	];
	for (const [point, color] of points) {
		const x = (point.x - anchor.x) * p.scale;
		const y = (point.y - anchor.y) * p.scale;
		graphics
			.moveTo(x - 4, y)
			.lineTo(x + 4, y)
			.moveTo(x, y - 4)
			.lineTo(x, y + 4)
			.stroke({ color, width: 1 });
	}
	const areaColors = {
		hitbox: 0xff_ba_49,
		hurtbox: 0xff_70_a6,
		collision: 0x80_ed_99,
	};
	for (const area of p.areas) {
		graphics
			.rect(
				(area.x - anchor.x) * p.scale,
				(area.y - anchor.y) * p.scale,
				area.width * p.scale,
				area.height * p.scale
			)
			.stroke({ color: areaColors[area.kind], width: 1 });
	}
	return graphics;
}
interface SceneEntry {
	clips: Record<keyof SceneQaPlacement["clips"], Texture[]>;
	group: Container;
	p: SceneQaPlacement;
	sprite: Sprite | TilingSprite;
}
interface ScenePlayback {
	actorPresent: boolean;
	dx: number;
	dy: number;
	start: number;
	state: keyof SceneQaPlacement["clips"];
	time: number;
}
function renderEntry(
	{ p, group, sprite, clips }: SceneEntry,
	setup: SceneQaSetup,
	playback: ScenePlayback
) {
	const { actorPresent, state, start, time, dx, dy } = playback;
	const attached =
		actorPresent && ["character", "shadow", "effect"].includes(p.role);
	const x = p.x + (attached ? dx : 0);
	const y = p.y + (attached ? dy : 0);
	const anchor = p.role === "effect" ? p.origin : p.pivot;
	group.position.set(Math.round(x), Math.round(y));
	group.zIndex =
		p.layer * 100_000 +
		(setup.ySort ? Math.round(y + (p.sortPoint.y - anchor.y) * p.scale) : 0);
	const clip = p.clips[state].length ? state : "idle";
	let clipTime = time;
	if (clip !== "idle") {
		clipTime = time - start;
	}
	if (p.role === "effect") {
		clipTime = time - setup.hitAtMs;
	}
	const index = frameIndex(p.clips[clip], clipTime, p.role !== "effect");
	group.visible = index >= 0;
	const texture = clips[clip][index];
	if (texture) {
		sprite.texture = texture;
		sprite.position.set(-anchor.x * p.scale, -anchor.y * p.scale);
	}
	if (p.role === "background") {
		group.x = Math.round(x - dx * 0.25);
	}
}
export function createSceneQaScene(
	app: Application,
	setup: SceneQaSetup,
	images: Map<string, HTMLImageElement>
) {
	const world = new Container();
	world.sortableChildren = true;
	app.stage.addChild(world);
	const textures: Texture[] = [];
	const actor = setup.placements.find((p) => p.role === "character");
	const entries = setup.placements.map((p) => {
		const image = images.get(p.assetVersionId);
		if (!image) {
			throw new Error("Exact scene image is unavailable.");
		}
		const imageWidth = image.naturalWidth;
		const imageHeight = image.naturalHeight;
		const source = Texture.from(image);
		source.source.scaleMode = "nearest";
		textures.push(source);
		function makeFrames(frames: SceneFrame[]) {
			return frames.map((f) => {
				if (f.x + f.width > imageWidth || f.y + f.height > imageHeight) {
					throw new Error("Frame exceeds the exact source image.");
				}
				const texture = new Texture({
					source: source.source,
					frame: new Rectangle(f.x, f.y, f.width, f.height),
				});
				textures.push(texture);
				return texture;
			});
		}
		const clips = {
			idle: makeFrames(p.clips.idle),
			walk: makeFrames(p.clips.walk),
			attack: makeFrames(p.clips.attack),
		};
		const [first] = clips.idle;
		if (!first) {
			throw new Error("An idle frame is required.");
		}
		const group = new Container();
		world.addChild(group);
		const sprite =
			p.role === "tile"
				? new TilingSprite({
						texture: first,
						width: setup.width / p.scale,
						height: setup.height / p.scale,
					})
				: new Sprite(first);
		sprite.scale.set(p.scale);
		group.addChild(sprite);
		const overlay = createGuides(p);
		overlay.visible = setup.showOverlays;
		group.addChild(overlay);
		return { p, group, sprite, clips };
	});
	function render(time: number) {
		const progress = Math.min(
			1,
			Math.max(0, (time - setup.durationMs * 0.3) / (setup.durationMs * 0.3))
		);
		const dx = setup.movement.x * progress;
		const dy = setup.movement.y * progress;
		const camera = cameraOffset(setup, actor, time, dx, dy);
		world.position.set(Math.round(camera.x), Math.round(camera.y));
		const { state, start } = animationPhase(time, setup.durationMs);
		for (const entry of entries) {
			renderEntry(entry, setup, {
				actorPresent: Boolean(actor),
				state,
				start,
				time,
				dx,
				dy,
			});
		}
		app.render();
		return state;
	}
	return {
		render,
		destroy: () => {
			for (const texture of textures) {
				texture.destroy();
			}
		},
	};
}
