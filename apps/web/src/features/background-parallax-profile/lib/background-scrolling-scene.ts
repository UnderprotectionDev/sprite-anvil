import type { BackgroundLayerLayoutInput } from "@sprite-anvil/api/background-layer-layouts";
import type { BackgroundScrollingSetup } from "@sprite-anvil/api/background-scrolling-tests";
import * as pixi from "pixi.js";

export type BackgroundLayerMotion = BackgroundScrollingSetup["motions"][number];
export function createBackgroundScrollingScene(
	instance: pixi.Application,
	images: {
		layer: BackgroundLayerLayoutInput["layers"][number];
		image: HTMLImageElement;
	}[],
	motions: BackgroundLayerMotion[],
	width: number,
	textures: pixi.Texture[],
	player?: {
		setup: BackgroundScrollingSetup["player"];
		image: HTMLImageElement;
	}
) {
	const addPlayer = () => {
		if (!player) {
			return;
		}
		const texture = pixi.Texture.from(player.image);
		texture.source.scaleMode = "nearest";
		textures.push(texture);
		const sprite = new pixi.Sprite(texture);
		sprite.width = player.setup.width;
		sprite.height = player.setup.height;
		sprite.position.set(player.setup.x, player.setup.y);
		instance.stage.addChild(sprite);
	};
	if (player?.setup.afterLayerId === null) {
		addPlayer();
	}
	const groups = images
		.sort((a, b) => a.layer.order - b.layer.order)
		.map(({ layer, image }) => {
			const motion = motions.find((item) => item.layerId === layer.id);
			if (!motion) {
				throw new Error("Every layer requires scrolling settings.");
			}
			const base = pixi.Texture.from(image);
			base.source.scaleMode = "nearest";
			const texture = new pixi.Texture({
				source: base.source,
				frame: new pixi.Rectangle(
					layer.crop.x,
					layer.crop.y,
					layer.crop.width,
					layer.crop.height
				),
			});
			textures.push(texture, base);
			const sprites = Array.from({ length: motion.loop ? 2 : 1 }, () => {
				const sprite = new pixi.Sprite(texture);
				sprite.scale.set(width / layer.crop.width);
				instance.stage.addChild(sprite);
				return sprite;
			});
			if (player?.setup.afterLayerId === layer.id) {
				addPlayer();
			}
			return { motion, sprites };
		});
	const render = (elapsed: number) => {
		for (const { motion, sprites } of groups) {
			const raw = motion.startOffset + (motion.speed * elapsed) / 1000;
			const offset = motion.loop ? ((raw % width) + width) % width : raw;
			sprites.forEach((sprite, index) => {
				sprite.position.set(index * width - offset, 0);
			});
		}
		instance.render();
	};
	return render;
}
