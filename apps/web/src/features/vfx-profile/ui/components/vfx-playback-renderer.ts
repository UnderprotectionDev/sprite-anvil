import type {
	VfxAppearanceFrame,
	VfxAppearanceInput,
} from "@sprite-anvil/api/vfx-appearance-reviews";
import type {
	Application as PixiApplication,
	Texture as PixiTexture,
} from "pixi.js";

export type VfxPlayback = Pick<
	VfxAppearanceInput,
	"name" | "frames" | "cell" | "looping" | "opacity" | "sceneAssetVersionId"
> & { backgrounds: readonly VfxAppearanceInput["backgrounds"][number][] };
type Pixi = typeof import("pixi.js");
type Geometry = ReturnType<typeof getGeometry>;

function getGeometry(input: VfxPlayback) {
	const bounds = input.frames.reduce(
		(area, frame) => ({
			left: Math.min(area.left, frame.offset.x),
			top: Math.min(area.top, frame.offset.y),
			right: Math.max(area.right, frame.offset.x + frame.region.width),
			bottom: Math.max(area.bottom, frame.offset.y + frame.region.height),
		}),
		{ left: 0, top: 0, right: input.cell.width, bottom: input.cell.height }
	);
	const width = bounds.right - bounds.left + 16;
	const height = bounds.bottom - bounds.top + 16;
	return {
		width,
		height,
		scale: Math.min(4, 640 / width, 400 / height),
		x: 8 - bounds.left,
		y: 8 - bounds.top,
	};
}

function selectFrame(
	frames: VfxAppearanceFrame[],
	elapsed: number,
	looping: boolean
) {
	const total = frames.reduce((sum, frame) => sum + frame.durationMs, 0);
	let time = looping ? elapsed % total : Math.min(elapsed, total - 1);
	let index = 0;
	while (
		index < frames.length - 1 &&
		time >= (frames[index]?.durationMs ?? 1)
	) {
		time -= frames[index]?.durationMs ?? 1;
		index += 1;
	}
	return index;
}

function mountPanel(
	app: PixiApplication,
	input: VfxPlayback,
	background: string,
	host: HTMLDivElement
) {
	const panel = document.createElement("figure");
	const caption = document.createElement("figcaption");
	caption.textContent = background;
	panel.append(caption, app.canvas);
	app.canvas.setAttribute("role", "img");
	app.canvas.setAttribute("aria-label", `${input.name} · ${background}`);
	app.canvas.style.maxWidth = "100%";
	app.canvas.style.height = "auto";
	if (background === "transparent") {
		app.canvas.style.background =
			"repeating-conic-gradient(#e5e7eb 0% 25%, #9ca3af 0% 50%) 0 / 16px 16px";
	}
	host.appendChild(panel);
}

async function createPanel(
	pixi: Pixi,
	input: VfxPlayback,
	geometry: Geometry,
	background: string,
	scene: HTMLImageElement,
	texture: PixiTexture,
	resources: { apps: PixiApplication[]; textures: PixiTexture[] }
) {
	const app = new pixi.Application();
	await app.init({
		width: geometry.width * geometry.scale,
		height: geometry.height * geometry.scale,
		backgroundColor: background === "light" ? 0xf1_f5_f9 : 0x0f_17_2a,
		backgroundAlpha: background === "transparent" ? 0 : 1,
		autoStart: false,
	});
	resources.apps.push(app);
	app.stage.scale.set(geometry.scale);
	if (background === "scene") {
		const sceneTexture = pixi.Texture.from(scene);
		resources.textures.push(sceneTexture);
		const sceneSprite = new pixi.Sprite(sceneTexture);
		sceneSprite.width = geometry.width;
		sceneSprite.height = geometry.height;
		app.stage.addChild(sceneSprite);
	}
	const sprite = new pixi.Sprite(texture);
	sprite.alpha = input.opacity;
	app.stage.addChild(sprite);
	app.stage.addChild(
		new pixi.Graphics()
			.rect(geometry.x, geometry.y, input.cell.width, input.cell.height)
			.stroke({ color: 0xff_00_ff, width: 1 / geometry.scale })
	);
	return { app, sprite, background };
}

export async function createVfxPlaybackRenderer(
	input: VfxPlayback,
	images: HTMLImageElement[],
	scene: HTMLImageElement,
	host: HTMLDivElement,
	isDisposed: () => boolean
) {
	const pixi = await import("pixi.js");
	const geometry = getGeometry(input);
	const resources: { apps: PixiApplication[]; textures: PixiTexture[] } = {
		apps: [],
		textures: [],
	};
	let destroyed = false;
	const dispose = () => {
		if (destroyed) {
			return;
		}
		destroyed = true;
		for (const app of resources.apps) {
			app.destroy(true, { children: true });
		}
		const sources = new Set(
			resources.textures.map((texture) => texture.source)
		);
		for (const texture of new Set(resources.textures)) {
			texture.destroy();
		}
		for (const source of sources) {
			source.destroy();
		}
		host.replaceChildren();
	};
	try {
		if (isDisposed()) {
			return {
				dispose: () => {
					/* A disposed renderer owns no resources. */
				},
				render: () => {
					/* A disposed renderer owns no resources. */
				},
			};
		}
		const textures = images.map((image, index) => {
			const frame = input.frames[index];
			if (
				!frame ||
				frame.region.x + frame.region.width > image.naturalWidth ||
				frame.region.y + frame.region.height > image.naturalHeight
			) {
				throw new Error("Frame area is outside its source image.");
			}
			const base = pixi.Texture.from(image);
			base.source.scaleMode = "nearest";
			resources.textures.push(base);
			const texture = new pixi.Texture({
				source: base.source,
				frame: new pixi.Rectangle(
					frame.region.x,
					frame.region.y,
					frame.region.width,
					frame.region.height
				),
			});
			resources.textures.push(texture);
			return texture;
		});
		const [first] = textures;
		if (!first) {
			throw new Error("Missing frame.");
		}
		const panelResults = await Promise.allSettled(
			input.backgrounds.map((background) =>
				createPanel(pixi, input, geometry, background, scene, first, resources)
			)
		);
		const panels = panelResults.map((result) => {
			if (result.status === "rejected") {
				throw result.reason;
			}
			return result.value;
		});
		if (isDisposed()) {
			dispose();
			return {
				dispose: () => {
					/* A disposed renderer owns no resources. */
				},
				render: () => {
					/* A disposed renderer owns no resources. */
				},
			};
		}
		for (const panel of panels) {
			mountPanel(panel.app, input, panel.background, host);
		}
		const render = (elapsed: number) => {
			const index = selectFrame(input.frames, elapsed, input.looping);
			const frame = input.frames[index];
			const texture = textures[index];
			if (!(frame && texture)) {
				return;
			}
			for (const { sprite, app } of panels) {
				sprite.texture = texture;
				sprite.position.set(
					geometry.x + frame.offset.x,
					geometry.y + frame.offset.y
				);
				app.render();
			}
		};
		render(0);
		return { render, dispose };
	} catch (error) {
		dispose();
		throw error;
	}
}
