import sharp from "sharp";

/** Decode the original image without inventing an alpha plane. */
export async function decodeVfxImage(bytes: Buffer) {
	try {
		const image = sharp(bytes, {
			limitInputPixels: 16_777_216,
			failOn: "warning",
		});
		const metadata = await image.metadata();
		const { info } = await image.raw().toBuffer({ resolveWithObject: true });
		return {
			width: info.width,
			height: info.height,
			hasAlpha: metadata.hasAlpha,
		};
	} catch {
		return null;
	}
}
