import { Application, Sprite, Texture } from "pixi.js";
import { useEffect, useRef } from "react";

export function ScenePreview({
	source,
	revision,
}: {
	source: HTMLCanvasElement | null;
	revision: number;
}) {
	const mount = useRef<HTMLDivElement>(null);
	const textureRef = useRef<Texture | null>(null);

	useEffect(() => {
		if (revision > 0) {
			textureRef.current?.source.update();
		}
	}, [revision]);

	useEffect(() => {
		if (!(source && mount.current)) {
			return;
		}
		const canvas = source;

		let active = true;
		let application: Application | undefined;

		async function createPreview() {
			const app = new Application();
			await app.init({ width: 256, height: 192, background: "#27374a" });
			if (!(active && mount.current)) {
				app.destroy();
				return;
			}
			application = app;
			mount.current.append(app.canvas);
			const texture = Texture.from(canvas);
			textureRef.current = texture;
			texture.source.scaleMode = "nearest";
			const sprite = new Sprite(texture);
			sprite.width = 128;
			sprite.height = 128;
			sprite.x = 64;
			sprite.y = 32;
			app.stage.addChild(sprite);
		}

		void createPreview();
		return () => {
			active = false;
			textureRef.current = null;
			application?.destroy(true, {
				children: true,
				texture: true,
				textureSource: true,
			});
		};
	}, [source]);

	return <div aria-label="PixiJS scene preview" ref={mount} role="img" />;
}
