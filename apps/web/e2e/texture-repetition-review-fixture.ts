export const textureRepetitionFixture = {
	userName: "Texture review owner",
	email:
		process.env.TEXTURE_REPETITION_E2E_EMAIL ??
		`texture-review-${crypto.randomUUID()}@example.test`,
	password: "TextureReview-Password-1",
	atlasRegion: { x: 0, y: 0, width: 4, height: 4 },
	terrainId: "grass-terrain",
	repeatAxes: ["x", "y"],
	shiftedOffset: { x: 2, y: 2 },
	notes: "Uniform color repeats without a visible motif.",
} as const;

// Serialize visible preview geometry on each engine, excluding PNG encoding.
export function readTexturePreviewPresentation() {
	const heading = Array.from(document.querySelectorAll("h3")).find(
		(element) => element.textContent === "Texture repetition · Grass textures"
	);
	if (!heading?.parentElement) {
		throw new Error("Texture review was not found.");
	}
	return Array.from(heading.parentElement.querySelectorAll("[role='img']")).map(
		(preview) => {
			const style = getComputedStyle(preview);
			return {
				label: preview.getAttribute("aria-label"),
				width: style.width,
				height: style.height,
				tileSize: style.backgroundSize,
				repeat: style.backgroundRepeat,
				position: style.backgroundPosition,
				rendering: style.imageRendering,
				imageReady: style.backgroundImage !== "none",
			};
		}
	);
}
