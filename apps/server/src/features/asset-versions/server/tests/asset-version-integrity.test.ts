import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { AssetVersionIntegrityError } from "@sprite-anvil/api/asset-version-integrity";
import sharp from "sharp";
import { verifyAssetVersionStream } from "../asset-version-integrity";

test("verifies a decodable PNG and rejects corrupt bytes even with a matching digest", async () => {
	const png = new Uint8Array(
		await sharp({
			create: { width: 2, height: 2, channels: 4, background: "red" },
		})
			.png()
			.toBuffer()
	);
	const digest = (bytes: Uint8Array) =>
		createHash("sha256").update(bytes).digest("hex");
	const verified = verifyAssetVersionStream(
		new Blob([png]).stream(),
		"image/png",
		png.length,
		digest(png)
	);
	expect(
		new Uint8Array(await new Response(verified.body).arrayBuffer())
	).toEqual(png);

	const corrupt = new Uint8Array(png.slice(0, 16));
	const invalid = verifyAssetVersionStream(
		new Blob([corrupt]).stream(),
		"image/png",
		corrupt.length,
		digest(corrupt)
	);
	await expect(new Response(invalid.body).arrayBuffer()).rejects.toBeInstanceOf(
		AssetVersionIntegrityError
	);
});
