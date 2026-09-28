import { z } from "zod";

function isSafeAssetFileName(fileName: string) {
	return (
		!(fileName.includes("/") || fileName.includes("\\")) &&
		Array.from(fileName).every((character) => {
			const codePoint = character.codePointAt(0);
			return (
				codePoint !== undefined &&
				codePoint >= 0x20 &&
				!(codePoint >= 0x7f && codePoint <= 0x9f)
			);
		})
	);
}

const safeAssetFileNameSchema = z
	.string()
	.min(1)
	.max(255)
	.refine(isSafeAssetFileName);

export const assetSourceFileNameSchema = safeAssetFileNameSchema;

export const assetVersionFileNameSchema = z
	.string()
	.trim()
	.pipe(safeAssetFileNameSchema);
