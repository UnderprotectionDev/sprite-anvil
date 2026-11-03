import { pixelEditorMaxDimension } from "@sprite-anvil/api/pixel-editor";
import sharp from "sharp";
import { PixelOperationError, type Raster } from "./pixel-operations";

/** Decodes a PNG or WebP into straight RGBA without resampling or colour conversion. */
export async function readRasterFromPng(bytes: Uint8Array): Promise<Raster> {
	const { data, info } = await sharp(bytes, { failOn: "warning" })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (
		info.width > pixelEditorMaxDimension ||
		info.height > pixelEditorMaxDimension
	) {
		throw new PixelOperationError("Source image is too large for the editor");
	}
	return {
		width: info.width,
		height: info.height,
		data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice(),
	};
}

/** Lossless PNG with fixed encoder settings so equal rasters give equal bytes. */
export async function encodeRasterPng(
	raster: Raster
): Promise<Uint8Array<ArrayBuffer>> {
	const png = await sharp(raster.data, {
		raw: { width: raster.width, height: raster.height, channels: 4 },
	})
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	return new Uint8Array(png);
}
