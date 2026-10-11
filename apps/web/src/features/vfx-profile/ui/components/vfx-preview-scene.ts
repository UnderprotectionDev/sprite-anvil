import {
	getVfxEffectTime,
	getVfxFrameAt,
	type VfxSynchronizationInput,
} from "@sprite-anvil/api/vfx-synchronization";
import { type Application, Rectangle, Sprite, Texture } from "pixi.js";
export interface VfxPreviewState {
	alone: boolean;
	background: string;
	elapsedMs: number;
}
export function createVfxPreviewScene(
	instance: Application,
	images: Map<string, HTMLImageElement>,
	config: Pick<
		VfxSynchronizationInput,
		"effect" | "owner" | "sceneAssetVersionId" | "event" | "layer"
	>
) {
	const textures: Texture[] = [];

	const sources = new Map(
		[...images].map(([id, image]) => {
			const texture = Texture.from(image);
			texture.source.scaleMode = "nearest";
			textures.push(texture);
			return [id, texture.source] as const;
		})
	);
	const makeFrames = (clip: VfxSynchronizationInput["effect"]) =>
		clip.frames.map((frame) => {
			const image = images.get(frame.assetVersionId);
			const source = sources.get(frame.assetVersionId);
			if (
				!(image && source) ||
				frame.region.x + frame.region.width > image.naturalWidth ||
				frame.region.y + frame.region.height > image.naturalHeight
			) {
				throw new Error(
					"Frame region exceeds the readable image. Overflow permission cannot waive integrity."
				);
			}
			const texture = new Texture({
				source,
				frame: new Rectangle(
					frame.region.x,
					frame.region.y,
					frame.region.width,
					frame.region.height
				),
			});
			textures.push(texture);
			const sprite = new Sprite(texture);
			sprite.visible = false;
			sprite.position.set(
				128 - frame.origin.x + frame.region.x,
				96 - frame.origin.y + frame.region.y
			);
			instance.stage.addChild(sprite);
			return sprite;
		});
	const sceneImage = images.get(config.sceneAssetVersionId);
	if (!sceneImage) {
		throw new Error("Scene version is missing.");
	}
	const scene = new Sprite(Texture.from(sceneImage));
	scene.width = 256;
	scene.height = 192;
	instance.stage.addChild(scene);
	const ownerSprites = makeFrames(config.owner);
	const effectSprites = makeFrames(config.effect);
	const all: Sprite[] = [...ownerSprites, ...effectSprites];
	instance.stage.sortableChildren = true;
	scene.zIndex = -101;
	for (const sprite of ownerSprites) {
		sprite.zIndex = 0;
	}
	for (const sprite of effectSprites) {
		sprite.zIndex = config.layer;
	}
	const render = (state: VfxPreviewState) => {
		const ownerFrame = getVfxFrameAt(config.owner, state.elapsedMs);
		const effectTime = state.alone
			? state.elapsedMs
			: getVfxEffectTime(config.owner, config.event.timeMs, state.elapsedMs);
		const effectFrame = getVfxFrameAt(config.effect, effectTime);
		for (const sprite of all) {
			sprite.visible = false;
		}
		const ownerSprite =
			ownerSprites[ownerFrame ? config.owner.frames.indexOf(ownerFrame) : -1];
		const effectSprite =
			effectSprites[
				effectFrame ? config.effect.frames.indexOf(effectFrame) : -1
			];
		if (ownerSprite) {
			ownerSprite.visible = !state.alone;
		}
		if (effectSprite) {
			effectSprite.visible = true;
		}
		scene.visible = state.background === "scene";
		instance.render();
	};
	return {
		render,
		destroy: () => {
			for (const texture of textures) {
				texture.destroy();
			}
		},
	};
}
