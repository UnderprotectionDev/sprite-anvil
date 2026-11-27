import { pixelEditorMaxDimension } from "@sprite-anvil/api/pixel-editor";
import sharp from "sharp";
import type { Raster } from "./pixel-measurement";

/** Decodes a PNG or WebP into straight RGBA without resampling or colour conversion. */
export async function decodeRaster(bytes: Uint8Array): Promise<Raster> {
	const { data, info } = await sharp(bytes, {
		failOn: "warning",
		limitInputPixels: pixelEditorMaxDimension ** 2,
	})
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return {
		width: info.width,
		height: info.height,
		data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice(),
	};
}

/** Lossless PNG with fixed encoder settings so equal rasters give equal bytes. */
export async function encodePng(
	raster: Raster
): Promise<Uint8Array<ArrayBuffer>> {
	const png = await sharp(raster.data, {
		raw: { width: raster.width, height: raster.height, channels: 4 },
	})
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	return new Uint8Array(png);
}
